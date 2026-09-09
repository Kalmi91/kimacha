import { Stack } from 'expo-router';
import { View } from 'react-native';

import RouteFeedback from '@/components/RouteFeedback';

// Az Átbeszélő al-képernyői (téma → szint → formátum) a tabs-on kívül élnek,
// mint a app/games/ csoport, és saját fejlécet rajzolnak.
export default function TalkLayout() {
  // FB201: a 💬 gomb itt is egyetlen mount, mint a játékoknál, és a sor az
  // útvonalról kapja a címkét (`talk:comida`, `talk:quiz`).
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <RouteFeedback />
    </View>
  );
}
