import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', paddingHorizontal: 8 },
  levelTag: { fontSize: 13, fontWeight: '800', width: 28, textAlign: 'right' },
  body: { padding: 16, paddingBottom: 100, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  card: { borderRadius: 14, padding: 14, gap: 6 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exampleText: { fontSize: 17, fontWeight: '600', flex: 1, lineHeight: 25 },
  exampleWhy: { fontSize: 13, lineHeight: 19 },
  speak: { fontSize: 18 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  // the brutalist SpeakButton's box row (does not stretch to the card's full width).
  readRowBrutal: { alignSelf: 'flex-start', marginTop: 12 },
  readLabel: { fontSize: 14, fontWeight: '700' },
  // User feedback: "don't make the text field so crude, one is
  // tiny and the other big". One button shape across the whole screen: the same width
  // (`alignSelf: 'stretch'`), the same height (the filled variant also has the
  // 1.5 transparent border) and the same font size. The filled and the outlined
  // button now differ in color only.
  btn: {
    marginTop: 10,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  startBtn: { marginTop: 18 },
  btnTextOnTint: { color: '#FFFFFF' },
  // neo-brutalist buttons, title (uppercase, weight 500).
  // The last button also scrolls clear of the chat button (FAB).
  brutalPad: { paddingBottom: 130 },
  brutalBack: { paddingVertical: 4, paddingHorizontal: 10 },
  brutalTitle: { fontWeight: '500', textTransform: 'uppercase' },
  brutalBtnWrap: { marginTop: 10, alignSelf: 'stretch' },
  brutalBtn: { paddingVertical: 14, alignItems: 'center' },
  brutalBtnText: { fontSize: 16, fontWeight: '500', textTransform: 'uppercase', textAlign: 'center' },
  brutalDoneBody: { padding: 16, paddingBottom: 130, gap: 12 },
  brutalScoreBox: { padding: 24, alignItems: 'center', gap: 6 },
  brutalScore: { fontSize: 56, fontWeight: '500' },
  brutalNote: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  brutalComboPos: { position: 'absolute', top: -14, right: -8 },
  brutalStats: { flexDirection: 'row', gap: 10 },
  brutalStatWrap: { flex: 1 },
  brutalStat: { paddingVertical: 12, alignItems: 'center', gap: 2 },
  brutalStatValue: { fontSize: 20, fontWeight: '500' },
  brutalStatLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase' },
  brutalProgressBox: { padding: 14, gap: 8 },
  brutalMiss: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
  brutalUnderline: { fontSize: 14, fontWeight: '500', textTransform: 'uppercase', textDecorationLine: 'underline' },
  ghostBtn: { marginTop: 12, padding: 8 },
  ghostBtnText: { fontSize: 14 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 60, paddingHorizontal: 30, lineHeight: 22 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  doneEmoji: { fontSize: 56 },
  doneScore: { fontSize: 34, fontWeight: '800' },
  doneNote: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  // the cumulative "So far: NN%" line, under the score and the "done" message.
  lessonPercentNote: { fontSize: 12, textAlign: 'center', marginTop: -6, marginBottom: 12 },
  // the same line style, under each kind's own button.
  kindPercentNote: { fontSize: 12, textAlign: 'center', marginTop: 2 },
  // the line under the lesson-test button, and the lesson page's "Test passed" mark.
  lessonTestNote: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  testPassedNote: { fontSize: 14, fontWeight: '700', marginTop: 10 },
});
