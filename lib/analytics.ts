import { getDb } from './database';
import { ANALYTICS_ENDPOINT, APP_VERSION } from './config';

export async function sendAnalyticsIfNeeded() {
  try {
    const db = getDb();
    const meta = await db.getUserMeta();

    if (meta.lastSyncDate) {
      const lastSync = new Date(meta.lastSyncDate).getTime();
      const now = Date.now();
      if (now - lastSync < 24 * 60 * 60 * 1000) return;
    }

    const level = await db.getLevel();
    const streak = await db.getStreak();
    const onboarding = await db.getOnboarding();
    const stats = await db.getTodayStats();
    const top5 = await db.getTop5Failed();
    const mastered = await db.getMasteredCount();

    const params = new URLSearchParams({
      userId: meta.userId,
      timestamp: new Date().toISOString(),
      level: level.level,
      languagePair: onboarding ? `${onboarding.source}→${onboarding.target}` : 'unknown',
      streak: String(streak.current_count),
      masteredCount: String(mastered),
      totalReviewsToday: String(stats.totalReviews),
      accuracyPct: stats.totalReviews > 0 ? String(Math.round(stats.correctCount / stats.totalReviews * 100)) : '0',
      avgResponseMs: String(stats.avgResponseMs),
      cardTypeFlashcard: String(stats.flashcardCount),
      cardTypeTyping: String(stats.typingCount),
      cardTypeWord: String(stats.wordCount),
      cardTypeSentence: String(stats.sentenceCount),
      top5Failed: JSON.stringify(top5),
      firstUseDate: meta.firstUseDate,
      appVersion: APP_VERSION,
    });

    await fetch(`${ANALYTICS_ENDPOINT}?${params.toString()}`);
    await db.updateLastSync(new Date().toISOString());
  } catch {}
}
