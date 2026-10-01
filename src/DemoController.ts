import {useSyncExternalStore} from 'react';

import {errorMessageFor} from './otpless/otplessErrors';
import {
  AuthType,
  field,
  isSuccess,
  type OtplessResponse,
} from './otpless/otplessResponse';
import {otplessService} from './otpless/otplessService';

export interface DemoState {
  sdkReady: boolean;
  isBusy: boolean;
  statusMessage: string;
  authType?: string;
  deliveryChannel?: string;
  isAuthenticated: boolean;
  userId?: string;
  token?: string;
  lastError?: string;
  /** Set from OTP_AUTO_READ so the screen can show the detected code. */
  autoDetectedOtp?: string;
  /** Changes on every auto-read, even if the same digits repeat. */
  autoDetectedOtpSeq: number;
}

/** Some channels (e.g. WhatsApp zero-tap without Meta-side registration) may
 *  never send a follow-up event. Stop spinning after this long. */
export const RESPONSE_TIMEOUT_MS = 45_000;

/**
 * Holds the demo screen's state and turns OTPLESS SDK responses into it.
 *
 * `onResponse` is the part to study when integrating: it shows what each
 * `responseType` means and how the UI should react.
 */
export class DemoController {
  private state: DemoState;
  private listeners = new Set<() => void>();
  private unsubscribe?: () => void;
  private timeout?: ReturnType<typeof setTimeout>;

  private countryCode = '';
  private phone = '';
  /** OTP of the verify call in flight; dedupes auto-read vs. manual verify. */
  private otpVerifyInFlight?: string;

  constructor(private readonly service = otplessService) {
    this.state = {
      sdkReady: service.isReady,
      isBusy: false,
      statusMessage: 'Initializing OTPless SDK...',
      isAuthenticated: false,
      autoDetectedOtpSeq: 0,
    };
  }

  /** Start listening to SDK responses. Returns a stop function. */
  attach() {
    this.unsubscribe = this.service.onResponseReceived(this.onResponse);
    return () => {
      this.unsubscribe?.();
      clearTimeout(this.timeout);
    };
  }

  // --- Store plumbing for useSyncExternalStore -------------------------------

  getState = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(patch: Partial<DemoState>) {
    this.state = {...this.state, ...patch};
    this.listeners.forEach(l => l());
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** SNA first; the SDK falls back to OTP per the dashboard configuration. */
  startAuto = (phone: string, countryCode: string) =>
    this.startPhone(phone, countryCode, undefined, 'Starting authentication');

  startSmsOtp = (phone: string, countryCode: string) =>
    this.startPhone(phone, countryCode, 'SMS', 'Requesting SMS OTP');

  startWhatsAppOtp = (phone: string, countryCode: string) =>
    this.startPhone(phone, countryCode, 'WHATSAPP', 'Requesting WhatsApp OTP');

  verifyOtp = (otp: string) => {
    if (otp.length < 4) {
      this.set({lastError: 'Enter the OTP you received'});
      return;
    }
    if (this.otpVerifyInFlight === otp) {
      return;
    } // already verifying this code
    this.otpVerifyInFlight = otp;
    this.send(
      () => this.service.verifyPhoneOtp(this.phone, this.countryCode, otp),
      'Verifying OTP',
    );
  };

  /** Lets the user bail out of a request that never answers. */
  cancel = () => {
    clearTimeout(this.timeout);
    this.otpVerifyInFlight = undefined;
    this.service.addLog('REQUEST_CANCELLED', 'Cancelled by user');
    this.set({isBusy: false, statusMessage: 'Cancelled'});
  };

  private startPhone(
    phone: string,
    countryCode: string,
    channel: string | undefined,
    status: string,
  ) {
    if (!countryCode || phone.length < 6) {
      this.set({lastError: 'Enter a valid country code and phone number'});
      return;
    }
    this.countryCode = countryCode;
    this.phone = phone;
    // Clear the previous attempt so a stale "Verify OTP" card doesn't show.
    this.set({
      authType: undefined,
      deliveryChannel: undefined,
      isAuthenticated: false,
      userId: undefined,
      token: undefined,
    });
    this.send(
      () => this.service.startPhone(phone, countryCode, channel),
      status,
    );
  }

  private async send(request: () => Promise<void>, status: string) {
    this.set({isBusy: true, statusMessage: status, lastError: undefined});
    this.armTimeout();
    try {
      // The result arrives later in onResponse.
      await request();
    } catch (e) {
      clearTimeout(this.timeout);
      this.otpVerifyInFlight = undefined;
      this.set({
        isBusy: false,
        statusMessage: 'Request failed',
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // SDK responses → UI state
  // ---------------------------------------------------------------------------

  private onResponse = (r: OtplessResponse) => {
    // Any event means the SDK is progressing; re-armed below if still busy.
    clearTimeout(this.timeout);
    const s = this.state;

    switch (r.type) {
      case 'SDK_READY':
        this.set({
          sdkReady: true,
          isBusy: false,
          statusMessage: 'SDK ready',
          lastError: undefined,
        });
        break;

      case 'FAILED':
        this.set({
          sdkReady: false,
          isBusy: false,
          statusMessage: 'SDK initialization failed',
          lastError: errorMessageFor(r),
        });
        break;

      case 'INITIATE':
        if (!isSuccess(r)) {
          this.set({
            isBusy: false,
            statusMessage: 'Request failed',
            lastError: errorMessageFor(r),
          });
        } else {
          // Request accepted. authType tells you what happens next:
          // OTP → show OTP input, SILENT_AUTH / MAGICLINK → wait.
          this.set({
            isBusy: true,
            authType: field(r, 'authType') ?? s.authType,
            deliveryChannel: field(r, 'deliveryChannel') ?? s.deliveryChannel,
            statusMessage: 'Authentication initiated',
            lastError: undefined,
          });
        }
        break;

      case 'OTP_AUTO_READ': {
        // Android only: OTP read from SMS / WhatsApp. Show it and verify.
        const otp = field(r, 'otp');
        if (otp) {
          this.set({
            statusMessage: 'OTP auto-read — verifying automatically',
            autoDetectedOtp: otp,
            autoDetectedOtpSeq: s.autoDetectedOtpSeq + 1,
          });
          this.verifyOtp(otp);
          return;
        }
        break;
      }

      case 'VERIFY': {
        this.otpVerifyInFlight = undefined;
        const silent = field(r, 'authType') === AuthType.SILENT_AUTH;
        if (isSuccess(r)) {
          // OTP accepted. ONETAP may follow with userId/token; don't wait on it.
          this.set({
            isBusy: false,
            isAuthenticated: true,
            statusMessage: 'OTP verified',
          });
        } else if (silent && r.statusCode !== 9106) {
          // SNA failed; with SmartAuth the SDK moves to the next method.
          this.set({statusMessage: 'Silent auth failed — trying fallback'});
        } else {
          this.set({
            isBusy: false,
            statusMessage: silent
              ? 'Silent auth failed'
              : 'OTP verification failed',
            lastError: errorMessageFor(r),
          });
        }
        break;
      }

      case 'ONETAP':
        // Success. Send `token` to YOUR backend and validate it there.
        this.otpVerifyInFlight = undefined;
        this.set({
          isBusy: false,
          isAuthenticated: true,
          userId: field(r, 'userId') ?? s.userId,
          token: field(r, 'token') ?? s.token,
          statusMessage: 'Authenticated successfully',
          lastError: undefined,
        });
        break;

      case 'DELIVERY_STATUS':
        this.set({
          deliveryChannel: field(r, 'deliveryChannel') ?? s.deliveryChannel,
          statusMessage: `Delivery status: ${
            field(r, 'communicationDelivered') ?? 'unknown'
          }`,
        });
        break;

      case 'FALLBACK_TRIGGERED':
        // e.g. SNA → OTP: an OTP is now on its way, so show the OTP input.
        this.set({
          deliveryChannel: field(r, 'deliveryChannel') ?? s.deliveryChannel,
          authType: AuthType.OTP,
          statusMessage: 'Authentication fallback triggered — OTP requested',
        });
        break;

      case 'AUTH_TERMINATED':
        this.set({
          isBusy: false,
          statusMessage: 'Authentication terminated',
          lastError: errorMessageFor(r),
        });
        break;

      default:
        // Not used by this demo.
        break;
    }

    if (this.state.isBusy) {
      this.armTimeout();
    }
  };

  private armTimeout() {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.service.addLog(
        'REQUEST_TIMEOUT',
        `No further event from OTPLESS for ${RESPONSE_TIMEOUT_MS / 1000}s`,
      );
      this.otpVerifyInFlight = undefined;
      this.set({
        isBusy: false,
        statusMessage: 'No response received',
        lastError:
          'Timed out waiting for OTPLESS. If an OTP arrived, enter it ' +
          'manually. Also check the channel config in the dashboard.',
      });
    }, RESPONSE_TIMEOUT_MS);
  }
}

/** React binding: re-renders when the controller's state changes. */
export function useDemoState(controller: DemoController) {
  return useSyncExternalStore(controller.subscribe, controller.getState);
}
