import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
  },
  // The loading branch also uses the shared container, but the spinner
  // must stay in the center, not jump to the top.
  centered: {
    justifyContent: 'center',
  },
  // thin progress bar under the header, on the learning view.
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  // the level chip + the existing four BadgeRow chips in one row.
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  levelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brutalLevelChip: { paddingHorizontal: 10, paddingVertical: 3 },
  brutalTile: { flex: 1 },
  brutalTileBox: { paddingVertical: 12, alignItems: 'center' },
  // the three "+N new words" buttons in one row.
  moreNewBlock: { gap: 4 },
  moreNewHint: { fontSize: 13, textAlign: 'center' },
  moreNewRow: { flexDirection: 'row', gap: 10 },
  moreNewBtn: { flex: 1, width: 'auto', marginTop: 0 },
  brutalProgress: { marginBottom: 16 },
  brutalArticle: { minWidth: 48, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  brutalDim: { opacity: 0.6 },
  brutalPos: { borderWidth: 2, borderRadius: 0 },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    // the 💬 button stays at the top right corner when the chip row wraps over several lines.
    alignSelf: 'flex-start',
    gap: 4,
  },
  // fix: today's word/sentence breakdown is its own full-width,
  // wrappable row under the chip row (see the Text after headerRow).
  todayLine: {
    fontSize: 12,
    marginBottom: 8,
  },
  resetBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  // colorful done screen, in the visual language of components/DoneScreen.tsx
  // (doneEmoji, statsGrid), but with its own styles.
  doneContainer: {
    gap: 16,
  },
  doneHeader: {
    alignItems: 'center',
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tileNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 2,
  },
  introducedBlock: {
    alignSelf: 'stretch',
  },
  introducedLabel: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  introducedTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  introducedFill: {
    height: '100%',
    borderRadius: 5,
  },
  // the card box moved into CardShell, and the scroller keeps the docked
  // bar's height at the bottom (cardScroll/cardScrollContent).
  cardScroll: {
    flex: 1,
    width: '100%',
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  // the word row (word + 🔊), at the top of CardShell.
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // took over Learn's frontText size (32/bold), so that the cards of the two tabs
  // show a word of equal weight.
  frontText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  // text of the ℹ️ note, under the wordRow.
  // A short sentence (hint) under the big word.
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  hintMark: {
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: '#EC4899',
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionText: {
    fontSize: 12,
    textAlign: 'center',
    flexShrink: 1,
  },
  // the (i) button in the chip row, and the card's explanation below it.
  infoBtn: {
    minWidth: 24,
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  // part-of-speech chip (noun/verb/phrase) next to the section text.
  posChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  posChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  speakBtn: {
    padding: 4,
    flexShrink: 0,
  },
  speakIcon: {
    fontSize: 22,
  },
  articleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  articleChip: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  articleChipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
  },
  dontLearn: {
    fontSize: 13,
    textAlign: 'right',
  },
  // The "Don't learn this" row; flex-end puts dontLearn at
  // the old right-aligned place.
  // marginTop: 10 instead of the earlier marginBottom: 8 (the box height is about the same), so that the row does not
  // touch the input field (there was an overlap on themes with a wider row height / rotated card frame).
  // If the two labels do not fit in one row (wide font: dyslexia), the second wraps onto a new row
  // instead of hanging out to the left of the card (because of flex-end the start of the filled row was cut off).
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    rowGap: 4,
    marginTop: 10,
  },
  checkBtn: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 44,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
