#import <React/RCTBridgeModule.h>

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

RCT_EXTERN_METHOD(
  deleteEvent:(NSString *)eventId
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
