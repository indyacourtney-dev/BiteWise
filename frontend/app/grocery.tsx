// /grocery → the Kitchen tab's grocery list (kept so older links still work).
import { Redirect } from 'expo-router';

export default function GroceryRedirect() {
  return <Redirect href="/kitchen?tab=grocery" />;
}
