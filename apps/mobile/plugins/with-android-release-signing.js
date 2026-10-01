const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = 'TECNOWALLET_UPLOAD_SIGNING';

/** Reads android/keystore.properties for Play upload builds. */
module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    if (!contents.includes('def keystorePropertiesFile = rootProject.file("keystore.properties")')) {
      contents = contents.replace(
        /signingConfigs\s*\{/,
        `// ${MARKER}
    def keystorePropertiesFile = rootProject.file("keystore.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    }

    signingConfigs {`,
      );
    }

    if (!contents.includes('signingConfigs.release')) {
      contents = contents.replace(
        /signingConfigs\s*\{\s*debug\s*\{/,
        `signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
        debug {`,
      );
    }

    contents = contents.replace(
      /(buildTypes\s*\{\s*debug\s*\{\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.debug',
    );

    contents = contents.replace(
      /(buildTypes\s*\{\s*debug\s*\{[\s\S]*?\}\s*release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
};
