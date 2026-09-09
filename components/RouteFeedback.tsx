import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';

import FeedbackButton from '@/components/FeedbackModal';
import { getDb } from '@/lib/database';

// FB168, Kálmán 2026-08-29: "fejlessz a játékokba momdegyikre egyénileg tedd
// bele a visszajelző rendszert, hogy kozbe tudjak visszajelzést adni. mindegyik
// játékról". Mounted once in app/games/_layout.tsx, so every game screen carries
// the 💬 button without touching twelve files; the route names the game, so the
// sheet row arrives tagged `game:word-rain`, `game:ccat`, … and a report is
// traceable to the game it came from.
//
// Draggable like the tree tab's button (FB41): a game board fills the screen, so
// the learner needs to be able to move the button off whatever it covers, and
// the chosen side persists (learn_settings.feedback_btn_side).
export default function GameFeedback() {
  const pathname = usePathname();
  const [level, setLevel] = useState('-');
  const [pair, setPair] = useState('-');

  useEffect(() => {
    const db = getDb();
    db.getLevel().then((l) => setLevel(l.level)).catch(() => {});
    db.getOnboarding()
      .then((o) => {
        if (o) setPair(`${o.source}-${o.target}`);
      })
      .catch(() => {});
  }, []);

  // "/games/word-rain" → "word-rain"; the group's own index (if it ever gets
  // one) would leave an empty id, so fall back to a generic tag.
  const gameId = pathname.split('/').filter(Boolean).pop() ?? 'games';

  return <FeedbackButton level={level} languagePair={pair} currentCard={`game:${gameId}`} draggable />;
}
