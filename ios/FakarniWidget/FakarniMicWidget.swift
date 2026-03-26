import SwiftUI
import WidgetKit

private struct FakarniMicEntry: TimelineEntry {
  let date: Date
}

private struct FakarniMicProvider: TimelineProvider {
  func placeholder(in context: Context) -> FakarniMicEntry {
    FakarniMicEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (FakarniMicEntry) -> Void) {
    completion(FakarniMicEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<FakarniMicEntry>) -> Void) {
    completion(Timeline(entries: [FakarniMicEntry(date: Date())], policy: .never))
  }
}

private struct FakarniMicWidgetView: View {
  var entry: FakarniMicProvider.Entry

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [
          Color(red: 0.985, green: 0.985, blue: 1.0),
          Color(red: 0.955, green: 0.95, blue: 1.0),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      Circle()
        .fill(Color.white.opacity(0.65))
        .frame(width: 126, height: 126)
        .blur(radius: 2)

      ZStack {
        Circle()
          .fill(
            LinearGradient(
              colors: [
                Color(red: 0.47, green: 0.4, blue: 0.96),
                Color(red: 0.37, green: 0.31, blue: 0.9),
              ],
              startPoint: .topLeading,
              endPoint: .bottomTrailing
            )
          )
          .frame(width: 84, height: 84)
          .shadow(color: Color(red: 0.42, green: 0.36, blue: 0.91).opacity(0.24), radius: 14, x: 0, y: 8)

        Image(systemName: "mic.fill")
          .font(.system(size: 36, weight: .semibold))
          .foregroundColor(.white)
      }
    }
    .widgetURL(URL(string: "voiceghost://widget/mic"))
    .ifAvailableWidgetBackground()
  }
}

struct FakarniMicWidget: Widget {
  let kind = "FakarniMicWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: FakarniMicProvider()) { entry in
      FakarniMicWidgetView(entry: entry)
    }
    .configurationDisplayName("Fakarni Mic")
    .description("Tap the mic and start speaking right away.")
    .supportedFamilies([.systemSmall])
  }
}

private extension View {
  @ViewBuilder
  func ifAvailableWidgetBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) {
        Color.clear
      }
    } else {
      self
    }
  }
}
