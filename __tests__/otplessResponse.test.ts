import {errorMessageFor} from '../src/otpless/otplessErrors';
import {
  field,
  isSuccess,
  parseOtplessResponse,
} from '../src/otpless/otplessResponse';
import {redact} from '../src/otpless/otplessService';

// jest.mock is hoisted above the imports.
jest.mock('otpless-headless-rn', () => ({OtplessHeadlessModule: jest.fn()}));

test('parses INITIATE', () => {
  const r = parseOtplessResponse({
    responseType: 'INITIATE',
    statusCode: 200,
    response: {authType: 'OTP', deliveryChannel: 'WHATSAPP'},
  });
  expect(r.type).toBe('INITIATE');
  expect(isSuccess(r)).toBe(true);
  expect(field(r, 'authType')).toBe('OTP');
  expect(field(r, 'deliveryChannel')).toBe('WHATSAPP');
});

test('reads ONETAP token from response or response.data', () => {
  const nested = parseOtplessResponse({
    responseType: 'ONETAP',
    statusCode: '200',
    response: {data: {token: 'abc', idToken: 'jwt'}},
  });
  expect(field(nested, 'token')).toBe('abc');
  expect(isSuccess(nested)).toBe(true);
});

test('unknown responseType does not throw', () => {
  const r = parseOtplessResponse({responseType: 'SOMETHING_NEW'});
  expect(r.type).toBe('UNKNOWN');
  expect(r.statusCode).toBe(-1);
});

test('maps error codes, falling back to the SDK message', () => {
  const known = parseOtplessResponse({
    responseType: 'VERIFY',
    statusCode: 400,
    response: {errorCode: '7118'},
  });
  const unknown = parseOtplessResponse({
    responseType: 'INITIATE',
    statusCode: 400,
    response: {errorCode: '1234', errorMessage: 'From SDK'},
  });
  expect(errorMessageFor(known)).toContain('Incorrect OTP');
  expect(errorMessageFor(unknown)).toBe('From SDK');
});

test('redact hides OTPs and tokens at any depth', () => {
  expect(
    redact({
      phone: '99',
      otp: '1234',
      response: {data: {token: 't', idToken: 'j'}},
    }),
  ).toEqual({
    phone: '99',
    otp: '•••',
    response: {data: {token: '•••', idToken: '•••'}},
  });
});
