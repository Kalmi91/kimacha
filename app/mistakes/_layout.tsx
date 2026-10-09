import { Stack } from 'expo-router';

// a "Hibáim" riport + gyakorló pakli, ugyanaz a
// mintázat, mint app/grammar/_layout.tsx.
export default function MistakesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="deck" />
    </Stack>
  );
}
