import EventKit
import Foundation
import React

@objc(VoiceGhostAppleCalendar)
final class VoiceGhostAppleCalendar: NSObject {
  private lazy var eventStore = EKEventStore()

  @objc(getAuthorizationStatus:rejecter:)
  func getAuthorizationStatus(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let status = EKEventStore.authorizationStatus(for: .event)
    resolve(Self.statusString(for: status))
  }

  @objc(requestWriteAccess:rejecter:)
  func requestWriteAccess(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let existingStatus = EKEventStore.authorizationStatus(for: .event)
    if Self.canWriteEvents(with: existingStatus) {
      resolve([
        "granted": true,
        "status": Self.statusString(for: existingStatus),
      ])
      return
    }

    let completion = { [weak self] (granted: Bool, error: Error?) in
      let nextStatus = EKEventStore.authorizationStatus(for: .event)

      if let error {
        reject("calendar_permission_failed", error.localizedDescription, error)
        return
      }

      if self == nil {
        reject("calendar_permission_failed", "Calendar module unavailable", nil)
        return
      }

      resolve([
        "granted": granted,
        "status": Self.statusString(for: nextStatus),
      ])
    }

    if #available(iOS 17.0, *) {
      eventStore.requestWriteOnlyAccessToEvents(completion: completion)
    } else {
      eventStore.requestAccess(to: .event, completion: completion)
    }
  }

  @objc(saveEvent:resolver:rejecter:)
  func saveEvent(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let authorizationStatus = EKEventStore.authorizationStatus(for: .event)
    guard Self.canWriteEvents(with: authorizationStatus) else {
      resolve([
        "status": "not_authorized",
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
      return
    }

    guard let title = (payload["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
          !title.isEmpty,
          let startDateString = payload["startDate"] as? String,
          let startDate = Self.parseISODate(startDateString)
    else {
      resolve([
        "status": "invalid_input",
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
      return
    }

    let endDate = Self.parseISODate(payload["endDate"] as? String)
      ?? Calendar.current.date(byAdding: .minute, value: 30, to: startDate)
      ?? startDate

    guard let calendar = eventStore.defaultCalendarForNewEvents else {
      resolve([
        "status": "no_calendar",
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
      return
    }

    let event = EKEvent(eventStore: eventStore)
    event.calendar = calendar
    event.title = title
    event.startDate = startDate
    event.endDate = endDate
    event.timeZone = TimeZone.current

    if let reminderOffsetMinutes = payload["reminderOffsetMinutes"] as? NSNumber {
      let offset = reminderOffsetMinutes.doubleValue * -60
      event.alarms = [EKAlarm(relativeOffset: offset)]
    }

    do {
      try eventStore.save(event, span: .thisEvent)
      resolve([
        "status": "saved",
        "eventId": event.eventIdentifier as Any,
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
    } catch {
      reject("calendar_save_failed", error.localizedDescription, error)
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  private static func parseISODate(_ value: String?) -> Date? {
    guard let value, !value.isEmpty else {
      return nil
    }

    return isoDateFormatterWithFractionalSeconds.date(from: value)
      ?? isoDateFormatter.date(from: value)
  }

  private static func canWriteEvents(with status: EKAuthorizationStatus) -> Bool {
    if status == .authorized {
      return true
    }

    if #available(iOS 17.0, *) {
      return status == .fullAccess || status == .writeOnly
    }

    return false
  }

  private static func statusString(for status: EKAuthorizationStatus) -> String {
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
      if #available(iOS 17.0, *) {
        if status == .writeOnly {
          return "write_only"
        }

        if status == .fullAccess {
          return "full_access"
        }
      }

      return "not_supported"
    }
  }

  private static let isoDateFormatterWithFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  private static let isoDateFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()
}
