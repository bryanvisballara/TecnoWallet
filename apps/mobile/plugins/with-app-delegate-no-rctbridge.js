const { withAppDelegate, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * RN 0.86 / New Architecture: RCTBridge is not visible to Swift AppDelegate.
 * Keep only bundleURL(); drop the legacy sourceURL(for bridge:) override so
 * prebuild + Xcode builds succeed on Xcode 26.
 *
 * Also ensure Debug bundleURL sets jsLocation for physical devices (localhost
 * does not work on device), and disable the top "Downloading…" DevLoadingView.
 */
module.exports = function withAppDelegateNoRctBridge(config) {
  config = withAppDelegate(config, (result) => {
    if (result.modResults.language !== 'swift') return result;

    let source = result.modResults.contents;
    if (source.includes('sourceURL(for bridge: RCTBridge)')) {
      source = source.replace(
        /\n\s*override func sourceURL\(for bridge: RCTBridge\) -> URL\? \{[\s\S]*?\n\s*\}\n/,
        '\n',
      );
    }

    // Inject LAN Metro host helper if still using the stock DEBUG bundleURL.
    if (
      source.includes('jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")') &&
      !source.includes('settings.jsLocation')
    ) {
      source = source.replace(
        /override func bundleURL\(\) -> URL\? \{\n#if DEBUG\n\s*return RCTBundleURLProvider\.sharedSettings\(\)\.jsBundleURL\(forBundleRoot: "\.expo\/\.virtual-metro-entry"\)\n#else/,
        `override func bundleURL() -> URL? {\n#if DEBUG\n    let settings = RCTBundleURLProvider.sharedSettings()\n    if settings.jsLocation == nil || settings.jsLocation?.isEmpty == true {\n      settings.jsLocation = "192.168.1.56"\n    }\n    return settings.jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")\n#else`,
      );
    }

    // Hide native Metro "Downloading…" banner (DEBUG only).
    if (!source.includes('RCTDevLoadingViewSetEnabled')) {
      source = source.replace(
        /didFinishLaunchingWithOptions launchOptions[^\n]*\n\s*\) -> Bool \{\n/,
        (match) =>
          `${match}    // Hide the top "Downloading…" / Metro loading banner in Debug builds.\n#if DEBUG\n    RCTDevLoadingViewSetEnabled(false)\n#endif\n\n`,
      );
    }

    result.modResults.contents = source;
    return result;
  });

  return withDangerousMod(config, [
    'ios',
    async (result) => {
      const projectRoot = result.modRequest.projectRoot;
      const projectName = result.modRequest.projectName || 'TecnoWallet';
      const candidates = [
        path.join(projectRoot, 'ios', 'TecnoWallet', 'TecnoWallet-Bridging-Header.h'),
        path.join(projectRoot, 'ios', projectName, `${projectName}-Bridging-Header.h`),
      ];
      for (const headerPath of candidates) {
        if (!fs.existsSync(headerPath)) continue;
        let header = fs.readFileSync(headerPath, 'utf8');
        if (!header.includes('RCTDevLoadingViewSetEnabled.h')) {
          header = `${header.trimEnd()}\n#import <React/RCTDevLoadingViewSetEnabled.h>\n`;
          fs.writeFileSync(headerPath, header);
        }
        break;
      }
      return result;
    },
  ]);
};
