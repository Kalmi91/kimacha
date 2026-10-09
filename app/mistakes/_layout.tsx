import { Stack } from 'expo-router';

// the "My mistakes" report + practice deck, the same
// pattern as app/grammar/_layout.tsx.
export default function MistakesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="deck" />
    </Stack>
  );
}
