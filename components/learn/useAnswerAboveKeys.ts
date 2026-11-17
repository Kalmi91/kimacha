import { useEffect, useState, type RefObject } from 'react';
import type { ScrollView, TextInput, View } from 'react-native';

import { answerScrollTarget, dockStepsAside, MIN_ANSWER_ROOM } from '@/components/learn/dockScrollInsets';

// E119: with the keyboard open the answer field has to end above the docked bar, else (picture open, a long card)
// Android pans the whole window and the bar floats mid-screen. Re-run when the keyboard shows or the picture toggles.
// `scrollerH` is the scroller's measured height (onLayout); `stepAside` says the docked bar should hide while typing.
export function useAnswerAboveKeys(
  scrollRef: RefObject<ScrollView | null>,
  inputRef: RefObject<TextInput | null>,
  kbHeight: number,
  dockH: number,
  dockLift: number,
  noteOpen: boolean,
  { compact = false, promptRef, cardKey }: { compact?: boolean; promptRef?: RefObject<View | null>; cardKey?: string } = {},
) {
  const [scrollerH, setScrollerH] = useState(0);
  const [relayout, setRelayout] = useState(0);
  const [fieldLayout, setFieldLayout] = useState(0);
  const [answerRoom, setAnswerRoom] = useState<{ key?: string; height: number } | null>(null);
  const measuredRoom = answerRoom?.key === cardKey ? answerRoom?.height ?? 0 : 0;
  // On short screens reserve both the prompt and the field, even with the picture closed.
  // Keep Check out of the way until the current card has been measured.
  const stepAside = kbHeight > 0 && (compact
    ? measuredRoom === 0 || dockStepsAside(true, scrollerH, dockH, dockLift, measuredRoom)
    : dockStepsAside(noteOpen, scrollerH, dockH, dockLift));
  useEffect(() => {
    if ((!noteOpen && !compact) || kbHeight <= 0 || scrollerH <= 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const inner = (scrollRef.current as unknown as { getInnerViewRef?: () => View | null } | null)?.getInnerViewRef?.();
      const field = inputRef.current;
      if (!inner || !field) return;
      field.measureLayout(inner as never, (_x, y, _w, h) => {
        const align = (room: number) => {
          if (cancelled) return;
          const hideDock = compact ? dockStepsAside(true, scrollerH, dockH, dockLift, room) : stepAside;
          if (compact) setAnswerRoom({ key: cardKey, height: room });
          scrollRef.current?.scrollTo({ y: answerScrollTarget(y, h, scrollerH, hideDock ? 0 : dockH, dockLift), animated: false });
          // a scroll alone does not make Android recompute the window pan it already applied; a 1 px layout change does
          setRelayout((n) => n ^ 1);
        };
        if (compact) {
          promptRef?.current?.measureLayout(inner as never, (_px, promptY) => {
            align(Math.max(MIN_ANSWER_ROOM, y + h - promptY + 24));
          }, () => {});
        } else {
          align(MIN_ANSWER_ROOM);
        }
      }, () => {});
    }, 60);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [kbHeight, noteOpen, scrollerH, dockH, dockLift, scrollRef, inputRef, stepAside, compact, promptRef, cardKey, fieldLayout]);
  return { setScrollerH, stepAside, onFieldLayout: () => setFieldLayout((n) => n + 1), relayout: noteOpen || compact ? relayout : 0 };
}
