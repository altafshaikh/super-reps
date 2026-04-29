import { Redirect } from 'expo-router';

/** Old route: CSV import moved to Profile → Import / Export. */
export default function LegacyHevyCsvRedirect() {
  return <Redirect href="/profile/import-export" />;
}
