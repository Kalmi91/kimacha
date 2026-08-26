import { Stack } from 'expo-router';

// GAMES.md 3.: "app/games/<id>.tsx, egy képernyő, a tabs-on kívül (mint
// app/spelling.tsx)". Every game screen draws its own GameShell header, so
// this nested stack (mirroring app/(tabs)/_layout.tsx's own pattern) hides the
// default navigator header for the whole group in one place instead of
// per-screen options.
export default function GamesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
