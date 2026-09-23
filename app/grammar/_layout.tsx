import { Stack } from 'expo-router';

// K33 (play-vágás): a szillabusz maga a Nyelvtan fül lett
// (app/(tabs)/course.tsx), ez a stack csak a leckét viszi.
export default function GrammarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[topic]" />
      {/* PLAN-play 13. lépés: the table-deck practice screen. */}
      <Stack.Screen name="deck/[topic]" />
    </Stack>
  );
}
