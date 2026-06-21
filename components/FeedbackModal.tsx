import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, Modal } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbz2ziRYVpdLcQO1fI10CpbAO7l3bqUFZMxfwBTNxVsc19tRAfE8mGAg01JJscB2fRt6/exec';

interface Props {
  level: string;
  languagePair: string;
  currentCard: string;
}

export default function FeedbackButton({ level, languagePair, currentCard }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);

    const params = new URLSearchParams({
      timestamp: new Date().toISOString(),
      level,
      languagePair,
      currentCard,
      feedbackText: text.trim(),
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
        style={styles.fab}
        onPress={() => setVisible(true)}
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
        <View style={styles.overlay}>
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
        </View>
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
