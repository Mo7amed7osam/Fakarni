import Foundation

enum FakarniPendingExternalLaunchStore {
  private static let defaultsKey = "com.mohamedhosam.voiceghostapp.pendingExternalLaunch"

  struct Payload {
    let action: String
    let source: String
    let launchNonce: String
    let spokenText: String?

    var bridgePayload: [String: Any] {
      var payload: [String: Any] = [
        "action": action,
        "source": source,
        "launchNonce": launchNonce,
      ]

      if let spokenText, !spokenText.isEmpty {
        payload["spokenText"] = spokenText
      }

      return payload
    }
  }

  static func store(
    action: String,
    source: String,
    spokenText: String? = nil,
    launchNonce: String = UUID().uuidString
  ) {
    var payload: [String: Any] = [
      "action": action,
      "source": source,
      "launchNonce": launchNonce,
    ]

    let trimmedText = spokenText?.trimmingCharacters(in: .whitespacesAndNewlines)
    if let trimmedText, !trimmedText.isEmpty {
      payload["spokenText"] = trimmedText
    }

    UserDefaults.standard.set(payload, forKey: defaultsKey)
  }

  static func consume() -> Payload? {
    defer {
      UserDefaults.standard.removeObject(forKey: defaultsKey)
    }

    guard let rawPayload = UserDefaults.standard.dictionary(forKey: defaultsKey),
          let action = rawPayload["action"] as? String,
          let source = rawPayload["source"] as? String,
          let launchNonce = rawPayload["launchNonce"] as? String
    else {
      return nil
    }

    return Payload(
      action: action,
      source: source,
      launchNonce: launchNonce,
      spokenText: rawPayload["spokenText"] as? String
    )
  }
}
