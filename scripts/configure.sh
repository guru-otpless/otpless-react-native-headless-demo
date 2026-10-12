#!/usr/bin/env bash
# Sets the OTPLESS App ID for the demo app on all platforms.
#
#   ./scripts/configure.sh YOUR_APP_ID
#
# Writes:
#   config/otpless_config.json  read by App.tsx, and by
#                               android/app/build.gradle for the deep-link
#                               scheme  otpless.<appid lowercase>
#   ios/OtplessHeadlessDemo/Info.plist
#                               URL scheme  otpless.<appid lowercase>
set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: $0 YOUR_APP_ID" >&2
  exit 1
fi

APP_ID="$1"
if [[ ! "$APP_ID" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "App ID should contain only letters and digits, got: $APP_ID" >&2
  exit 1
fi
APP_ID_LOWER="$(echo "$APP_ID" | tr '[:upper:]' '[:lower:]')"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$ROOT/ios/OtplessHeadlessDemo/Info.plist"

printf '{ "appId": "%s" }\n' "$APP_ID" > "$ROOT/config/otpless_config.json"
# sed (not PlistBuddy) so the comments in Info.plist are kept.
sed -i.bak -E "s#<string>otpless\.[a-z0-9_]+</string>#<string>otpless.$APP_ID_LOWER</string>#" "$PLIST" && rm -f "$PLIST.bak"

echo "OTPLESS App ID set to $APP_ID"
echo "  Deep-link scheme: otpless.$APP_ID_LOWER://otpless"
echo "Now rebuild: npm run android   (or: cd ios && pod install && cd .. && npm run ios)"
