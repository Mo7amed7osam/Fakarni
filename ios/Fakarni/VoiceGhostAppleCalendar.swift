import EventKit
import Foundation
import React

@objc(VoiceGhostAppleCalendar)
class VoiceGhostAppleCalendar: NSObject {
  private let eventStore = EKEventStore()

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(getAuthorizationStatus:rejecter:)
  func getAuthorizationStatus(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(authorizationStatusLabel())
  }

  @objc(requestWriteAccess:rejecter:)
  func requestWriteAccess(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 17.0, *) {
      eventStore.requestWriteOnlyAccessToEvents { granted, error in
        if let error {
          reject("calendar_permission_failed", error.localizedDescription, error)
          return
        }

        resolve([
          "granted": granted,
          "status": self.authorizationStatusLabel(),
        ])
      }
      return
    }

    eventStore.requestAccess(to: .event) { granted, error in
      if let error {
        reject("calendar_permission_failed", error.localizedDescription, error)
        return
      }

      resolve([
        "granted": granted,
        "status": self.authorizationStatusLabel(),
      ])
    }
  }

  @objc(saveEvent:resolver:rejecter:)
  func saveEvent(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard canSaveEvents() else {
      resolve([
        "status": "not_authorized",
        "authorizationStatus": authorizationStatusLabel(),
      ])
      return
    }

    guard
      let title = payload["title"] as? String,
      !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      let startDateValue = payload["startDate"] as? String,
      let startDate = isoDate(from: startDateValue)
    else {
      resolve([
        "status": "invalid_input",
        "authorizationStatus": authorizationStatusLabel(),
      ])
      return
    }

    let endDate: Date
    if
      let endDateValue = payload["endDate"] as? String,
      let parsedEndDate = isoDate(from: endDateValue),
      parsedEndDate > startDate
    {
      endDate = parsedEndDate
    } else {
      endDate = startDate.addingTimeInterval(30 * 60)
    }

    guard let calendar = eventStore.defaultCalendarForNewEvents else {
      resolve([
        "status": "no_calendar",
        "authorizationStatus": authorizationStatusLabel(),
      ])
      return
    }

    let event = EKEvent(eventStore: eventStore)
    event.calendar = calendar
    event.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
    event.startDate = startDate
    event.endDate = endDate
    event.timeZone = TimeZone.current

    let reminderOffsetMinutes = (payload["reminderOffsetMinutes"] as? NSNumber)?.doubleValue ?? 0
    if reminderOffsetMinutes == 0 {
      event.alarms = [EKAlarm(absoluteDate: startDate)]
    } else if reminderOffsetMinutes > 0 {
      event.alarms = [EKAlarm(relativeOffset: -(reminderOffsetMinutes * 60))]
    }

    do {
      try eventStore.save(event, span: .thisEvent, commit: true)

      var response: [String: Any] = [
        "status": "saved",
        "authorizationStatus": authorizationStatusLabel(),
      ]
      if let eventId = event.eventIdentifier {
        response["eventId"] = eventId
      }

      resolve(response)
    } catch {
      reject("calendar_event_save_failed", error.localizedDescription, error)
    }
  }

  private func isoDate(from value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    if let exact = formatter.date(from: value) {
      return exact
    }

    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value)
  }

  private func canSaveEvents() -> Bool {
    let status = authorizationStatusLabel()
    return status == "authorized" || status == "write_only" || status == "full_access"
  }

  private func authorizationStatusLabel() -> String {
    if #available(iOS 17.0, *) {
      let status = EKEventStore.authorizationStatus(for: .event)
      switch status {
      case .notDetermined:
        return "not_determined"
      case .restricted:
        return "restricted"
      case .denied:
        return "denied"
      case .fullAccess:
        return "full_access"
      case .writeOnly:
        return "write_only"
      @unknown default:
        return "not_determined"
      }
    }

    let status = EKEventStore.authorizationStatus(for: .event)
    switch status {
    case .notDetermined:
      return "not_determined"
    case .restricted:
      return "restricted"
    case .denied:
      return "denied"
    case .authorized:
      return "authorized"
    @unknown default:
      return "not_determined"
    }
  }
}
