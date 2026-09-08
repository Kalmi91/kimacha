import { Stack } from 'expo-router';

// Az Átbeszélő al-képernyői (téma → szint → formátum) a tabs-on kívül élnek,
// mint a app/games/ csoport, és saját fejlécet rajzolnak.
export default function TalkLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
