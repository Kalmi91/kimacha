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
  const setViewportH = (h: number) => { viewportH.current = h; };
  return { setViewportH, rowRef, onRowLayout };
}
