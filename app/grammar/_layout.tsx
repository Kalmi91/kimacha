import { Stack } from 'expo-router';

// The syllabus itself became the Grammar tab
// (app/(tabs)/course.tsx), this stack only carries the lesson.
export default function GrammarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* the random grammar round; the static route comes before [topic]. */}
      <Stack.Screen name="random" />
      {/* the level test (an endless stream from one level, FB571). */}
      <Stack.Screen name="level-test" />
      {/* the exam round (two gap texts built around the weakest topics). */}
      <Stack.Screen name="exam-round" />
      {/* the German tense drill. */}
      <Stack.Screen name="tense-drill" />
      <Stack.Screen name="[topic]" />
      {/* the table-deck practice screen. */}
      <Stack.Screen name="deck/[topic]" />
    </Stack>
  );
}
