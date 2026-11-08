// /pantry → the Kitchen tab (kept so older links and habits still work).
import { Redirect } from 'expo-router';

export default function PantryRedirect() {
  return <Redirect href="/kitchen?tab=pantry" />;
}
