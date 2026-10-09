import { useEffect, useState } from 'react';
import { Platform, Pressable, StatusBar as RNStatusBar, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { getDb } from '@/lib/database';
import { nextTintIndex, tintColor } from '@/lib/statusBarTints';
import { useGrammarColors } from '@/lib/grammarColors';

// "I'd like a bluish strip at the top of the app so that the clock and the battery
// level are visible ... when I tap it, it should switch between the blues, there should be 5
// different variants, and it should cycle round".
//
// The band sits above the navigator, so the app content no longer runs under
// the system clock. Height is the status-bar inset: Android reports it, iOS
// gets the standard notch height, web has no system bar at all.
const BAND_HEIGHT =
  Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 24 : Platform.OS === 'ios' ? 47 : 0;

export default function StatusBarStrip() {
  const [tint, setTint] = useState(0);
  const g = useGrammarColors();

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
        style={[
          styles.band,
          { height: BAND_HEIGHT, backgroundColor: tintColor(tint) },
          // brutalist palette: a 2.5 px ink line at the bottom of the band.
          g.brutal && { borderBottomWidth: 2.5, borderBottomColor: g.ink },
        ]}
        testID="status-bar-strip"
      />
    </>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
  },
});
