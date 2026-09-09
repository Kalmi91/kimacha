import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';

import FeedbackButton from '@/components/FeedbackModal';
import { getDb } from '@/lib/database';
import { feedbackTag } from '@/lib/feedbackTag';

// FB168, Kálmán 2026-08-29: "fejlessz a játékokba momdegyikre egyénileg tedd
// bele a visszajelző rendszert, hogy kozbe tudjak visszajelzést adni. mindegyik
// játékról". Mounted once in a group's _layout.tsx, so every screen in that group
// carries the 💬 button without touching a dozen files; the route names the
// screen, so the sheet row arrives tagged `game:word-rain`, `talk:comida`, … and a
// report is traceable to where it came from.
//
// FB201, Kálmán 2026-09-09: "nem mindenhol van feedback gomb tegyél mindenhohova".
// Ezért a komponens már nem játék-specifikus: a címkét a lib/feedbackTag.ts adja az
// útvonalból, és az Átbeszélő al-képernyői ugyanezzel az egy mounttal kapják meg.
//
// Draggable like the tree tab's button (FB41): a game board fills the screen, so
// the learner needs to be able to move the button off whatever it covers, and
// the chosen side persists (learn_settings.feedback_btn_side).
export default function RouteFeedback() {
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

  return (
    <FeedbackButton level={level} languagePair={pair} currentCard={feedbackTag(pathname)} draggable />
  );
}
