import { createContext, useContext, useEffect, useId, useMemo, useState, type ComponentProps, type ReactNode } from 'react';

import FeedbackButton from '@/components/FeedbackModal';

// The 💬 button is mounted once per screen frame, not by every screen. A screen only says which card it is on
// (<ScreenFeedback level languagePair currentCard />, plus bottomOffset / placement where it had them); the frame
// (<ScreenFeedbackFrame>, wired into the root stack's and the tab navigator's screenLayout) draws the one button
// from the newest card registered in it. A screen in a nested stack (grammar, mistakes) registers into the same
// frame as the screen under it: the top one wins, and it hands the button back when it closes.
//
// `placement="inline"` is the exception: that button sits in the screen's own row, so ScreenFeedback renders it in
// place. Where no frame wraps the screen (jest renders the screens bare) it renders the button in place too.
export type ScreenFeedbackCard = ComponentProps<typeof FeedbackButton>;

interface Registry {
  set: (id: string, card: ScreenFeedbackCard) => void;
  clear: (id: string) => void;
}

const ScreenFeedbackContext = createContext<Registry | null>(null);

export function ScreenFeedbackFrame({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<{ id: string; card: ScreenFeedbackCard }[]>([]);
  const registry = useMemo<Registry>(
    () => ({
      set: (id, card) =>
        setEntries((all) => (all.some((e) => e.id === id) ? all.map((e) => (e.id === id ? { id, card } : e)) : [...all, { id, card }])),
      clear: (id) => setEntries((all) => all.filter((e) => e.id !== id)),
    }),
    [],
  );
  const top = entries[entries.length - 1];
  return (
    <ScreenFeedbackContext.Provider value={registry}>
      {children}
      {top ? <FeedbackButton key={top.id} {...top.card} /> : null}
    </ScreenFeedbackContext.Provider>
  );
}

export default function ScreenFeedback(props: ScreenFeedbackCard) {
  const registry = useContext(ScreenFeedbackContext);
  const id = useId();
  const { placement = 'fab', level, languagePair, currentCard, draggable, bottomOffset } = props;
  const hosted = registry !== null && placement !== 'inline';

  useEffect(() => {
    if (!registry || !hosted) return;
    registry.set(id, { placement, level, languagePair, currentCard, draggable, bottomOffset });
  }, [registry, hosted, id, placement, level, languagePair, currentCard, draggable, bottomOffset]);
  useEffect(() => {
    if (!registry) return;
    return () => registry.clear(id);
  }, [registry, id]);

  return hosted ? null : <FeedbackButton {...props} />;
}
