import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import Colors from '@/constants/Colors';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE, type DockedActionTone } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';

type ColorScheme = (typeof Colors)['light'];

// So that the Check button sits above the keyboard everywhere: the word card, the sentence card and the table card
// dock the Check / Next bar to the bottom of the screen (DockedAction), on the keyboard's top edge. The grammar
// drill (inflection, transformation, dictation) and the typed cards of the test/exam kept an inline button under
// the content, inside their own scroller.
// This is the shared slot: the SCREEN (host) draws the docked bar, the typed item (consumer) only
// announces what should be on it (useDockedAction), so the item does not need to know the screen's structure.
// Without a host (standalone render, tests) the item draws the old inline button.

interface DockSpec {
  label: string;
  onPress: () => void;
  tone: DockedActionTone;
  color?: string;
  testID?: string;
  disabled?: boolean;
}

interface DockContextValue {
  register: (spec: DockSpec | null) => void;
  /** This much room is needed at the bottom of the scroller, so the content does not end up under the docked bar / the 💬. */
  padBottom: number;
}

const DockContext = createContext<DockContextValue | null>(null);

interface DockSlotHost {
  value: DockContextValue;
  /** The docked bar; must be drawn as a DIRECT child of the screen container (absolute, bottom = the keyboard lift). */
  node: ReactNode;
  /** The 💬 button's `bottomOffset`: only set while there is a docked bar. */
  bottomOffset: number | undefined;
}

export function useDockSlot(colors: ColorScheme): DockSlotHost {
  const { dockLift } = useDockLift();
  const [spec, setSpec] = useState<DockSpec | null>(null);
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const value = useMemo(() => ({ register: setSpec, padBottom: FAB_CLEARANCE + dockH + dockLift }), [dockH, dockLift]);
  const node = spec ? (
    <DockedAction
      label={spec.label}
      onPress={spec.onPress}
      tone={spec.tone}
      color={spec.color}
      testID={spec.testID}
      disabled={spec.disabled}
      bottom={dockLift}
      colors={colors}
      onHeight={setDockH}
    />
  ) : null;
  return { value, node, bottomOffset: spec ? dockH + dockLift : undefined };
}

export function DockSlotProvider({ host, children }: { host: DockSlotHost; children: ReactNode }) {
  return <DockContext.Provider value={host.value}>{children}</DockContext.Provider>;
}

/**
 * The typed item announces the docked bar's content (null = no bar). `docked` = there is a host, in which case
 * the item does not draw an inline button, and leaves `padBottom` of empty room at the bottom of the scroller.
 */
export function useDockedAction(spec: DockSpec | null): { docked: boolean; padBottom: number } {
  const ctx = useContext(DockContext);
  const register = ctx?.register;
  // The bar's button always calls the latest `onPress` (the closed-over `check` with the typed text comes anew
  // on every keystroke), so only a change of the label / tone / colour / id counts as a new announcement.
  const latest = useRef(spec);
  useEffect(() => {
    latest.current = spec;
  });
  const key = spec ? `${spec.label}|${spec.tone}|${spec.color ?? ''}|${spec.testID ?? ''}|${spec.disabled ? 1 : 0}` : '';
  useEffect(() => {
    if (!register) return;
    const cur = latest.current;
    register(cur ? { ...cur, onPress: () => latest.current?.onPress() } : null);
    return () => register(null);
  }, [register, key]);
  return { docked: !!ctx, padBottom: ctx?.padBottom ?? 0 };
}
