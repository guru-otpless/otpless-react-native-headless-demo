import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import config from './config/otpless_config.json';
import {DemoScreen} from './src/DemoScreen';
import {SetupRequiredScreen} from './src/SetupRequiredScreen';

// Demo only: the App ID comes from config/otpless_config.json, written by
// scripts/configure.sh. In your own app, just pass your App ID string.
const appId = (config.appId ?? '').trim();
const isConfigured = appId.length > 0 && appId !== 'YOUR_APP_ID';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {isConfigured ? <DemoScreen appId={appId} /> : <SetupRequiredScreen />}
    </SafeAreaProvider>
  );
}

export default App;
