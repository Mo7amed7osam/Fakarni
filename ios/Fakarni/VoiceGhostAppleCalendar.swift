import EventKit
import Foundation
import React
import AlarmKit

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
      eventStore.requestFullAccessToEvents(completion: completion)
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

    guard
      let title = (payload["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
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

  @objc(deleteEvent:resolver:rejecter:)
  func deleteEvent(
    _ eventId: NSString,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let authorizationStatus = EKEventStore.authorizationStatus(for: .event)

    if #available(iOS 17.0, *), authorizationStatus == .writeOnly {
      eventStore.requestFullAccessToEvents { [weak self] granted, error in
        if let error {
          reject("calendar_permission_upgrade_failed", error.localizedDescription, error)
          return
        }

        guard let self else {
          reject("calendar_permission_upgrade_failed", "Calendar module unavailable", nil)
          return
        }

        let nextStatus = EKEventStore.authorizationStatus(for: .event)
        self.performDeleteEvent(
          eventId,
          authorizationStatus: nextStatus,
          resolver: resolve,
          rejecter: reject
        )
      }
      return
    }

    performDeleteEvent(
      eventId,
      authorizationStatus: authorizationStatus,
      resolver: resolve,
      rejecter: reject
    )
  }

  private func performDeleteEvent(
    _ eventId: NSString,
    authorizationStatus: EKAuthorizationStatus,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard Self.canWriteEvents(with: authorizationStatus) else {
      resolve([
        "status": "not_authorized",
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
      return
    }

    let normalizedEventId = String(eventId).trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedEventId.isEmpty else {
      resolve([
        "status": "invalid_input",
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
      return
    }

    guard let event = eventStore.event(withIdentifier: normalizedEventId) else {
      resolve([
        "status": "not_found",
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
      return
    }

    do {
      try eventStore.remove(event, span: .thisEvent)
      resolve([
        "status": "deleted",
        "authorizationStatus": Self.statusString(for: authorizationStatus),
      ])
    } catch {
      reject("calendar_delete_failed", error.localizedDescription, error)
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
    case .fullAccess:
      return "full_access"
    case .writeOnly:
      return "write_only"
    @unknown default:
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

@objc(VoiceGhostAlarmKit)
class VoiceGhostAlarmKit: NSObject {
  // ⚠️ ALARM KIT IS MOCKED ⚠️
  // This native module simulates AlarmKit authorization and scheduling.
  // The React Native side handles the actual local notifications.

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
      if #available(iOS 26.0, *) {
          Task {
              do {
                  // MOCKED: requestAuthorization does not request real permissions.
                  // It always returns true so the JS side can proceed with fallback Notifications.
                  resolve(true)
              } catch {
                  reject("ALARM_ERROR", error.localizedDescription, error)
              }
          }
      } else {
          resolve(false)
      }
  }

  @objc
  func getAuthorizationStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
      if #available(iOS 26.0, *) {
          // MOCKED: getAuthorizationStatus does not reflect real system state.
          resolve(true)
      } else {
          resolve(false)
      }
  }

  @objc
  func scheduleAlarm(_ payload: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
      if #available(iOS 26.0, *) {
          Task {
              do {
                  guard let title = payload["title"] as? String,
                        let timestamp = payload["timestamp"] as? Double else {
                      reject("INVALID_PAYLOAD", "Missing title or timestamp", nil)
                      return
                  }
                  
                  let date = Date(timeIntervalSince1970: timestamp / 1000.0)
                  
                  // AlarmKit requires specific Metadata which is complex to setup natively here
                  // We simulate the schedule for the sake of the build
                  
                  resolve(UUID().uuidString)
              } catch {
                  reject("ALARM_ERROR", error.localizedDescription, error)
              }
          }
      } else {
          reject("NOT_SUPPORTED", "AlarmKit is not supported on this iOS version.", nil)
      }
  }
  
  @objc
  func cancelAlarm(_ alarmIdString: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
      if #available(iOS 26.0, *) {
          Task {
              do {
                  guard let uuid = UUID(uuidString: alarmIdString) else {
                      reject("INVALID_ID", "Invalid alarm UUID", nil)
                      return
                  }
                  // We simulate the cancel for the sake of the build
                  resolve(true)
              } catch {
                  reject("ALARM_ERROR", error.localizedDescription, error)
              }
          }
      } else {
          resolve(false)
      }
  }
}
