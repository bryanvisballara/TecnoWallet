const { withAppDelegate } = require('@expo/config-plugins');

/**
 * Branch NativeLink checks the pasteboard once on first install so an iOS
 * App Store hop can retain the referral. It is enabled only when Branch is
 * configured and is applied to generated Swift AppDelegate files.
 */
module.exports = function withBranchNativeLink(config) {
  return withAppDelegate(config, (result) => {
    if (result.modResults.language !== 'swift') return result;
    let source = result.modResults.contents;
    if (!source.includes('import RNBranch')) {
      source = source.replace(
        /import Expo(?:\r?\n)/,
        (match) => `${match}import RNBranch\n`,
      );
    }
    if (
      !source.includes('RNBranch.branch.checkPasteboardOnInstall()') &&
      source.includes('return super.application(')
    ) {
      source = source.replace(
        /(\s+)return super\.application\(/,
        '$1RNBranch.branch.checkPasteboardOnInstall()$1return super.application(',
      );
    }
    result.modResults.contents = source;
    return result;
  });
};
