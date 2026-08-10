/** @type {import('expo/config').ExpoConfig} */
const base = require('./app.json');

// Hostinger export needs static HTML. Localhost uses SPA so Metro HMR actually updates.
const webOutput = process.env.EXPO_WEB_OUTPUT === 'static' ? 'static' : 'single';
const branchDomain =
  process.env.EXPO_PUBLIC_BRANCH_DOMAIN || 'tecnowallet.app.link';
const branchAlternateDomain =
  process.env.EXPO_PUBLIC_BRANCH_ALTERNATE_DOMAIN ||
  'tecnowallet-alternate.app.link';
const branchKey = process.env.EXPO_PUBLIC_BRANCH_KEY || '';

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
