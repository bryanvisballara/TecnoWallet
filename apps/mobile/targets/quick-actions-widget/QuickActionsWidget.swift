import SwiftUI
import WidgetKit

struct QuickActionsEntry: TimelineEntry {
  let date: Date
}

struct QuickActionsProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuickActionsEntry {
    QuickActionsEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (QuickActionsEntry) -> Void) {
    completion(QuickActionsEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QuickActionsEntry>) -> Void) {
    completion(Timeline(entries: [QuickActionsEntry(date: Date())], policy: .never))
  }
}

struct QuickActionsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "QuickActionsWidget", provider: QuickActionsProvider()) { _ in
      QuickActionsView()
    }
    .configurationDisplayName("TecnoWallet")
    .description("Ingreso, gasto o dictado en un toque.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

private enum WidgetTheme {
  static let navy = Color(red: 0.07, green: 0.11, blue: 0.20)
  static let navyMid = Color(red: 0.10, green: 0.16, blue: 0.28)
  static let card = Color(red: 0.05, green: 0.08, blue: 0.15).opacity(0.92)
  static let muted = Color(red: 0.62, green: 0.70, blue: 0.82)
  static let income = Color(red: 0.18, green: 0.80, blue: 0.44)
  static let expense = Color(red: 0.94, green: 0.27, blue: 0.27)
  static let voice = Color(red: 0.18, green: 0.52, blue: 1.0)
  static let tw = LinearGradient(
    colors: [
      Color(red: 0.42, green: 0.84, blue: 1.0),
      Color(red: 0.16, green: 0.48, blue: 0.98),
    ],
    startPoint: .topLeading,
    endPoint: .bottomTrailing
  )
}

struct QuickActionsView: View {
  private let incomeURL = URL(string: "tecnowallet:///add-transaction?type=income")!
  private let expenseURL = URL(string: "tecnowallet:///add-transaction?type=expense")!
  private let voiceURL = URL(string: "tecnowallet:///voice")!

  var body: some View {
    VStack(spacing: 7) {
      header
      HStack(spacing: 7) {
        tileLink(
          url: incomeURL,
          title: "Ingreso",
          subtitle: "Agregar",
          systemName: "arrow.down",
          tint: WidgetTheme.income
        )
        tileLink(
          url: expenseURL,
          title: "Gasto",
          subtitle: "Registrar",
          systemName: "arrow.up",
          tint: WidgetTheme.expense
        )
      }
      voiceLink
    }
    .padding(10)
    .widgetBackground()
  }

  private var header: some View {
    HStack(spacing: 7) {
      TWMark()
      Rectangle()
        .fill(Color.white.opacity(0.28))
        .frame(width: 1, height: 22)
      VStack(alignment: .leading, spacing: 1) {
        Text("TecnoWallet")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(.white)
        Text("Tu control financiero")
          .font(.system(size: 8, weight: .medium))
          .foregroundStyle(WidgetTheme.muted)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      Spacer(minLength: 0)
    }
  }

  private var voiceLink: some View {
    Link(destination: voiceURL) {
      HStack(spacing: 8) {
        iconCircle(systemName: "mic.fill", tint: WidgetTheme.voice, size: 26, glyph: 12)
        VStack(alignment: .leading, spacing: 1) {
          Text("Hablar")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(.white)
          Text("Asistente inteligente")
            .font(.system(size: 8, weight: .medium))
            .foregroundStyle(WidgetTheme.muted)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }
        Spacer(minLength: 2)
        WaveformMark()
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
      .background(recessedCard)
    }
  }

  private func tileLink(
    url: URL,
    title: String,
    subtitle: String,
    systemName: String,
    tint: Color
  ) -> some View {
    Link(destination: url) {
      VStack(spacing: 5) {
        iconCircle(systemName: systemName, tint: tint, size: 28, glyph: 13)
        VStack(spacing: 1) {
          Text(title)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
          Text(subtitle)
            .font(.system(size: 8, weight: .medium))
            .foregroundStyle(WidgetTheme.muted)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .padding(.vertical, 8)
      .background(recessedCard)
    }
  }

  private func iconCircle(systemName: String, tint: Color, size: CGFloat, glyph: CGFloat) -> some View {
    ZStack {
      Circle().fill(tint)
      Image(systemName: systemName)
        .font(.system(size: glyph, weight: .bold))
        .foregroundStyle(.white)
    }
    .frame(width: size, height: size)
    .shadow(color: tint.opacity(0.45), radius: 3, y: 1)
  }

  private var recessedCard: some View {
    RoundedRectangle(cornerRadius: 14, style: .continuous)
      .fill(WidgetTheme.card)
      .overlay(
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .stroke(Color.white.opacity(0.06), lineWidth: 1)
      )
      .shadow(color: Color.black.opacity(0.35), radius: 3, y: 2)
  }
}

private struct TWMark: View {
  var body: some View {
    ZStack {
      Text("T")
        .font(.system(size: 20, weight: .black, design: .rounded))
        .offset(x: -5)
      Text("W")
        .font(.system(size: 16, weight: .black, design: .rounded))
        .offset(x: 6, y: 2)
    }
    .foregroundStyle(WidgetTheme.tw)
    .shadow(color: Color(red: 0.25, green: 0.65, blue: 1).opacity(0.7), radius: 5)
    .frame(width: 26, height: 22)
  }
}

private struct WaveformMark: View {
  private let heights: [CGFloat] = [7, 12, 8, 16, 10, 14, 7]

  var body: some View {
    HStack(alignment: .center, spacing: 2) {
      ForEach(Array(heights.enumerated()), id: \.offset) { _, height in
        Capsule()
          .fill(WidgetTheme.voice)
          .frame(width: 2.4, height: height)
      }
    }
    .frame(height: 16)
  }
}

private extension View {
  @ViewBuilder
  func widgetBackground() -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) {
        RadialGradient(
          colors: [WidgetTheme.navyMid, WidgetTheme.navy],
          center: .center,
          startRadius: 8,
          endRadius: 140
        )
      }
    } else {
      background(
        RadialGradient(
          colors: [WidgetTheme.navyMid, WidgetTheme.navy],
          center: .center,
          startRadius: 8,
          endRadius: 140
        )
      )
    }
  }
}

struct CalendarWidgetEntry: TimelineEntry {
  let date: Date
  let eventDates: Set<String>
  let todayEvents: [WidgetCalendarEvent]
}

struct WidgetCalendarEvent: Hashable {
  let title: String
  let time: String
  let color: Color
  let kind: String
}

enum WidgetCalendarStore {
  static let suiteName = "group.com.tecnowallet.mobile"
  static let key = "calendarSnapshot"

  static func load() -> (dates: Set<String>, events: [WidgetCalendarEvent]) {
    let defaults = UserDefaults(suiteName: suiteName) ?? .standard
    guard
      let data = defaults.data(forKey: key),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return ([], [])
    }
    let dates = Set((json["dates"] as? [String]) ?? [])
    let formatter = DateFormatter()
    formatter.calendar = Calendar.current
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    let todayKey = formatter.string(from: Date())
    let rows = (json["items"] as? [[String: Any]]) ?? (json["today"] as? [[String: Any]]) ?? []
    let events = rows.compactMap { row -> WidgetCalendarEvent? in
      guard let title = row["title"] as? String, !title.isEmpty else { return nil }
      if row["completed"] as? Bool == true { return nil }
      let rawDate = (row["date"] as? String) ?? todayKey
      let dateKey = String(rawDate.prefix(10))
      if !dateKey.isEmpty && dateKey != todayKey { return nil }
      let time = (row["time"] as? String)?.trimmingCharacters(in: .whitespaces) ?? "Todo el día"
      let hex = row["color"] as? String ?? "#0878F9"
      let kind = row["type"] as? String ?? "event"
      return WidgetCalendarEvent(title: title, time: time, color: Color(hex: hex), kind: kind)
    }
    return (dates, events)
  }
}

struct CalendarWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> CalendarWidgetEntry {
    snapshot(for: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (CalendarWidgetEntry) -> Void) {
    completion(snapshot(for: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarWidgetEntry>) -> Void) {
    let now = Date()
    let midnight = Calendar.current.startOfDay(for: now)
    let next = Calendar.current.date(byAdding: .day, value: 1, to: midnight) ?? now.addingTimeInterval(3600)
    completion(Timeline(entries: [snapshot(for: now)], policy: .after(next)))
  }

  private func snapshot(for date: Date) -> CalendarWidgetEntry {
    let loaded = WidgetCalendarStore.load()
    return CalendarWidgetEntry(date: date, eventDates: loaded.dates, todayEvents: loaded.events)
  }
}

struct CalendarMonthWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CalendarWidget", provider: CalendarWidgetProvider()) { entry in
      CalendarWidgetView(entry: entry)
    }
    .configurationDisplayName("Calendario")
    .description("Mes, eventos del día y un toque para añadir.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct CalendarWidgetView: View {
  let entry: CalendarWidgetEntry

  private let calendarURL = URL(string: "tecnowallet:///calendario")!
  private let addURL = URL(string: "tecnowallet:///add-calendar-item?type=event")!

  var body: some View {
    HStack(spacing: 0) {
      Link(destination: calendarURL) {
        leftPane
      }
      rightPane
    }
    .calendarWidgetBackground()
  }

  private var leftPane: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 7) {
        TWBadge()
        Text(monthTitle(entry.date))
          .font(.system(size: 14, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
          .tracking(0.8)
        Image(systemName: "chevron.right")
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(Color.white.opacity(0.72))
        Spacer(minLength: 0)
      }
      MonthGrid(date: entry.date, eventDates: entry.eventDates)
        .frame(maxHeight: .infinity)
    }
    .padding(.leading, 12)
    .padding(.trailing, 10)
    .padding(.vertical, 11)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(CalendarPalette.navy)
  }

  private var rightPane: some View {
    ZStack(alignment: .topTrailing) {
      CalendarWaves()
      Text("Tw")
        .font(.system(size: 52, weight: .black, design: .rounded))
        .foregroundStyle(Color(hex: "#0878F9").opacity(0.07))
        .padding(.top, 2)
        .padding(.trailing, 8)
      VStack(alignment: .leading, spacing: 0) {
        Text(weekdayTitle(entry.date))
          .font(.system(size: 12, weight: .bold, design: .rounded))
          .foregroundStyle(CalendarPalette.blue)
          .tracking(1.2)
        Text(dayNumber(entry.date))
          .font(.system(size: 44, weight: .heavy, design: .rounded))
          .foregroundStyle(
            LinearGradient(
              colors: [Color(hex: "#4DA3FF"), Color(hex: "#0878F9")],
              startPoint: .top,
              endPoint: .bottom
            )
          )
          .padding(.top, -2)
        Capsule()
          .fill(CalendarPalette.blue)
          .frame(width: 28, height: 3)
          .padding(.top, 2)
          .padding(.bottom, 8)
        eventsList
        Spacer(minLength: 6)
        Link(destination: addURL) {
          addButton
        }
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(CalendarPalette.mist)
  }

  private var eventsList: some View {
    VStack(alignment: .leading, spacing: 5) {
      if entry.todayEvents.isEmpty {
        Text("Sin eventos hoy")
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(Color(red: 0.52, green: 0.58, blue: 0.66))
      } else {
        ForEach(entry.todayEvents.prefix(2), id: \.self) { event in
          HStack(spacing: 6) {
            Circle()
              .fill(event.color)
              .frame(width: 5, height: 5)
            Text(event.time)
              .font(.system(size: 10, weight: .semibold))
              .foregroundStyle(CalendarPalette.blue)
            Text(event.title)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(Color(red: 0.16, green: 0.20, blue: 0.28))
              .lineLimit(1)
          }
        }
        if entry.todayEvents.count > 2 {
          Text("+\(entry.todayEvents.count - 2) más")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(CalendarPalette.blue)
        }
      }
    }
  }

  private var addButton: some View {
    HStack(spacing: 8) {
      Image(systemName: "calendar.badge.plus")
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(CalendarPalette.blue)
        .symbolRenderingMode(.hierarchical)
      Text("Añadir evento")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(CalendarPalette.blue)
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(Color.white)
        .shadow(color: Color.black.opacity(0.08), radius: 10, y: 4)
        .shadow(color: Color(hex: "#0878F9").opacity(0.10), radius: 6, y: 2)
    )
  }

  private func monthTitle(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "es_CO")
    formatter.dateFormat = "LLLL"
    return formatter.string(from: date).uppercased()
  }

  private func weekdayTitle(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "es_CO")
    formatter.dateFormat = "EEEE"
    return formatter.string(from: date).uppercased()
  }

  private func dayNumber(_ date: Date) -> String {
    String(Calendar.current.component(.day, from: date))
  }
}

private enum CalendarPalette {
  static let navy = Color(red: 0.063, green: 0.129, blue: 0.212)
  static let mist = Color(red: 0.957, green: 0.969, blue: 0.980)
  static let blue = Color(hex: "#0878F9")
}

private struct TWBadge: View {
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 7, style: .continuous)
        .fill(
          LinearGradient(
            colors: [Color(hex: "#4DA3FF"), Color(hex: "#0878F9")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
        .shadow(color: Color(hex: "#4DA3FF").opacity(0.55), radius: 5, y: 0)
      HStack(spacing: 0) {
        Text("T")
          .offset(x: 0.5)
        Text("w")
          .offset(x: -0.5, y: 1)
      }
      .font(.system(size: 10, weight: .black, design: .rounded))
      .foregroundStyle(.white)
    }
    .frame(width: 22, height: 22)
  }
}

private struct CalendarWaves: View {
  var body: some View {
    Canvas { context, size in
      var lower = Path()
      lower.move(to: CGPoint(x: -10, y: size.height * 0.58))
      lower.addCurve(
        to: CGPoint(x: size.width + 10, y: size.height * 0.52),
        control1: CGPoint(x: size.width * 0.28, y: size.height * 0.42),
        control2: CGPoint(x: size.width * 0.68, y: size.height * 0.78)
      )
      lower.addLine(to: CGPoint(x: size.width + 10, y: size.height + 10))
      lower.addLine(to: CGPoint(x: -10, y: size.height + 10))
      lower.closeSubpath()
      context.fill(lower, with: .color(Color(hex: "#0878F9").opacity(0.055)))

      var upper = Path()
      upper.move(to: CGPoint(x: -10, y: size.height * 0.70))
      upper.addCurve(
        to: CGPoint(x: size.width + 10, y: size.height * 0.64),
        control1: CGPoint(x: size.width * 0.32, y: size.height * 0.58),
        control2: CGPoint(x: size.width * 0.72, y: size.height * 0.86)
      )
      upper.addLine(to: CGPoint(x: size.width + 10, y: size.height + 10))
      upper.addLine(to: CGPoint(x: -10, y: size.height + 10))
      upper.closeSubpath()
      context.fill(upper, with: .color(Color(hex: "#4DA3FF").opacity(0.045)))
    }
    .allowsHitTesting(false)
  }
}

private struct MonthGrid: View {
  let date: Date
  let eventDates: Set<String>
  var cellHeight: CGFloat = 20
  var dayFont: CGFloat = 10
  var weekdayFont: CGFloat = 8
  var todaySize: CGFloat = 18

  private let weekdays = ["L", "M", "X", "J", "V", "S", "D"]

  var body: some View {
    let cells = monthCells()
    VStack(spacing: 2) {
      HStack(spacing: 0) {
        ForEach(weekdays, id: \.self) { day in
          Text(day)
            .font(.system(size: weekdayFont, weight: .semibold))
            .foregroundStyle(Color.white.opacity(0.38))
            .frame(maxWidth: .infinity)
        }
      }
      .padding(.bottom, 2)
      ForEach(0..<6, id: \.self) { row in
        HStack(spacing: 0) {
          ForEach(0..<7, id: \.self) { col in
            let cell = cells[row * 7 + col]
            dayCell(cell)
              .frame(maxWidth: .infinity)
          }
        }
      }
    }
  }

  private func dayCell(_ cell: MonthCell) -> some View {
    ZStack {
      if cell.isToday {
        Circle()
          .fill(Color(hex: "#4DA3FF").opacity(0.28))
          .frame(width: todaySize + 4, height: todaySize + 4)
          .blur(radius: 2)
        Circle()
          .fill(
            LinearGradient(
              colors: [Color(hex: "#5EB0FF"), Color(hex: "#0878F9")],
              startPoint: .top,
              endPoint: .bottom
            )
          )
          .frame(width: todaySize, height: todaySize)
      }
      VStack(spacing: 1) {
        Text("\(cell.day)")
          .font(.system(size: dayFont, weight: cell.isToday ? .bold : .medium))
          .foregroundStyle(
            cell.isToday
              ? Color.white
              : (cell.inMonth ? Color.white.opacity(0.92) : Color.white.opacity(0.18))
          )
        Circle()
          .fill(cell.hasEvent && !cell.isToday ? Color(hex: "#4DA3FF") : Color.clear)
          .frame(width: 3, height: 3)
      }
    }
    .frame(height: cellHeight)
  }

  private func monthCells() -> [MonthCell] {
    var calendar = Calendar(identifier: .gregorian)
    calendar.firstWeekday = 2
    calendar.locale = Locale(identifier: "es_CO")
    let today = calendar.startOfDay(for: date)
    let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: today)) ?? today
    let weekday = calendar.component(.weekday, from: monthStart)
    let leading = (weekday + 5) % 7
    let start = calendar.date(byAdding: .day, value: -leading, to: monthStart) ?? monthStart
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.dateFormat = "yyyy-MM-dd"
    return (0..<42).map { offset in
      let dayDate = calendar.date(byAdding: .day, value: offset, to: start) ?? start
      let key = formatter.string(from: dayDate)
      return MonthCell(
        day: calendar.component(.day, from: dayDate),
        inMonth: calendar.isDate(dayDate, equalTo: today, toGranularity: .month),
        isToday: calendar.isDate(dayDate, inSameDayAs: today),
        hasEvent: eventDates.contains(key)
      )
    }
  }
}

private struct MonthCell {
  let day: Int
  let inMonth: Bool
  let isToday: Bool
  let hasEvent: Bool
}

private extension Color {
  init(hex: String) {
    let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var value: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&value)
    let r = Double((value >> 16) & 0xFF) / 255
    let g = Double((value >> 8) & 0xFF) / 255
    let b = Double(value & 0xFF) / 255
    self.init(red: r, green: g, blue: b)
  }
}

private extension View {
  func calendarWidgetBackground() -> some View {
    containerBackground(for: .widget) {
      HStack(spacing: 0) {
        CalendarPalette.navy
        CalendarPalette.mist
      }
    }
  }
}

struct DashboardWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DashboardWidget", provider: CalendarWidgetProvider()) { entry in
      DashboardWidgetView(entry: entry)
    }
    .configurationDisplayName("Panel")
    .description("Calendario, eventos e ingreso, gasto o voz.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct DashboardWidgetView: View {
  let entry: CalendarWidgetEntry

  private let calendarURL = URL(string: "tecnowallet:///calendario")!
  private let addURL = URL(string: "tecnowallet:///add-calendar-item?type=event")!
  private let incomeURL = URL(string: "tecnowallet:///add-transaction?type=income")!
  private let expenseURL = URL(string: "tecnowallet:///add-transaction?type=expense")!
  private let voiceURL = URL(string: "tecnowallet:///voice")!

  var body: some View {
    VStack(spacing: 7) {
      HStack(alignment: .top, spacing: 7) {
        Link(destination: calendarURL) {
          calendarCard
        }
        agendaCard
      }
      .frame(maxHeight: .infinity)
      actionsRow
    }
    .padding(10)
    .dashboardBackground()
  }

  private var calendarCard: some View {
    MonthGrid(
      date: entry.date,
      eventDates: entry.eventDates,
      cellHeight: 12,
      dayFont: 8,
      weekdayFont: 7,
      todaySize: 12
    )
    .padding(.horizontal, 6)
    .padding(.vertical, 6)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(dashCard)
  }

  private var agendaCard: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(weekdayTitle(entry.date))
        .font(.system(size: 9, weight: .bold, design: .rounded))
        .foregroundStyle(DashboardPalette.blue)
        .tracking(0.9)
      Text(dayNumber(entry.date))
        .font(.system(size: 22, weight: .heavy, design: .rounded))
        .foregroundStyle(
          LinearGradient(
            colors: [Color(hex: "#7EC4FF"), Color(hex: "#0878F9")],
            startPoint: .top,
            endPoint: .bottom
          )
        )
        .padding(.top, -2)
      Capsule()
        .fill(DashboardPalette.blue)
        .frame(width: 16, height: 2)
        .padding(.top, 1)
        .padding(.bottom, 4)
      eventsList
      Spacer(minLength: 4)
      Link(destination: addURL) {
        HStack(spacing: 5) {
          Image(systemName: "calendar.badge.plus")
            .font(.system(size: 10, weight: .semibold))
          Text("Añadir evento")
            .font(.system(size: 10, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
          Spacer(minLength: 0)
        }
        .foregroundStyle(DashboardPalette.blue)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Color(red: 0.06, green: 0.10, blue: 0.18))
            .overlay(
              RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(DashboardPalette.blue.opacity(0.5), lineWidth: 1)
            )
        )
      }
    }
    .padding(.horizontal, 8)
    .padding(.vertical, 6)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(dashCard)
  }

  private var eventsList: some View {
    VStack(alignment: .leading, spacing: 3) {
      if entry.todayEvents.isEmpty {
        Text("Sin eventos hoy")
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(Color.white.opacity(0.42))
      } else {
        ForEach(entry.todayEvents.prefix(1), id: \.self) { event in
          eventRow(event)
        }
        if entry.todayEvents.count > 1 {
          Text("+\(entry.todayEvents.count - 1) más")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(DashboardPalette.blue)
        }
      }
    }
  }

  private func eventRow(_ event: WidgetCalendarEvent) -> some View {
    HStack(spacing: 5) {
      Image(systemName: eventIcon(event))
        .font(.system(size: 9, weight: .semibold))
        .foregroundStyle(event.color)
        .frame(width: 12)
      VStack(alignment: .leading, spacing: 0) {
        Text(event.title)
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
        Text(event.time)
          .font(.system(size: 8, weight: .medium))
          .foregroundStyle(Color.white.opacity(0.48))
          .lineLimit(1)
      }
      Spacer(minLength: 0)
      Capsule()
        .fill(event.color)
        .frame(width: 2.5, height: 16)
    }
  }

  private var actionsRow: some View {
    HStack(spacing: 6) {
      compactAction(url: incomeURL, tint: DashboardPalette.income, symbol: "arrow.down", title: "Ingreso")
      compactAction(url: expenseURL, tint: DashboardPalette.expense, symbol: "arrow.up", title: "Gasto")
      Link(destination: voiceURL) {
        HStack(spacing: 6) {
          ZStack {
            Circle()
              .stroke(DashboardPalette.voice.opacity(0.35), lineWidth: 1.5)
              .frame(width: 26, height: 26)
            Circle()
              .fill(DashboardPalette.voice)
              .frame(width: 20, height: 20)
            Image(systemName: "mic.fill")
              .font(.system(size: 9, weight: .bold))
              .foregroundStyle(.white)
          }
          Text("Hablar")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(DashboardPalette.voice)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(dashCard)
      }
    }
  }

  private func compactAction(url: URL, tint: Color, symbol: String, title: String) -> some View {
    Link(destination: url) {
      HStack(spacing: 6) {
        ZStack {
          Circle().fill(tint)
          Image(systemName: symbol)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
        }
        .frame(width: 22, height: 22)
        .shadow(color: tint.opacity(0.45), radius: 4, y: 0)
        Text(title)
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(tint)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity)
      .padding(.vertical, 10)
      .background(dashCard)
    }
  }

  private var dashCard: some View {
    RoundedRectangle(cornerRadius: 20, style: .continuous)
      .fill(DashboardPalette.card)
      .overlay(
        RoundedRectangle(cornerRadius: 20, style: .continuous)
          .stroke(Color.white.opacity(0.06), lineWidth: 1)
      )
      .shadow(color: Color.black.opacity(0.35), radius: 5, y: 3)
  }

  private func eventIcon(_ event: WidgetCalendarEvent) -> String {
    let title = event.title.lowercased()
    if event.kind == "birthday" || title.contains("cumple") { return "gift.fill" }
    if title.contains("almuerzo") || title.contains("comida") || title.contains("cena") || title.contains("lunch") {
      return "fork.knife"
    }
    if title.contains("clase") || title.contains("curso") || title.contains("class") {
      return "graduationcap.fill"
    }
    if event.kind == "task" { return "checkmark.circle.fill" }
    return "calendar"
  }

  private func weekdayTitle(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "es_CO")
    formatter.dateFormat = "EEEE"
    return formatter.string(from: date).uppercased()
  }

  private func dayNumber(_ date: Date) -> String {
    String(Calendar.current.component(.day, from: date))
  }
}

private enum DashboardPalette {
  static let navy = Color(red: 0.043, green: 0.086, blue: 0.145)
  static let navyMid = Color(red: 0.08, green: 0.13, blue: 0.22)
  static let card = Color(red: 0.055, green: 0.09, blue: 0.145)
  static let blue = Color(hex: "#0878F9")
  static let income = Color(red: 0.18, green: 0.80, blue: 0.44)
  static let expense = Color(red: 0.94, green: 0.27, blue: 0.27)
  static let voice = Color(red: 0.55, green: 0.36, blue: 0.96)
}

private extension View {
  func dashboardBackground() -> some View {
    containerBackground(for: .widget) {
      RadialGradient(
        colors: [DashboardPalette.navyMid, DashboardPalette.navy],
        center: .center,
        startRadius: 20,
        endRadius: 260
      )
    }
  }
}

struct TodayEventsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TodayEventsWidget", provider: CalendarWidgetProvider()) { entry in
      TodayEventsWidgetView(entry: entry)
    }
    .configurationDisplayName("Hoy")
    .description("Los eventos de hoy, de un vistazo.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct TodayEventsWidgetView: View {
  let entry: CalendarWidgetEntry

  private let calendarURL = URL(string: "tecnowallet:///calendario")!
  private let addURL = URL(string: "tecnowallet:///add-calendar-item?type=event")!

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      header
      eventsBlock
    }
    .padding(10)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(calendarURL)
    .widgetBackground()
  }

  private var header: some View {
    HStack(spacing: 7) {
      TWMark()
      Rectangle()
        .fill(Color.white.opacity(0.28))
        .frame(width: 1, height: 22)
      VStack(alignment: .leading, spacing: 1) {
        Text("TecnoWallet")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(.white)
        Text("Tu control financiero")
          .font(.system(size: 8, weight: .medium))
          .foregroundStyle(WidgetTheme.muted)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      Spacer(minLength: 0)
    }
  }

  private var eventsBlock: some View {
    VStack(alignment: .leading, spacing: 5) {
      if entry.todayEvents.isEmpty {
        VStack(spacing: 6) {
          Text("Sin eventos hoy")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(WidgetTheme.muted)
          Link(destination: addURL) {
            Text("Añadir evento")
              .font(.system(size: 10, weight: .bold))
              .foregroundStyle(WidgetTheme.voice)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(recessedCard)
      } else {
        ForEach(entry.todayEvents.prefix(3), id: \.self) { event in
          eventRow(event)
        }
        if entry.todayEvents.count > 3 {
          Text("+\(entry.todayEvents.count - 3) más")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(WidgetTheme.voice)
            .padding(.leading, 2)
        }
        Spacer(minLength: 0)
      }
    }
  }

  private func eventRow(_ event: WidgetCalendarEvent) -> some View {
    HStack(spacing: 7) {
      Circle()
        .fill(event.color)
        .frame(width: 6, height: 6)
      Text(event.title)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(.white)
        .lineLimit(1)
      Spacer(minLength: 2)
      Text(event.time)
        .font(.system(size: 9, weight: .semibold))
        .foregroundStyle(WidgetTheme.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .padding(.horizontal, 8)
    .padding(.vertical, 6)
    .background(recessedCard)
  }

  private var recessedCard: some View {
    RoundedRectangle(cornerRadius: 12, style: .continuous)
      .fill(WidgetTheme.card)
      .overlay(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .stroke(Color.white.opacity(0.06), lineWidth: 1)
      )
  }
}

@main
struct QuickActionsWidgetBundle: WidgetBundle {
  var body: some Widget {
    QuickActionsWidget()
    TodayEventsWidget()
    CalendarMonthWidget()
    DashboardWidget()
  }
}
