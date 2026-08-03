import { useEffect, useState } from 'react';
import { Platform, Pressable, StatusBar as RNStatusBar, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { getDb } from '@/lib/database';
import { nextTintIndex, tintColor } from '@/lib/statusBarTints';

// FB83: "az app tetejére szeretnék egy kékes csíkot hogy az óra a töltöttség
// látható legyen ... ha rá kattintok akkor váltson a kékek között, legyen 5
// különböző változat, és így körbe menjen".
//
// The band sits above the navigator, so the app content no longer runs under
// the system clock. Height is the status-bar inset: Android reports it, iOS
// gets the standard notch height, web has no system bar at all.
const BAND_HEIGHT =
  Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 24 : Platform.OS === 'ios' ? 47 : 0;

export default function StatusBarStrip() {
  const [tint, setTint] = useState(0);

  useEffect(() => {
    getDb().getStatusBarTint().then(setTint).catch(() => {});
  }, []);

  const cycle = () => {
    const next = nextTintIndex(tint);
    setTint(next);
    getDb().setStatusBarTint(next).catch(() => {});
  };

  if (BAND_HEIGHT === 0) return null;

  return (
    <>
      {/* Light icons: every tint in the list is a dark-enough blue. */}
      <StatusBar style="light" />
      <Pressable
        onPress={cycle}
        style={[styles.band, { height: BAND_HEIGHT, backgroundColor: tintColor(tint) }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
  },
});
