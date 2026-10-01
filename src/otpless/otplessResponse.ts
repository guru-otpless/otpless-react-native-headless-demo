/**
 * Typed view over the raw object the OTPLESS SDK sends to the response
 * callback. Every callback has the shape:
 *
 *   { responseType: 'INITIATE', statusCode: 200, response: { ... } }
 */

export type OtplessResponseType =
  /** SDK finished initializing. `start()` can be called from now on. */
  | 'SDK_READY'
  /** Terminal SDK-level failure (5003 init failed, 5004 SSL pinning). */
  | 'FAILED'
  /** Request accepted (200) or rejected (anything else). */
  | 'INITIATE'
  /** Android only: OTP read automatically from SMS / WhatsApp. */
  | 'OTP_AUTO_READ'
  /** Verification result. 200 = OTP accepted, otherwise failed. */
  | 'VERIFY'
  /** OTP / link was delivered on a channel. */
  | 'DELIVERY_STATUS'
  /** Authentication succeeded. Contains the token to verify on your backend. */
  | 'ONETAP'
  /** Primary channel failed; SmartAuth moved to the next one (e.g. SNA → OTP). */
  | 'FALLBACK_TRIGGERED'
  /** Authentication ended without success. */
  | 'AUTH_TERMINATED'
  | 'UNKNOWN';

const KNOWN_TYPES: OtplessResponseType[] = [
  'SDK_READY',
  'FAILED',
  'INITIATE',
  'OTP_AUTO_READ',
  'VERIFY',
  'DELIVERY_STATUS',
  'ONETAP',
  'FALLBACK_TRIGGERED',
  'AUTH_TERMINATED',
];

/** Values reported in `response.authType`. */
export const AuthType = {
  OTP: 'OTP',
  MAGIC_LINK: 'MAGICLINK',
  OTP_LINK: 'OTP_LINK',
  SILENT_AUTH: 'SILENT_AUTH',
} as const;

export interface OtplessResponse {
  type: OtplessResponseType;
  rawType: string;
  statusCode: number;
  response: Record<string, unknown>;
  /** Untouched callback payload. Pass this to `commitResponse`. */
  raw: unknown;
}

export function parseOtplessResponse(raw: unknown): OtplessResponse {
  const map = asObject(raw);
  const rawType =
    typeof map.responseType === 'string' ? map.responseType : 'UNKNOWN';
  const type = (KNOWN_TYPES as string[]).includes(rawType)
    ? (rawType as OtplessResponseType)
    : 'UNKNOWN';
  // statusCode is a number on both platforms today; parse defensively.
  const code = Number(map.statusCode);
  return {
    type,
    rawType,
    statusCode: Number.isFinite(code) ? code : -1,
    response: asObject(map.response),
    raw,
  };
}

export const isSuccess = (r: OtplessResponse) => r.statusCode === 200;

/** Reads a non-empty string field from `response` (or `response.data`). */
export function field(r: OtplessResponse, key: string): string | undefined {
  return str(r.response[key]) ?? str(asObject(r.response.data)[key]);
}

function str(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const s = String(value);
  return s.length > 0 ? s : undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
