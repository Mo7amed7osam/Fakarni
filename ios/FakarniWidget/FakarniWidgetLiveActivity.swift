import ActivityKit
import WidgetKit
import SwiftUI

@main
struct FakarniWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FakarniWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text(context.state.title)
                    .font(.headline)
                Text(timerInterval: Date()...context.state.alarmDate, countsDown: true)
                    .font(.title)
                    .foregroundColor(.red)
            }
            .padding()
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "alarm")
                        .foregroundColor(.red)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Date()...context.state.alarmDate, countsDown: true)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 50)
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.title)
                        .font(.headline)
                }
            } compactLeading: {
                Image(systemName: "alarm")
                    .foregroundColor(.red)
            } compactTrailing: {
                Text(timerInterval: Date()...context.state.alarmDate, countsDown: true)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 35)
                    .font(.caption2)
                    .monospacedDigit()
            } minimal: {
                Image(systemName: "alarm")
                    .foregroundColor(.red)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}
