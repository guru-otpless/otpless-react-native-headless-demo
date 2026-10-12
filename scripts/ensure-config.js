// Runs on `npm install`: creates config/otpless_config.json from the example
// so the app (and Gradle) always find a config file. Never overwrites it.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'config');
const target = path.join(dir, 'otpless_config.json');
if (!fs.existsSync(target)) {
  fs.copyFileSync(path.join(dir, 'otpless_config.example.json'), target);
  console.log('Created config/otpless_config.json. Run ./scripts/configure.sh YOUR_APP_ID');
}
