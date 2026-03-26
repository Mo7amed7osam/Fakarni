import AppIntents
import Foundation

@available(iOS 16.0, *)
struct StartVoiceCaptureIntent: AppIntent {
  static var title: LocalizedStringResource = "Start Voice Capture"
  static var description = IntentDescription(
    "Open Fakarni and start recording a reminder right away."
  )
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    FakarniIntentHandoffStore.save(
      action: "start_recording",
      source: "siri_record"
    )
    return .result()
  }
}

@available(iOS 16.0, *)
struct CreateReminderFromSpokenTextIntent: AppIntent {
  static var title: LocalizedStringResource = "Create Reminder From Spoken Text"
  static var description = IntentDescription(
    "Open Fakarni with a spoken reminder phrase so it can parse and save it."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(
    title: "Reminder",
    requestValueDialog: IntentDialog("What reminder should I create?")
  )
  var spokenText: String

  static var parameterSummary: some ParameterSummary {
    Summary("Create reminder from \(\.$spokenText)")
  }

  func perform() async throws -> some IntentResult {
    FakarniIntentHandoffStore.save(
      action: "process_text",
      source: "siri_text",
      spokenText: spokenText
    )
    return .result()
  }
}

@available(iOS 16.0, *)
struct FakarniShortcuts: AppShortcutsProvider {
  static var shortcutTileColor: ShortcutTileColor = .purple

  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: StartVoiceCaptureIntent(),
      phrases: [
        "Start \(.applicationName)",
        "Open \(.applicationName) and start recording",
        "Start voice capture in \(.applicationName)",
      ],
      shortTitle: "Start Voice",
      systemImageName: "mic.fill"
    )
    AppShortcut(
      intent: CreateReminderFromSpokenTextIntent(),
      phrases: [
        "Create a reminder with \(.applicationName)",
        "Tell \(.applicationName) to create a reminder",
        "Ask \(.applicationName) to create a reminder",
      ],
      shortTitle: "Create Reminder",
      systemImageName: "text.badge.plus"
    )
  }
}
