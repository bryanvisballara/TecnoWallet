/** @type {import('expo/config').ExpoConfig} */
const fs = require('fs');
const path = require('path');
const base = require('./app.json');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '../../.env'));

// Hostinger export needs static HTML. Localhost uses SPA so Metro HMR actually updates.
const webOutput = process.env.EXPO_WEB_OUTPUT === 'static' ? 'static' : 'single';
const branchDomain =
  process.env.EXPO_PUBLIC_BRANCH_DOMAIN || 'tecnowallet.app.link';
const branchAlternateDomain =
  process.env.EXPO_PUBLIC_BRANCH_ALTERNATE_DOMAIN ||
  'tecnowallet-alternate.app.link';
const branchKey = process.env.EXPO_PUBLIC_BRANCH_KEY || '';
const revenueCatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || '';

const plugins = [...base.expo.plugins];
if (branchKey) {
  plugins.push([
    '@config-plugins/react-native-branch',
    {
      apiKey: branchKey,
      iosAppDomain: branchDomain,
      iosUniversalLinkDomains: [
        branchDomain,
        branchAlternateDomain,
        'tecnowallet.test-app.link',
      ],
    },
  ]);
  plugins.push('./plugins/with-branch-native-link');
}

module.exports = {
  expo: {
    ...base.expo,
    extra: {
      ...(base.expo.extra ?? {}),
      revenueCatIosApiKey,
    },
    ios: {
      ...base.expo.ios,
      associatedDomains: [
        'applinks:tecnowallet.app',
        `applinks:${branchDomain}`,
        `applinks:${branchAlternateDomain}`,
      ],
    },
    android: {
      ...base.expo.android,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'tecnowallet.app',
              pathPrefix: '/r',
            },
            {
              scheme: 'https',
              host: branchDomain,
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins,
    web: {
      ...base.expo.web,
      output: webOutput,
    },
  },
};
