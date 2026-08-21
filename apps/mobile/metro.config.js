const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch only shared packages — watching the whole monorepo root breaks HMR
// (NativeWatcher events arrive as apps/mobile/... and never invalidate the graph).
config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/contracts'),
  path.resolve(workspaceRoot, 'packages/ui'),
  path.resolve(workspaceRoot, 'packages/config'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const pushIosStub = path.resolve(
  projectRoot,
  'src/polyfills/push-notification-ios-stub.js',
);
const expoResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = typeof moduleName === 'string' ? moduleName.replace(/\\/g, '/') : '';
  if (platform === 'ios' && name.includes('PushNotificationIOS/PushNotificationIOS')) {
    return { type: 'sourceFile', filePath: pushIosStub };
  }
  if (expoResolveRequest) {
    return expoResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Eager SHA1 so file edits always invalidate the bundle graph.
config.watcher = {
  ...config.watcher,
  unstable_lazySha1: false,
  healthCheck: {
    ...(config.watcher?.healthCheck ?? {}),
    enabled: true,
  },
};

module.exports = config;
