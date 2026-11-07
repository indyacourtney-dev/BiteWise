// /planWeek → the Plan tab (kept so older links still work).
import { Redirect } from 'expo-router';

export default function PlanWeekRedirect() {
  return <Redirect href="/plan" />;
}
