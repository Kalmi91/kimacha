import { useRef, type RefObject } from 'react';
import type { ScrollView, View } from 'react-native';
import { retypeRowScrollTarget } from './dockScrollInsets';

// E148: when the retype row appears below the revealed answer, scroll the card just enough that the whole row shows.
export function useRetypeRowScroll(scrollRef: RefObject<ScrollView | null>) {
  const viewportH = useRef(0);
  const rowRef = useRef<View>(null);
  const onRowLayout = () => {
    const inner = (scrollRef.current as unknown as { getInnerViewRef?: () => View | null } | null)?.getInnerViewRef?.();
    if (inner) rowRef.current?.measureLayout(inner as never, (_x, y, _w, h) => {
      const to = retypeRowScrollTarget(y, h, viewportH.current);
      if (to > 0) scrollRef.current?.scrollTo({ y: to, animated: false });
    }, () => {});
  };
  // The viewport also changes after the row showed (the keyboard closes on Enter): measure the row again then.
  const setViewportH = (h: number) => { const changed = viewportH.current !== h; viewportH.current = h; if (changed && rowRef.current) onRowLayout(); };
  return { setViewportH, rowRef, onRowLayout };
}
