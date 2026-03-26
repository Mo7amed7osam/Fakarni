import Foundation

struct FakarniPendingExternalLaunchPayload: Codable {
  let action: String
  let source: String
  let launchNonce: String
  let spokenText: String?
}

enum FakarniIntentHandoffStore {
  private static let pendingLaunchKey = "FakarniPendingExternalLaunch"

  static func save(
    action: String,
    source: String,
    spokenText: String? = nil
  ) {
    let payload = FakarniPendingExternalLaunchPayload(
      action: action,
      source: source,
      launchNonce: UUID().uuidString,
      spokenText: spokenText
    )

    guard let data = try? JSONEncoder().encode(payload) else {
      return
    }

    UserDefaults.standard.set(data, forKey: pendingLaunchKey)
    UserDefaults.standard.synchronize()
  }

  static func consume() -> [String: Any]? {
    guard let data = UserDefaults.standard.data(forKey: pendingLaunchKey) else {
      return nil
    }

    UserDefaults.standard.removeObject(forKey: pendingLaunchKey)

    guard
      let payload = try? JSONDecoder().decode(
        FakarniPendingExternalLaunchPayload.self,
        from: data
      )
    else {
      return nil
    }

    var result: [String: Any] = [
      "action": payload.action,
      "source": payload.source,
      "launchNonce": payload.launchNonce,
    ]

    if let spokenText = payload.spokenText {
      result["spokenText"] = spokenText
    }

    return result
  }
}
