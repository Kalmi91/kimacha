// Screens where a touch is not learning: the weekly leaderboard and Settings. The usage timer (lib/usageTimer.ts) ignores touches
// there, so the minutes of the time ranking, the Stats tab and the toasts count learning, not browsing the board.
const NOT_LEARNING = ['board', 'settings', 'settings-learning', 'settings-voice', 'settings-data'];

// `segments`: the current route segments (useSegments), e.g. ['(tabs)', 'board'].
export const touchCountsAsLearning = (segments: readonly string[]): boolean => !segments.some((s) => NOT_LEARNING.includes(s));
