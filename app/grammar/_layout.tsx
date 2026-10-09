import { Stack } from 'expo-router';

// The syllabus itself became the Grammar tab
// (app/(tabs)/course.tsx), this stack only carries the lesson.
export default function GrammarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[topic]" />
      {/* the table-deck practice screen. */}
      <Stack.Screen name="deck/[topic]" />
    </Stack>
  );
}
