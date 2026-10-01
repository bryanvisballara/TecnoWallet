const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Android 12+ `icon_preferred` + a tall splash PNG shows a tiny strip on white.
 * Pair with expo-splash-screen android.image = square logo + brand backgroundColor.
 */
module.exports = function withAndroidSplash(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const stylesPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res/values/styles.xml',
      );
      if (!fs.existsSync(stylesPath)) return cfg;
      let xml = fs.readFileSync(stylesPath, 'utf8');
      xml = xml.replace(
        /\s*<item name="android:windowSplashScreenBehavior">icon_preferred<\/item>\s*/g,
        '\n',
      );
      fs.writeFileSync(stylesPath, xml);
      return cfg;
    },
  ]);
};
