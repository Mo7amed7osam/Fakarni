#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FakarniLaunchBridge, NSObject)

RCT_EXTERN_METHOD(
  consumePendingLaunch:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
