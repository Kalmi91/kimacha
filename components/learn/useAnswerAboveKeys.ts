import { useEffect, useState, type RefObject } from 'react';
import type { ScrollView, TextInput, View } from 'react-native';

import { answerScrollTarget, dockStepsAside } from '@/components/learn/dockScrollInsets';

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
) {
  const [scrollerH, setScrollerH] = useState(0);
  const [relayout, setRelayout] = useState(0);
  // Only while the picture / note of the current card is open; with it closed everything stays as it is on main.
  const stepAside = kbHeight > 0 && dockStepsAside(noteOpen, scrollerH, dockH, dockLift);
  useEffect(() => {
    if (!noteOpen || kbHeight <= 0 || scrollerH <= 0) return;
    const timer = setTimeout(() => {
      const inner = (scrollRef.current as unknown as { getInnerViewRef?: () => View | null } | null)?.getInnerViewRef?.();
      const field = inputRef.current;
      if (!inner || !field) return;
      field.measureLayout(inner as never, (_x, y, _w, h) => {
        scrollRef.current?.scrollTo({ y: answerScrollTarget(y, h, scrollerH, stepAside ? 0 : dockH, dockLift), animated: false });
        // a scroll alone does not make Android recompute the window pan it already applied; a 1 px layout change does
        setRelayout((n) => n ^ 1);
      }, () => {});
    }, 60);
    return () => clearTimeout(timer);
  }, [kbHeight, noteOpen, scrollerH, dockH, dockLift, scrollRef, inputRef, stepAside]);
  return { setScrollerH, stepAside, relayout: noteOpen ? relayout : 0 };
}
