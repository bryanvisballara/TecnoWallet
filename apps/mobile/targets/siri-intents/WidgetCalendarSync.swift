import Foundation
import WidgetKit

enum WidgetCalendarStore {
  static let suiteName = "group.com.tecnowallet.mobile"
  static let key = "calendarSnapshot"

  static func save(_ json: String) {
    let defaults = UserDefaults(suiteName: suiteName) ?? .standard
    defaults.set(json.data(using: .utf8), forKey: key)
    defaults.synchronize()
    WidgetCenter.shared.reloadTimelines(ofKind: "CalendarWidget")
    WidgetCenter.shared.reloadTimelines(ofKind: "DashboardWidget")
    WidgetCenter.shared.reloadTimelines(ofKind: "TodayEventsWidget")
    WidgetCenter.shared.reloadAllTimelines()
  }
}

@objc(WidgetCalendarSync)
final class WidgetCalendarSync: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc func writeSnapshot(_ json: String) {
    if Thread.isMainThread {
      WidgetCalendarStore.save(json)
    } else {
      DispatchQueue.main.async {
        WidgetCalendarStore.save(json)
      }
    }
  }
}
