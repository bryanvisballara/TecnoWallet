const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { withDangerousMod } = require('@expo/config-plugins');

function copyWidgetSources(iosRoot) {
  const srcDir = path.join(__dirname, '..', 'targets', 'quick-actions-widget');
  const destDir = path.join(iosRoot, 'QuickActionsWidget');
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of ['QuickActionsWidget.swift', 'Info.plist']) {
    fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
  }
  const script = path.join(__dirname, '..', 'ios', 'add-widget-target.py');
  if (fs.existsSync(script)) {
    spawnSync('python3', [script], { stdio: 'inherit' });
  }
}

module.exports = function withQuickActionsWidget(config) {
  return withDangerousMod(config, [
    'ios',
    async (result) => {
      copyWidgetSources(path.join(result.modRequest.projectRoot, 'ios'));
      return result;
    },
  ]);
};
