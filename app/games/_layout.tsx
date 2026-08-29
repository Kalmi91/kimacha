import { Stack } from 'expo-router';
import { View } from 'react-native';

import GameFeedback from '@/components/GameFeedback';

// GAMES.md 3.: "app/games/<id>.tsx, egy képernyő, a tabs-on kívül (mint
// app/spelling.tsx)". Every game screen draws its own GameShell header, so
// this nested stack (mirroring app/(tabs)/_layout.tsx's own pattern) hides the
// default navigator header for the whole group in one place instead of
// per-screen options.
export default function GamesLayout() {
  // FB168: the 💬 feedback button lives here, so every game screen has it and
  // the row it sends names the game (components/GameFeedback.tsx).
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <GameFeedback />
    </View>
  );
}
