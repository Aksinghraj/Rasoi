import { Redirect } from 'expo-router';
import { useApp } from '@/lib/store/AppContext';

export default function Index() {
  const { state, hydrated } = useApp();

  if (!hydrated) return null;
  if (!state.session) return <Redirect href="/auth" />;
  if (!state.preferences) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
