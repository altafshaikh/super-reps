import { Redirect } from 'expo-router';

/** Root URL loads the app shell; email links should use `/login` (see `authEmailConfirmationRedirectURL`). */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
