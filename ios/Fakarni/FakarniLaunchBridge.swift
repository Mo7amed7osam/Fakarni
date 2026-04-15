import Foundation
import React

@objc(FakarniLaunchBridge)
final class FakarniLaunchBridge: NSObject {
  @objc(consumePendingLaunch:rejecter:)
  func consumePendingLaunch(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(FakarniPendingExternalLaunchStore.consume()?.bridgePayload)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }
}
