import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors} from './theme';

/** Shown while config/otpless_config.json still has the placeholder App ID. */
export function SetupRequiredScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add your OTPLESS App ID</Text>
        <Text style={styles.body}>
          1. Copy your App ID from the OTPLESS dashboard.
        </Text>
        <Text style={styles.body}>2. From the project root run:</Text>
        <View style={styles.code}>
          <Text style={styles.mono}>./scripts/configure.sh YOUR_APP_ID</Text>
        </View>
        <Text style={styles.body}>
          3. Rebuild the app (npm run android / npm run ios). The deep-link
          scheme is native config, so a JS reload is not enough.
        </Text>
        <Text style={styles.body}>
          See README.md for what the script changes on Android and iOS.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.white},
  content: {padding: 24, gap: 12},
  title: {fontSize: 22, fontWeight: '600', color: colors.black},
  body: {fontSize: 15, color: colors.black},
  code: {backgroundColor: colors.graySurface, padding: 12, borderRadius: 6},
  mono: {fontFamily: 'monospace', color: colors.black},
});
