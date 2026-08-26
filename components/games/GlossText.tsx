import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { normalizeWordToken } from '@/data/words';
import type { GlossInfo } from '@/lib/games/gloss';

// GAMES.md 3.2: the "kattints rá és kiírja" half of the user's kőbe vésett
// kritérium (0. szekció). Every word is tappable; an `isNew` word additionally
// gets a dotted underline so it reads as "this one is new" before the tap.
//
// K2 DÖNTÉS: a timed game's clock pauses while the bubble is open, this
// component doesn't own a clock, it just calls onOpenGloss/onCloseGloss, the
// game screen wires those to its useGameSession().pause()/resume().

interface Props {
  text: string;
  glosses: Map<string, GlossInfo>;
  learnedLang: string;
  style?: StyleProp<TextStyle>;
  onOpenGloss?: () => void;
  onCloseGloss?: () => void;
}

export default function GlossText({ text, glosses, learnedLang, style, onOpenGloss, onCloseGloss }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [active, setActive] = useState<GlossInfo | null>(null);
  const [added, setAdded] = useState(false);

  const open = (info: GlossInfo) => {
    setActive(info);
    setAdded(false);
    onOpenGloss?.();
  };

  const close = () => {
    setActive(null);
    onCloseGloss?.();
  };

  const addToSpelling = () => {
    if (!active?.wordId) return;
    getDb().addToSpellingList(active.wordId).catch(() => {});
    setAdded(true);
  };

  const parts = text.split(/(\s+)/);

  return (
    <>
      <Text style={style}>
        {parts.map((part, i) => {
          if (!/\S/.test(part)) return part;
          const info = glosses.get(normalizeWordToken(part));
          if (!info) return part;
          return (
            <Text
              key={i}
              onPress={() => open(info)}
              suppressHighlighting
              style={
                info.isNew
                  ? { color: colors.tabIconDefault, textDecorationLine: 'underline', textDecorationStyle: 'dotted' }
                  : undefined
              }
            >
              {part}
            </Text>
          );
        })}
      </Text>

      <Modal visible={!!active} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={[styles.bubble, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.learned, { color: colors.text }]}>{active?.learned}</Text>
            <Text style={[styles.native, { color: colors.tabIconDefault }]}>{active?.native}</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.iconBtn, { borderColor: colors.tabIconDefault }]}
                onPress={() => active && speak(active.learned, speechLang(learnedLang))}
              >
                <Text style={styles.iconBtnText}>🔊</Text>
              </Pressable>
              {active?.wordId ? (
                <Pressable
                  style={[styles.spellBtn, { backgroundColor: added ? colors.tint : colors.card, borderColor: colors.tint }]}
                  onPress={addToSpelling}
                  disabled={added}
                >
                  <Text style={{ color: added ? '#FFFFFF' : colors.tint }}>{added ? '✓' : s.buttons.spelling}</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bubble: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    gap: 8,
  },
  learned: {
    fontSize: 28,
    fontWeight: '700',
  },
  native: {
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 20,
  },
  spellBtn: {
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
