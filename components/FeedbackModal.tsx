import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, Pressable, TextInput, Modal, Share, Platform, Keyboard } from 'react-native';
import { Text } from '@/components/KText';
import { TitleText, themedInputStyle } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { dismissKeyboardOnTap } from '@/lib/keyboardTap';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, BrutalButton } from '@/components/grammar/Brutal';
import CheckMark from '@/components/CheckMark';
import { t } from '@/lib/i18n';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { feedbackBuildTag } from '@/lib/appBuild';
import { IS_PLAY_BUILD, FEEDBACK_URL } from '@/lib/buildFlavor';
import { FeedbackHeaderContext } from '@/lib/feedbackHeader';
import { HEADER_CHIP } from '@/components/learn/pcicStyles';
import { loadSession } from '@/lib/cloud/session';

// Maintainer: "if feedback comes from the web, show the account it was sent from".
// Web only: the APK has no cloud account, its rows stay as they were. A web visitor
// who has not signed in is "guest", so a web row is never mistaken for an APK row.
function feedbackUser(): string | null {
  if (Platform.OS !== 'web') return null;
  return loadSession()?.name ?? 'guest';
}

interface Props {
  level: string;
  languagePair: string;
  currentCard: string;
  // 'corner' (default, the standard): the Learn card's 💬 (the level chip's size) in the screen's top right corner, inside
  //   the screen's top edge (the root StatusBarStrip already keeps the status bar clear); a screen with its own top row keeps that row clear of it.
  // 'header': in the right end of the tab navigator's header (headerRight); with no navigator around (a test) it sits
  //   in the corner instead. 'inline': the same button in the normal layout flow, at the right end of the screen's own
  //   top row (the Learn tab, the neo-brutalist Course tab).
  placement?: 'corner' | 'header' | 'inline';
}

// `corner`: the standard top right placement, also the 'header' button of a screen without a navigator header around it.
type Slot = 'inline' | 'corner';

// The modal's box is a BrutalBox on the brutalist palette, today's card on the classic palette.
function ModalBox({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox testID="feedback-modal" style={styles.brutalModalOuter} boxStyle={styles.brutalModal}>
        {children}
      </BrutalBox>
    );
  }
  return <View style={[styles.modal, { backgroundColor: g.paper }]}>{children}</View>;
}

function FeedbackControl({ level, languagePair, currentCard, slot }: Omit<Props, 'placement'> & { slot: Slot }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const [visible, setVisible] = useState(false);
  // The modal is its own window on Android: its field asks for the keyboard only once that window is up (onShow),
  // a request before that was not served and the keyboard stayed up on a dead connection (11-25).
  const [shown, setShown] = useState(false);
  const hide = () => { setVisible(false); setShown(false); };
  const inputRef = useRef<TextInput>(null);
  useFocusOnNewCard(inputRef, visible && shown, 'feedback');

  // Phone, 11-25: with the card's keyboard up, the letters typed into the opened modal reached only Gboard's
  // suggestion bar, the field stayed empty and Send grey. So that keyboard is closed first, the modal opens once it is down.
  const open = () => {
    if (!Keyboard.isVisible()) { setVisible(true); return; }
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      sub.remove();
      clearTimeout(fallback);
      setVisible(true);
    };
    const sub = Keyboard.addListener('keyboardDidHide', go);
    const fallback = setTimeout(go, 600);
    Keyboard.dismiss();
  };
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [sendError, setSendError] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    setSendError(false);

    // User feedback: "set it up so that when you get feedback you can see
    // which card and which version of Kimacha it comes from". The card was
    // already sent; the build is new. It goes out twice on purpose: `appVersion`
    // is its own field for when the Apps Script grows a column, and the tag is
    // prefixed to `currentCard` so it shows up in the CURRENT sheet, whose
    // script only writes the five existing columns.
    const build = feedbackBuildTag();

    if (IS_PLAY_BUILD) {
      // Play cut: no server call (lib/buildFlavor.ts); the learner's own
      // share sheet sends the text wherever they pick (most often e-mail).
      try {
        await Share.share({ message: `${build} · ${currentCard}\n\n${text.trim()}` });
      } catch {
        // a share-sheet error ends like a dismissed sheet: there is no server answer to wait for, the form closes as after a send
      }
    } else {
      // The account rides in Current Card next to the build, for the same reason
      // (the script writes five columns); `user` is its own field for later.
      const user = feedbackUser();
      const tag = user ? `${build} · user:${user}` : build;
      const payload = {
        timestamp: new Date().toISOString(),
        level,
        languagePair,
        currentCard: `${tag} · ${currentCard}`,
        feedbackText: text.trim(),
        appVersion: build,
        ...(user ? { user } : {}),
      };

      // Offline or a non-2xx answer: keep the typed text and show an error
      // instead of the thank-you toast (the text would be lost otherwise).
      // POST body, not the query string: the free text stays out of the URL
      // (length limit, server logs). `text/plain` JSON is the Apps Script
      // `doPost(e)` way: it is a CORS-safelisted type, so no preflight (the
      // web build) that the script could not answer.
      let failed = false;
      try {
        // FEEDBACK_URL is null only in the Play flavor, which never gets here.
        const res = await fetch(FEEDBACK_URL ?? '', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) failed = true;
      } catch {
        failed = true;
      }
      if (failed) {
        setSending(false);
        setSendError(true);
        return;
      }
    }

    setSending(false);
    setText('');
    hide();
    setShowThanks(true);
    setTimeout(() => setShowThanks(false), 2000);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.feedback.button}
        hitSlop={4}
        style={[
          styles.slot,
          slot === 'corner' && styles.corner,
          { backgroundColor: colors.tint },
          g.brutal && styles.brutalSlot,
        ]}
        onPress={open}
      >
        {g.brutal ? (
          // A square BrutalBox with the fill instead of the circle; the offset is the Learn level chip's, so the shadows match.
          <BrutalBox testID="feedback-fab" fill="a" offset={2} boxStyle={styles.brutalSlotBox}>
            <Text style={styles.slotText}>💬</Text>
          </BrutalBox>
        ) : (
          <Text style={styles.slotText}>💬</Text>
        )}
      </Pressable>

      <Modal visible={showThanks} transparent animationType="fade">
        <View style={styles.toastOverlay}>
          {/* a checkmark drawn from the token instead of the green ✅ emoji,
              in a box with a thick ink border and an offset shadow (neo-brutalist style). */}
          <BrutalBox testID="feedback-thanks" fill="a" offset={5} boxStyle={styles.toastBox}>
            <CheckMark size={32} color={g.ink} thickness={7} />
            <Text style={[styles.toastText, { color: g.onFill }]}>{s.feedback.thanks}</Text>
          </BrutalBox>
        </View>
      </Modal>

      <Modal visible={visible} transparent animationType="fade" onShow={() => setShown(true)}>
        {/* the dimmed area around the box is the "beside" the learner
            taps, so it closes the keyboard (the modal itself stays open, Cancel
            closes that). */}
        <Pressable style={styles.overlay} onPress={dismissKeyboardOnTap}>
          <ModalBox>
            <TitleText variant="title" style={[styles.modalTitle, { color: colors.text }]}>{s.feedback.button}</TitleText>

            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
              placeholder={s.feedback.placeholder}
              placeholderTextColor={colors.tabIconDefault}
              value={text}
              onChangeText={(v) => { setText(v); setSendError(false); }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {sendError && <Text style={styles.sendError}>{s.feedback.errorTitle}</Text>}

            {g.brutal ? (
              <View style={styles.modalButtons}>
                <BrutalButton label={s.feedback.cancel} fill="paper" onPress={() => { hide(); setText(''); setSendError(false); }} style={styles.brutalModalBtn} />
                <BrutalButton label={sending ? '...' : s.feedback.send} fill="a" onPress={handleSend} disabled={!text.trim() || sending} style={styles.brutalModalBtn} />
              </View>
            ) : (
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => { hide(); setText(''); setSendError(false); }}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{s.feedback.cancel}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, { backgroundColor: (pressed || sending) ? colors.successFill : colors.tint, opacity: text.trim() ? 1 : 0.4 }]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                <Text style={[styles.modalBtnText, { color: colors.onTint }]}>{sending ? '...' : s.feedback.send}</Text>
              </Pressable>
            </View>
            )}
          </ModalBox>
        </Pressable>
      </Modal>
    </>
  );
}

export default function FeedbackButton(props: Props) {
  const { placement = 'corner', level, languagePair, currentCard } = props;
  // Set by the tabs layout around every screen; null where there is no navigator header (a test renders the screen bare).
  const setHeaderRight = useContext(FeedbackHeaderContext);
  const inHeader = placement === 'header' && setHeaderRight !== null;

  // The control lives in the navigator's header (headerRight) and carries this screen's context (level, pair, card).
  useEffect(() => {
    if (!inHeader) return;
    setHeaderRight(() => (
      <View testID="feedback-header-end" style={styles.headerEnd}>
        <FeedbackControl level={level} languagePair={languagePair} currentCard={currentCard} slot="inline" />
      </View>
    ));
  }, [inHeader, setHeaderRight, level, languagePair, currentCard]);
  useEffect(() => {
    if (!inHeader) return;
    return () => setHeaderRight(undefined);
  }, [inHeader, setHeaderRight]);

  if (inHeader) return null;
  return (
    <FeedbackControl
      level={level}
      languagePair={languagePair}
      currentCard={currentCard}
      slot={placement === 'inline' ? 'inline' : 'corner'}
    />
  );
}

const styles = StyleSheet.create({
  sendError: { color: '#EF4444', fontWeight: '600', marginBottom: 8 },
  // The Learn card's button (the level chip's size, HEADER_CHIP): in the layout flow, no shadow. The brutal holder adds the box's 2 px shadow.
  slot: { width: HEADER_CHIP.width, height: HEADER_CHIP.height, borderRadius: HEADER_CHIP.height / 2, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', top: 8, right: 8, zIndex: 100 },
  // the native header has no padding at its right end (the web one does): the button's shadow would sit on the screen edge.
  headerEnd: { marginRight: Platform.OS === 'web' ? 0 : 16 },
  brutalSlot: { width: HEADER_CHIP.width + 2, height: HEADER_CHIP.height + 2, borderRadius: 0, backgroundColor: 'transparent' },
  brutalSlotBox: { width: HEADER_CHIP.width, height: HEADER_CHIP.height, alignItems: 'center', justifyContent: 'center' },
  slotText: { fontSize: 15 },
  brutalModalOuter: {},
  brutalModal: { padding: 24 },
  brutalModalBtn: { flex: 1 },
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
  toastBox: {
    paddingHorizontal: 32,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  toastText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
