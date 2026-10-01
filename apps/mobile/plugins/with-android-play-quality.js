const {
  withAndroidManifest,
  withGradleProperties,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'TECNOWALLET_PLAY_QUALITY';
const PROGUARD_MARKER = '# TECNOWALLET_PLAY_QUALITY';

const EXTRA_PROGUARD = `
${PROGUARD_MARKER}
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.proguard.** { *; }
-keepclassmembers class * {
  @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}
-keepclassmembers class * {
  @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}
-keep class com.swmansion.reanimated.** { *; }
-keep class com.revenuecat.** { *; }
-keep class com.android.vending.billing.** { *; }
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
`;

function upsertGradleProperty(modResults, key, value) {
  const existing = modResults.find(
    (item) => item.type === 'property' && item.key === key,
  );
  if (existing) {
    existing.value = value;
  } else {
    modResults.push({ type: 'property', key, value });
  }
}

/** Play Console: R8/obfuscation, large screens, edge-to-edge styles. */
module.exports = function withAndroidPlayQuality(config) {
  config = withGradleProperties(config, (cfg) => {
    upsertGradleProperty(
      cfg.modResults,
      'android.enableMinifyInReleaseBuilds',
      'true',
    );
    upsertGradleProperty(
      cfg.modResults,
      'android.enableShrinkResourcesInReleaseBuilds',
      'true',
    );
    upsertGradleProperty(cfg.modResults, 'android.enableR8.fullMode', 'true');
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes(MARKER)) {
      contents = contents.replace(
        /getDefaultProguardFile\("proguard-android\.txt"\)/,
        `getDefaultProguardFile("proguard-android-optimize.txt") /* ${MARKER} */`,
      );
      cfg.modResults.contents = contents;
    }
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application?.[0];
    if (application) {
      application.$['android:resizeableActivity'] = 'true';
      for (const activity of application.activity ?? []) {
        if (
          activity.$['android:name'] === '.MainActivity' ||
          activity.$['android:name']?.endsWith('.MainActivity')
        ) {
          delete activity.$['android:screenOrientation'];
          activity.$['android:resizeableActivity'] = 'true';
        }
      }
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const stylesPath = path.join(root, 'app/src/main/res/values/styles.xml');
      if (fs.existsSync(stylesPath)) {
        let xml = fs.readFileSync(stylesPath, 'utf8');
        xml = xml.replace(
          /\s*<item name="android:statusBarColor">[^<]*<\/item>\s*/g,
          '\n',
        );
        xml = xml.replace(
          /\s*<item name="android:navigationBarColor">[^<]*<\/item>\s*/g,
          '\n',
        );
        fs.writeFileSync(stylesPath, xml);
      }

      const proguardPath = path.join(root, 'app/proguard-rules.pro');
      if (fs.existsSync(proguardPath)) {
        let rules = fs.readFileSync(proguardPath, 'utf8');
        if (!rules.includes(PROGUARD_MARKER)) {
          fs.writeFileSync(proguardPath, `${rules.trim()}\n${EXTRA_PROGUARD}\n`);
        }
      }

      return cfg;
    },
  ]);

  return config;
};
