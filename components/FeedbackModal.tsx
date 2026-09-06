import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, Modal, PanResponder, Dimensions, Keyboard } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { feedbackBuildTag } from '@/lib/appBuild';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbz2ziRYVpdLcQO1fI10CpbAO7l3bqUFZMxfwBTNxVsc19tRAfE8mGAg01JJscB2fRt6/exec';

interface Props {
  level: string;
  languagePair: string;
  currentCard: string;
  // FB41: tree tab only, lets the user drag the button to the other side of
  // the screen; the chosen side persists (learn_settings.feedback_btn_side).
  draggable?: boolean;
  // FB173: extra room under the button, for screens that dock something along the
  // bottom edge (the learn card's Check bar) which the button would otherwise cover.
  bottomOffset?: number;
}

export default function FeedbackButton({ level, languagePair, currentCard, draggable = false, bottomOffset = 0 }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (!draggable) return;
    getDb().getFeedbackBtnSide().then(setSide);
  }, [draggable]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once the finger has actually moved (|dx|>10);
      // small movements/taps fall through to the Pressable's onPress.
      onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderRelease: (evt, _gestureState) => {
        const screenWidth = Dimensions.get('window').width;
        const releasedX = evt.nativeEvent.pageX;
        const newSide: 'left' | 'right' = releasedX < screenWidth / 2 ? 'left' : 'right';
        setSide(newSide);
        getDb().setFeedbackBtnSide(newSide);
      },
    })
  ).current;

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);

    // Kálmán 2026-08-20: "állítsd be úgy hogy ha feedbackeket kapsz akkor lásd,
    // hogy melyik kártyáról és melyik verziójú kimachaból kapod". The card was
    // already sent; the build is new. It goes out twice on purpose: `appVersion`
    // is its own field for when the Apps Script grows a column, and the tag is
    // prefixed to `currentCard` so it shows up in the CURRENT sheet, whose
    // script only writes the five existing columns.
    const build = feedbackBuildTag();
    const params = new URLSearchParams({
      timestamp: new Date().toISOString(),
      level,
      languagePair,
      currentCard: `${build} · ${currentCard}`,
      feedbackText: text.trim(),
      appVersion: build,
    });

    try {
      await fetch(`${ENDPOINT}?${params.toString()}`);
    } catch {}

    setSending(false);
    setText('');
    setVisible(false);
    setShowThanks(true);
    setTimeout(() => setShowThanks(false), 2000);
  };

  return (
    <>
      <Pressable
        style={[
          styles.fab,
          draggable && (side === 'left' ? styles.fabLeft : styles.fabRight),
          bottomOffset > 0 && { bottom: 24 + bottomOffset },
        ]}
        onPress={() => setVisible(true)}
        {...(draggable ? panResponder.panHandlers : {})}
      >
        <Text style={styles.fabText}>💬</Text>
      </Pressable>

      <Modal visible={showThanks} transparent animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={[styles.toast, { backgroundColor: colors.tint }]}>
            <Text style={styles.toastEmoji}>✅</Text>
            <Text style={styles.toastText}>{s.feedback.thanks}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={visible} transparent animationType="fade">
        {/* FB143: the dimmed area around the box is the "beside" the learner
            taps, so it closes the keyboard (the modal itself stays open, Cancel
            closes that). */}
        <Pressable style={styles.overlay} onPress={() => Keyboard.dismiss()}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{s.feedback.button}</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }]}
              placeholder={s.feedback.placeholder}
              placeholderTextColor={colors.tabIconDefault}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.tabIconDefault }]}
                onPress={() => { setVisible(false); setText(''); }}
              >
                <Text style={styles.modalBtnText}>{s.feedback.cancel}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, { backgroundColor: (pressed || sending) ? '#22C55E' : colors.tint, opacity: text.trim() ? 1 : 0.4 }]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                <Text style={styles.modalBtnText}>{sending ? '...' : s.feedback.send}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  // FB41: draggable tree-tab button only, override fab's default right:24
  // to switch sides (left clears the inherited right, and vice versa).
  fabLeft: {
    left: 24,
    right: undefined,
  },
  fabRight: {
    right: 24,
    left: undefined,
  },
  fabText: {
    fontSize: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  modalBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  toastOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  toast: {
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  toastEmoji: {
    fontSize: 36,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
