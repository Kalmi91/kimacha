import { Stack } from 'expo-router';

// The syllabus itself became the Grammar tab
// (app/(tabs)/course.tsx), this stack only carries the lesson.
export default function GrammarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* the random grammar round; the static route comes before [topic]. */}
      <Stack.Screen name="random" />
      <Stack.Screen name="[topic]" />
      {/* the table-deck practice screen. */}
      <Stack.Screen name="deck/[topic]" />
    </Stack>
  );
}
