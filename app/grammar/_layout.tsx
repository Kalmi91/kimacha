import { Stack } from 'expo-router';

// The grammar course lives outside the tab bar (like app/spelling.tsx): the
// syllabus is a screen you enter, work through, and leave.
export default function GrammarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[topic]" />
    </Stack>
  );
}
