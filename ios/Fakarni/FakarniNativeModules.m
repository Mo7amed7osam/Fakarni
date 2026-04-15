#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FakarniLaunchBridge, NSObject)

RCT_EXTERN_METHOD(
  consumePendingLaunch:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end

@interface RCT_EXTERN_MODULE(VoiceGhostAppleCalendar, NSObject)

RCT_EXTERN_METHOD(
  getAuthorizationStatus:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  requestWriteAccess:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  saveEvent:(NSDictionary *)payload
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
