import Foundation
import React

@objc(FakarniLaunchBridge)
class FakarniLaunchBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(consumePendingLaunch:rejecter:)
  func consumePendingLaunch(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(FakarniIntentHandoffStore.consume())
  }
}
