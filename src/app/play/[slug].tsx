import { Redirect, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { NATIVE_DRILLS } from '@/components/drills/registry';
import { drillBySlug } from '@/lib/drills/catalogue';
import { hideSplash } from '@/lib/splash';

/** A native drill, pushed over the tabs from the Drills tab or a simplytk.com link. */
export default function PlayScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const drill = drillBySlug(slug);
  const Drill = NATIVE_DRILLS[slug];

  // Opened straight from a link there's no page load to wait for.
  useFocusEffect(hideSplash);

  if (!drill || !Drill) {
    return <Redirect href={{ pathname: '/page', params: { path: `/${slug}` } }} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: drill.title }} />
      <Drill />
    </>
  );
}
