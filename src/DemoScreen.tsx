import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {DemoController, useDemoState, type DemoState} from './DemoController';
import {
  formatLogEntry,
  otplessService,
  timeLabel,
  type LogEntry,
} from './otpless/otplessService';
import {colors} from './theme';

/** Single test screen: status, phone auth, OTP verify, event log. */
export function DemoScreen({appId}: {appId: string}) {
  const [controller] = useState(() => new DemoController());
  const state = useDemoState(controller);
  const log = useEventLog();

  const [countryCode, setCountryCode] = useState('91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    const detach = controller.attach();
    // Initialize once, when the first screen that needs OTPLESS mounts.
    otplessService.initialize(appId);
    return () => {
      detach();
      otplessService.cleanup();
    };
  }, [controller, appId]);

  // Mirror an auto-read OTP into the field so it's visible. Keyed on the seq
  // number so it re-syncs even if the same digits repeat.
  useEffect(() => {
    if (state.autoDetectedOtp) {
      setOtp(state.autoDetectedOtp);
    }
  }, [state.autoDetectedOtpSeq, state.autoDetectedOtp]);

  // Show the success dialog once, on the false → true transition.
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (state.isAuthenticated && !wasAuthenticated.current) {
      Alert.alert(
        '✓ Authenticated',
        'OTPless verified the user successfully.' +
          (state.userId ? `\nuserId: ${state.userId}` : ''),
      );
    }
    wasAuthenticated.current = state.isAuthenticated;
  }, [state.isAuthenticated, state.userId]);

  const canStart = state.sdkReady && !state.isBusy;
  const cc = countryCode.trim();
  const number = phone.trim();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {/* OTPLESS mark with a small React badge in the corner. */}
        <Image
          source={require('../assets/otpless_react_logo.png')}
          style={styles.logo}
        />
        <Text style={styles.headerTitle}>OTPless Headless Demo</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <StatusCard state={state} onCancel={controller.cancel} />

        <SectionCard title="Phone authentication">
          <View style={styles.row}>
            <NumberField
              label="Country code"
              value={countryCode}
              onChange={setCountryCode}
              maxLength={4}
              style={styles.flex1}
            />
            <NumberField
              label="Phone number"
              value={phone}
              onChange={setPhone}
              maxLength={15}
              style={styles.flex2}
            />
          </View>
          <View style={styles.row}>
            <Button
              label="SNA → OTP"
              disabled={!canStart}
              onPress={() => controller.startAuto(number, cc)}
              style={styles.flex1}
            />
            <Button
              label="SMS OTP"
              disabled={!canStart}
              onPress={() => controller.startSmsOtp(number, cc)}
              style={styles.flex1}
            />
          </View>
          <Button
            label="WhatsApp OTP"
            disabled={!canStart}
            onPress={() => controller.startWhatsAppOtp(number, cc)}
          />
        </SectionCard>

        {/* Only once an OTP has actually been sent (INITIATE with authType
            OTP, or FALLBACK_TRIGGERED from SNA). */}
        {state.authType === 'OTP' && (
          <SectionCard title="Verify OTP">
            <NumberField
              label="OTP"
              value={otp}
              onChange={setOtp}
              maxLength={6}
              oneTimeCode
            />
            <Button
              label="Verify"
              disabled={!state.sdkReady}
              onPress={() => {
                controller.verifyOtp(otp.trim());
                setOtp('');
              }}
            />
          </SectionCard>
        )}

        <View style={styles.logHeader}>
          <Text style={styles.logTitle}>Event log</Text>
          <Pressable
            disabled={log.length === 0}
            onPress={() => shareLogs(log)}
            hitSlop={8}>
            <Text
              style={[styles.link, log.length === 0 && styles.linkDisabled]}>
              Share logs
            </Text>
          </Pressable>
        </View>
        {log.map(entry => (
          <LogRow key={entry.id} entry={entry} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function useEventLog() {
  const [log, setLog] = useState<LogEntry[]>(otplessService.log);
  useEffect(() => otplessService.onLogChanged(setLog), []);
  return log;
}

function shareLogs(log: LogEntry[]) {
  // Oldest first reads more naturally as a transcript. OTPs and tokens are
  // already redacted.
  const message = [
    'OTPless Headless Demo — debug log',
    `Exported: ${new Date().toString()}`,
    '-'.repeat(60),
    ...[...log].reverse().map(formatLogEntry),
  ].join('\n');
  Share.share({message, title: 'OTPless debug log'});
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function StatusCard({
  state,
  onCancel,
}: {
  state: DemoState;
  onCancel: () => void;
}) {
  const dotColor = state.isBusy
    ? colors.grayMid
    : state.sdkReady
    ? colors.green
    : colors.grayOutline;

  return (
    <SectionCard title="Status">
      <View style={styles.statusRow}>
        <View style={[styles.dot, {backgroundColor: dotColor}]} />
        <Text style={styles.bold}>
          {state.sdkReady ? 'SDK ready' : 'SDK not ready'}
        </Text>
        {state.isBusy && (
          <>
            <ActivityIndicator
              size="small"
              color={colors.black}
              style={styles.spinner}
            />
            <Text style={styles.muted}>Working…</Text>
          </>
        )}
      </View>
      {/* Buttons are disabled while busy, so this is the way out if a
          channel never responds. */}
      {state.isBusy && (
        <Pressable onPress={onCancel} hitSlop={8} style={styles.cancel}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      )}
      <Text style={styles.body}>{state.statusMessage}</Text>
      {state.authType && (
        <Text style={styles.small}>authType: {state.authType}</Text>
      )}
      {state.deliveryChannel && (
        <Text style={styles.small}>
          deliveryChannel: {state.deliveryChannel}
        </Text>
      )}
      {state.isAuthenticated && (
        <Text style={styles.bold}>
          Authenticated{state.userId ? ` — userId: ${state.userId}` : ''}
        </Text>
      )}
      {state.lastError && (
        <Text style={styles.error}>Error: {state.lastError}</Text>
      )}
    </SectionCard>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
  maxLength,
  oneTimeCode = false,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  oneTimeCode?: boolean;
  style?: object;
}) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={v => onChange(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={maxLength}
        // Lets iOS / Android offer the OTP from Messages above the keyboard.
        textContentType={oneTimeCode ? 'oneTimeCode' : undefined}
        autoComplete={oneTimeCode ? 'sms-otp' : undefined}
        style={styles.input}
        placeholderTextColor={colors.grayMid}
      />
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}>
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function LogRow({entry}: {entry: LogEntry}) {
  return (
    <View style={styles.logRow}>
      <Text style={[styles.mono, styles.bold]}>
        {timeLabel(entry.time)} {entry.type}
        {entry.statusCode !== undefined ? `  [${entry.statusCode}]` : ''}
      </Text>
      {entry.detail.length > 0 && (
        <Text style={styles.mono}>{entry.detail}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.white},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  logo: {width: 36, height: 36},
  headerTitle: {fontSize: 20, fontWeight: '500', color: colors.black},
  content: {padding: 16, gap: 12},
  row: {flexDirection: 'row', gap: 8},
  flex1: {flex: 1},
  flex2: {flex: 2},
  card: {
    backgroundColor: colors.graySurface,
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.black},
  cardBody: {marginTop: 8, gap: 8},
  statusRow: {flexDirection: 'row', alignItems: 'center'},
  dot: {width: 10, height: 10, borderRadius: 5, marginRight: 8},
  spinner: {marginLeft: 8, marginRight: 6, transform: [{scale: 0.7}]},
  cancel: {alignSelf: 'flex-start', paddingVertical: 4},
  body: {fontSize: 14, color: colors.black},
  small: {fontSize: 12, color: colors.black},
  muted: {fontSize: 12, color: colors.grayMid},
  bold: {fontWeight: '700', color: colors.black},
  error: {fontSize: 14, color: colors.error},
  fieldLabel: {fontSize: 12, color: colors.grayMid, marginBottom: 4},
  input: {
    borderWidth: 1,
    borderColor: colors.grayOutline,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.white,
  },
  button: {
    backgroundColor: colors.black,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {backgroundColor: '#DCDCDC'},
  buttonPressed: {opacity: 0.8},
  buttonText: {color: colors.white, fontSize: 14, fontWeight: '500'},
  buttonTextDisabled: {color: colors.grayMid},
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTitle: {fontSize: 16, fontWeight: '700', color: colors.black},
  link: {color: colors.black, fontWeight: '600'},
  linkDisabled: {color: colors.grayOutline},
  logRow: {
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grayOutline,
  },
  mono: {fontFamily: 'monospace', fontSize: 12, color: colors.black},
});
