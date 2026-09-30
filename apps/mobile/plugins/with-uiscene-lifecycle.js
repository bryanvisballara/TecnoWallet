const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const SCENE_DELEGATE = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions)
    appDelegate.window = window
    self.window = window

    for context in connectionOptions.urlContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      _ = RCTLinkingManager.application(
        UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    VoiceCommandBridge.deliverIfNeeded(UIApplication.shared)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

function adoptSceneLifecycle(source) {
  if (source.includes('class SceneDelegate')) return source;

  if (!source.includes('var launchOptions:')) {
    source = source.replace(
      /var reactNativeFactory: RCTReactNativeFactory\?\n/,
      'var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
    );
  }

  source = source.replace(
    /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\n#endif\n/,
    '\n    self.launchOptions = launchOptions\n',
  );

  // Template without the os() guard.
  source = source.replace(
    /\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\n/,
    '\n    self.launchOptions = launchOptions\n',
  );

  if (!source.includes('self.launchOptions = launchOptions')) {
    source = source.replace(
      /reactNativeFactory = factory\n/,
      'reactNativeFactory = factory\n    self.launchOptions = launchOptions\n',
    );
  }

  source = `${source.trimEnd()}\n${SCENE_DELEGATE}`;
  return source;
}

module.exports = function withUiSceneLifecycle(config) {
  config = withInfoPlist(config, (result) => {
    result.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return result;
  });

  return withAppDelegate(config, (result) => {
    if (result.modResults.language !== 'swift') return result;
    result.modResults.contents = adoptSceneLifecycle(result.modResults.contents);
    return result;
  });
};
