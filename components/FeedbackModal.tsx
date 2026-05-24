import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, Modal, Alert, Platform } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { t } from '@/lib/i18n';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbz2ziRYVpdLcQO1fI10CpbAO7l3bqUFZMxfwBTNxVsc19tRAfE8mGAg01JJscB2fRt6/exec';

interface Props {
  level: string;
  languagePair: string;
  currentCard: string;
}

export default function FeedbackButton({ level, languagePair, currentCard }: Props) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const s = t();

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

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

    if (Platform.OS === 'web') {
      alert(s.feedback.thanks);
    } else {
      Alert.alert('', s.feedback.thanks);
    }
  };

  return (
    <>
      <Pressable
        style={[styles.feedbackBtn, { backgroundColor: colors.card, borderColor: colors.tabIconDefault }]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.feedbackBtnText, { color: colors.tabIconDefault }]}>{s.feedback.button}</Text>
      </Pressable>

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
                style={[styles.modalBtn, { backgroundColor: colors.tint, opacity: text.trim() ? 1 : 0.4 }]}
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
  feedbackBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  feedbackBtnText: {
    fontSize: 13,
    fontWeight: '500',
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
});
