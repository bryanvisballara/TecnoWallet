const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { withAppDelegate, withDangerousMod } = require('@expo/config-plugins');

const BECOME_ACTIVE = `
  public override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    VoiceCommandBridge.deliverIfNeeded(application)
  }
`;

module.exports = function withSiriIntents(config) {
  config = withAppDelegate(config, (result) => {
    if (result.modResults.language !== 'swift') return result;
    let source = result.modResults.contents;
    if (!source.includes('VoiceCommandBridge.deliverIfNeeded') && source.includes('continue userActivity')) {
      source = source.replace(
        /\/\/ Universal Links\n/,
        `${BECOME_ACTIVE}\n  // Universal Links\n`,
      );
    }
    result.modResults.contents = source;
    return result;
  });

  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const script = path.join(__dirname, '..', 'ios', 'add-siri-intents.py');
      if (fs.existsSync(script)) {
        spawnSync('python3', [script], { stdio: 'inherit' });
      }
      return mod;
    },
  ]);
};
