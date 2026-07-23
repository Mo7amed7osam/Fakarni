import ActivityKit
import Foundation

// MARK: - ActivityAttributes
// This file is shared between the Main App and the Widget Extension.

public struct FakarniWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        public var title: String
        public var alarmDate: Date
        
        public init(title: String, alarmDate: Date) {
            self.title = title
            self.alarmDate = alarmDate
        }
    }

    // Fixed non-changing properties about your activity go here!
    public var alarmId: String
    
    public init(alarmId: String) {
        self.alarmId = alarmId
    }
}
