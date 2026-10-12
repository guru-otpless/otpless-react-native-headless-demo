import {DemoController, RESPONSE_TIMEOUT_MS} from '../src/DemoController';
import {
  parseOtplessResponse,
  type OtplessResponse,
} from '../src/otpless/otplessResponse';

jest.mock('otpless-headless-rn', () => ({OtplessHeadlessModule: jest.fn()}));

/** Stand-in for otplessService that lets the test emit SDK responses. */
function fakeService() {
  let listener: ((r: OtplessResponse) => void) | undefined;
  return {
    isReady: false,
    startPhone: jest.fn(async () => {}),
    verifyPhoneOtp: jest.fn(async () => {}),
    addLog: jest.fn(),
    onResponseReceived(l: (r: OtplessResponse) => void) {
      listener = l;
      return () => (listener = undefined);
    },
    emit(responseType: string, statusCode: number, response: object = {}) {
      listener?.(parseOtplessResponse({responseType, statusCode, response}));
    },
  };
}

function setup() {
  const service = fakeService();
  const controller = new DemoController(service as never);
  const detach = controller.attach();
  return {service, controller, detach};
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('SMS OTP happy path: ready → initiate → verify 200', async () => {
  const {service, controller, detach} = setup();

  service.emit('SDK_READY', 200);
  expect(controller.getState().sdkReady).toBe(true);

  controller.startSmsOtp('9876543210', '91');
  expect(service.startPhone).toHaveBeenCalledWith('9876543210', '91', 'SMS');
  expect(controller.getState().isBusy).toBe(true);

  service.emit('INITIATE', 200, {authType: 'OTP', deliveryChannel: 'SMS'});
  expect(controller.getState().authType).toBe('OTP'); // shows Verify OTP card

  controller.verifyOtp('123456');
  controller.verifyOtp('123456'); // duplicate is ignored
  expect(service.verifyPhoneOtp).toHaveBeenCalledTimes(1);

  service.emit('VERIFY', 200, {authType: 'OTP'});
  expect(controller.getState()).toMatchObject({
    isAuthenticated: true,
    isBusy: false,
  });
  detach();
});

test('OTP_AUTO_READ fills and verifies automatically', () => {
  const {service, controller, detach} = setup();
  service.emit('SDK_READY', 200);
  controller.startAuto('9876543210', '91');
  service.emit('INITIATE', 200, {authType: 'OTP'});
  service.emit('OTP_AUTO_READ', 200, {otp: '4321'});
  expect(controller.getState().autoDetectedOtp).toBe('4321');
  expect(service.verifyPhoneOtp).toHaveBeenCalledWith(
    '9876543210',
    '91',
    '4321',
  );
  detach();
});

test('SNA fallback switches to OTP; wrong OTP shows an error', () => {
  const {service, controller, detach} = setup();
  service.emit('SDK_READY', 200);
  controller.startAuto('9876543210', '91');
  service.emit('INITIATE', 200, {authType: 'SILENT_AUTH'});
  service.emit('VERIFY', 9105, {authType: 'SILENT_AUTH'});
  expect(controller.getState().isBusy).toBe(true); // still waiting for fallback
  service.emit('FALLBACK_TRIGGERED', 200, {deliveryChannel: 'SMS'});
  expect(controller.getState().authType).toBe('OTP');

  service.emit('VERIFY', 400, {authType: 'OTP', errorCode: '7118'});
  expect(controller.getState().lastError).toContain('Incorrect OTP');
  detach();
});

test('stops waiting after the timeout', () => {
  const {service, controller, detach} = setup();
  service.emit('SDK_READY', 200);
  controller.startWhatsAppOtp('9876543210', '91');
  jest.advanceTimersByTime(RESPONSE_TIMEOUT_MS);
  expect(controller.getState()).toMatchObject({
    isBusy: false,
    statusMessage: 'No response received',
  });
  detach();
});

test('rejects an invalid phone number without calling the SDK', () => {
  const {service, controller, detach} = setup();
  controller.startSmsOtp('12', '91');
  expect(service.startPhone).not.toHaveBeenCalled();
  expect(controller.getState().lastError).toMatch(/valid/);
  detach();
});
