import {field, type OtplessResponse} from './otplessResponse';

/**
 * OTPLESS error codes → messages you can show to end users.
 *
 * Codes come from `response.errorCode` (a string) on INITIATE / VERIFY /
 * FAILED responses. Android and iOS share almost all codes; iOS-only codes are
 * marked. Reference:
 * https://otpless.com/docs/frontend-sdks/app-sdks/react-native/new/headless/headless
 */
const MESSAGES: Record<string, string> = {
  // --- Request validation (INITIATE) ---
  '7101': 'Some request parameters are invalid.',
  '7102': 'Please enter a valid phone number.',
  '7103': 'This delivery channel is not available for phone numbers.',
  '7104': 'Please enter a valid email address.',
  '7105': 'This delivery channel is not available for email.',
  '7106': 'Please enter a valid phone number or email address.',
  '7113': 'The OTP expiry value is invalid.',
  '7116': 'OTP length must be 4 or 6.',
  '7121': 'The app hash is invalid.',
  '4000': 'The request is invalid. Please try again.',
  '4001': 'Two-factor authentication is not supported for this request.',
  '4003': 'This sign-in channel is not enabled for your app.',

  // --- Configuration / authorization ---
  '401': 'This app is not authorized. Check the App ID and dashboard setup.',
  '7025': 'Sign-in is not enabled for this country.',

  // --- Rate limiting ---
  '7020': 'Too many attempts. Please wait a moment and try again.',
  '7022': 'Too many attempts. Please wait a moment and try again.',
  '7023': 'Too many attempts. Please wait a moment and try again.',
  '7024': 'Too many attempts. Please wait a moment and try again.',

  // --- OTP verification (VERIFY) ---
  '7112': 'Please enter the OTP.',
  '7115': 'This OTP has already been used.',
  '7118': 'Incorrect OTP. Please check and try again.',
  '7303': 'This OTP has expired. Please request a new one.',

  // --- SDK-level FAILED ---
  '5003': 'Could not initialize sign-in. Check your connection and App ID.',
  '5004': 'Secure connection check failed (SSL pinning).',

  // --- Silent Auth ---
  '9106': 'We could not verify your number automatically. Please try again.',

  // --- Network ---
  '9100': 'No internet connection. Please check your network.',
  '9101': 'Network error. Please try again.', // iOS
  '9102': 'Network error. Please try again.', // iOS
  '9103': 'Network error. Please try again.',
  '9104': 'Network error. Please try again.',
  '9105': 'Network error. Please try again.', // iOS

  // --- iOS only ---
  '5900': 'This feature needs a newer iOS version.',
  '9110': 'Sign-in was cancelled.',
};

/** User-facing message, falling back to the SDK's own `errorMessage`. */
export function errorMessageFor(r: OtplessResponse): string {
  const code = field(r, 'errorCode') ?? String(r.statusCode);
  return (
    MESSAGES[code] ??
    field(r, 'errorMessage') ??
    `Something went wrong (code ${code}). Please try again.`
  );
}
