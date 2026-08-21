import AppIntents
import UIKit

enum VoiceCommandBridge {
  private static let phraseKey = "tecnowallet.pendingVoicePhrase"
  private static let listenKey = "tecnowallet.pendingVoiceListen"

  static func queuePhrase(_ phrase: String) {
    UserDefaults.standard.set(phrase, forKey: phraseKey)
    UserDefaults.standard.set(false, forKey: listenKey)
  }

  static func queueListen() {
    UserDefaults.standard.removeObject(forKey: phraseKey)
    UserDefaults.standard.set(true, forKey: listenKey)
  }

  static func consumeURL() -> URL? {
    if let phrase = UserDefaults.standard.string(forKey: phraseKey)?
      .trimmingCharacters(in: .whitespacesAndNewlines),
      !phrase.isEmpty
    {
      UserDefaults.standard.removeObject(forKey: phraseKey)
      UserDefaults.standard.set(false, forKey: listenKey)
      var components = URLComponents(string: "tecnowallet:///voice")!
      components.queryItems = [URLQueryItem(name: "text", value: phrase)]
      return components.url
    }
    if UserDefaults.standard.bool(forKey: listenKey) {
      UserDefaults.standard.set(false, forKey: listenKey)
      return URL(string: "tecnowallet:///voice")
    }
    return nil
  }

  @MainActor
  static func deliverIfNeeded(_ application: UIApplication) {
    guard let url = consumeURL() else { return }
    _ = application.delegate?.application?(application, open: url, options: [:])
  }

  @MainActor
  static func openNowIfActive(_ application: UIApplication) {
    guard application.applicationState == .active, let url = consumeURL() else { return }
    application.open(url)
  }
}

struct RegistrarMovimientoIntent: AppIntent {
  static var title: LocalizedStringResource = "Registrar movimiento"
  static var description = IntentDescription(
    "Registra un gasto o ingreso con la misma frase del dictado de TecnoWallet."
  )
  static var openAppWhenRun = true

  @Parameter(
    title: "Frase",
    requestValueDialog: IntentDialog("¿Qué movimiento quieres registrar?")
  )
  var phrase: String

  static var parameterSummary: some ParameterSummary {
    Summary("Registrar \(\.$phrase)")
  }

  func perform() async throws -> some IntentResult {
    VoiceCommandBridge.queuePhrase(phrase)
    await MainActor.run {
      VoiceCommandBridge.openNowIfActive(UIApplication.shared)
    }
    return .result()
  }
}

struct DictarMovimientoIntent: AppIntent {
  static var title: LocalizedStringResource = "Dictar movimiento"
  static var description = IntentDescription("Abre TecnoWallet y empieza a escuchar.")
  static var openAppWhenRun = true

  static var parameterSummary: some ParameterSummary {
    Summary("Dictar un movimiento")
  }

  func perform() async throws -> some IntentResult {
    VoiceCommandBridge.queueListen()
    await MainActor.run {
      VoiceCommandBridge.openNowIfActive(UIApplication.shared)
    }
    return .result()
  }
}

struct TecnoWalletShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: RegistrarMovimientoIntent(),
      phrases: [
        "Registra un movimiento en \(.applicationName)",
        "Anota un gasto en \(.applicationName)",
        "Añade un ingreso en \(.applicationName)",
        "Registra un gasto en \(.applicationName)",
      ],
      shortTitle: "Registrar",
      systemImageName: "plus.circle.fill"
    )
    AppShortcut(
      intent: DictarMovimientoIntent(),
      phrases: [
        "Habla con \(.applicationName)",
        "Dicta un gasto en \(.applicationName)",
        "Abre el dictado de \(.applicationName)",
      ],
      shortTitle: "Hablar",
      systemImageName: "mic.fill"
    )
  }
}
