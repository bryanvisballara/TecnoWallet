#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetCalendarSync, NSObject)
RCT_EXTERN_METHOD(writeSnapshot:(NSString *)json)
@end
