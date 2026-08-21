const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('@expo/config-plugins');

/**
 * iPadOS windowing was using the iPhone 393×852 splash as the window size,
 * so the app sat in a centered phone column. Stretch the launch view, mark
 * the binary as iPhone+iPad, and require full screen.
 */
module.exports = function withIpadFullscreen(config) {
  config = withInfoPlist(config, (result) => {
    result.modResults.UIDeviceFamily = [1, 2];
    result.modResults.UIRequiresFullScreen = true;
    return result;
  });

  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const configs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const buildSettings = configs[key]?.buildSettings;
      if (buildSettings?.PRODUCT_BUNDLE_IDENTIFIER === 'com.tecnowallet.mobile') {
        buildSettings.INFOPLIST_KEY_UIRequiresFullScreen = 'YES';
        buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
      }
    }
    return mod;
  });

  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const projectName = mod.modRequest.projectName || 'TecnoWallet';
      const storyboard = path.join(
        mod.modRequest.platformProjectRoot,
        projectName,
        'SplashScreen.storyboard',
      );
      if (!fs.existsSync(storyboard)) return mod;
      let xml = fs.readFileSync(storyboard, 'utf8');
      xml = xml.replace(
        /<autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"\/>/,
        '<autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>',
      );
      xml = xml.replace(
        /<device id="retina6_12" orientation="portrait" appearance="light"\/>/,
        '<device id="ipad13_0rounded" orientation="portrait" appearance="light"/>',
      );
      xml = xml.replace(
        /<rect key="frame" x="0.0" y="0.0" width="393" height="852"\/>/g,
        '<rect key="frame" x="0.0" y="0.0" width="1024" height="1366"/>',
      );
      fs.writeFileSync(storyboard, xml);
      return mod;
    },
  ]);
};
