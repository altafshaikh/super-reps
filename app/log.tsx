import { Redirect } from 'expo-router';

/** Old tab route was `/log`; workouts live at `/(tabs)/workouts` now. */
export default function LegacyLogRedirect() {
  return <Redirect href="/(tabs)/workouts" />;
}
