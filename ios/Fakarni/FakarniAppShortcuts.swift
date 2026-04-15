import AppIntents
import Foundation

@available(iOS 16.0, *)
private struct StartVoiceReminderIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Voice Reminder"
  static let description = IntentDescription(
    "Open Fakarni and jump straight into voice reminder recording."
  )
  static let openAppWhenRun = true

  func perform() async throws -> some IntentResult & ProvidesDialog {
    FakarniPendingExternalLaunchStore.store(
      action: "start_recording",
      source: "siri_record"
    )

    return .result(
      dialog: IntentDialog("Opening Fakarni to start recording.")
    )
  }
}

@available(iOS 16.0, *)
struct FakarniAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    [
      AppShortcut(
        intent: StartVoiceReminderIntent(),
        phrases: [
          "Create a reminder in \(.applicationName)",
          "Start a reminder in \(.applicationName)",
          "Record a reminder in \(.applicationName)",
        ],
        shortTitle: "Voice Reminder",
        systemImageName: "mic.circle"
      ),
    ]
  }
}
