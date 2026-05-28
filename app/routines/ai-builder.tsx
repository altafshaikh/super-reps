/**
 * Legacy entry point. The AI Builder is now consolidated into the unified Coach
 * tab. Any deep link, push notification, or stale router entry that lands here
 * is silently redirected to /(tabs)/ai?intent=build, preserving the original
 * "build a routine" intent.
 */

import { Redirect } from 'expo-router';

export default function AIBuilderLegacyRedirect() {
  return <Redirect href="/(tabs)/ai?intent=build" />;
}
