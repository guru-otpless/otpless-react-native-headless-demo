import {
  OtplessHeadlessModule,
  type OtplessChannelType,
  type OtplessRequestInput,
} from 'otpless-headless-rn';

import {parseOtplessResponse, type OtplessResponse} from './otplessResponse';

type Listener<T> = (value: T) => void;

export interface LogEntry {
  id: number;
  time: Date;
  type: string;
  statusCode?: number;
  detail: string;
}

export class OtplessNotReadyError extends Error {
  constructor() {
    super('Sign-in is still initializing. Please try again.');
  }
}

/**
 * Thin, app-wide wrapper around the OTPLESS Headless SDK.
 *
 * Why one instance: the SDK delivers every result to the listener registered
 * with `setResponseCallback`. Keeping a single module and fanning results out
 * from here means screens can come and go without losing callbacks.
 *
 * Responsibilities:
 *  - initialize the SDK once,
 *  - `commitResponse` every result, then forward it to subscribers,
 *  - build the request objects for phone / email / OAuth,
 *  - keep a redacted event log for the demo screen.
 */
class OtplessService {
  private readonly module = new OtplessHeadlessModule();
  private initialized = false;
  private nextLogId = 1;

  private responseListeners = new Set<Listener<OtplessResponse>>();
  private logListeners = new Set<Listener<LogEntry[]>>();

  isReady = false;
  log: LogEntry[] = [];

  /** Call once, when the first screen that needs OTPLESS mounts. */
  initialize(appId: string, devLogging: boolean = __DEV__) {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    this.addLog('SDK_INIT_START', 'Starting OTPLESS initialization');
    this.module.setDevLogging(devLogging);
    this.module.initialize(appId);
    // Must come after initialize(): that is where the SDK creates its event
    // emitter. Results arrive asynchronously, so SDK_READY is not missed.
    this.module.setResponseCallback(this.onResponse);
  }

  /** Call when the app (or the auth flow) unmounts. */
  cleanup() {
    if (!this.initialized) {
      return;
    }
    this.module.clearListener();
    this.module.cleanup();
    this.initialized = false;
    this.isReady = false;
  }

  // --- Phone -----------------------------------------------------------------

  /**
   * Sends an OTP or starts Silent Auth, depending on the dashboard config.
   * `countryCode` without "+", e.g. "91". `deliveryChannel` optionally forces
   * "SMS" / "WHATSAPP"; omit it to use the dashboard order.
   */
  startPhone(phone: string, countryCode: string, deliveryChannel?: string) {
    return this.start({
      phone,
      countryCode,
      ...(deliveryChannel ? {deliveryChannel} : {}),
    });
  }

  verifyPhoneOtp(phone: string, countryCode: string, otp: string) {
    return this.start({phone, countryCode, otp});
  }

  // --- Email -----------------------------------------------------------------

  startEmail(email: string) {
    return this.start({email});
  }

  verifyEmailOtp(email: string, otp: string) {
    return this.start({email, otp});
  }

  // --- OAuth / social --------------------------------------------------------

  /** e.g. "WHATSAPP", "GMAIL", "APPLE". Must be enabled in the dashboard. */
  startOAuth(channelType: OtplessChannelType) {
    return this.start({channelType});
  }

  // ---------------------------------------------------------------------------

  private async start(input: OtplessRequestInput) {
    // Both native bridges read every value as a string, so keep countryCode,
    // otp, otpLength and expiry as strings.
    if (!(await this.module.isSdkReady())) {
      throw new OtplessNotReadyError();
    }
    this.addLog('REQUEST', JSON.stringify(redact(input)));
    this.module.start(input);
  }

  private onResponse = (raw: unknown) => {
    // Acknowledge every response to the SDK first, as the docs require.
    this.module.commitResponse(raw);

    const response = parseOtplessResponse(raw);
    this.addLog(
      response.rawType,
      JSON.stringify(redact(response.response)),
      response.statusCode,
    );
    if (response.type === 'SDK_READY') {
      this.isReady = true;
    }
    if (response.type === 'FAILED') {
      this.isReady = false;
    }
    this.responseListeners.forEach(l => l(response));
  };

  // --- Subscriptions ---------------------------------------------------------

  onResponseReceived(listener: Listener<OtplessResponse>) {
    this.responseListeners.add(listener);
    return () => {
      this.responseListeners.delete(listener);
    };
  }

  onLogChanged(listener: Listener<LogEntry[]>) {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  /** Newest first, like the on-screen log. */
  addLog(type: string, detail = '', statusCode?: number) {
    const entry: LogEntry = {
      id: this.nextLogId++,
      time: new Date(),
      type,
      statusCode,
      detail,
    };
    this.log = [entry, ...this.log].slice(0, 200);
    if (__DEV__) {
      console.log(`[OTPLESS] ${formatLogEntry(entry)}`);
    }
    this.logListeners.forEach(l => l(this.log));
  }
}

export const otplessService = new OtplessService();

const SENSITIVE_KEYS = new Set([
  'otp',
  'token',
  'idtoken',
  'sessiontoken',
  'refreshtoken',
  'accesstoken',
  'code',
]);

/** Replaces OTPs and tokens with "•••" so the log is safe to share. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEYS.has(k.toLowerCase()) && v != null ? '•••' : redact(v),
      ]),
    );
  }
  return value;
}

export function timeLabel(d: Date) {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

export function formatLogEntry(e: LogEntry) {
  const code = e.statusCode !== undefined ? ` [${e.statusCode}]` : '';
  return `[${timeLabel(e.time)}] ${e.type}${code}  ${e.detail}`;
}
