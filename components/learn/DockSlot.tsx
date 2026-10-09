import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import Colors from '@/constants/Colors';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE, type DockedActionTone } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';

type ColorScheme = (typeof Colors)['light'];

// User feedback: „tegyed be a check gombot a klaviatúra felé,
// ahogy a kártyáknál van", „csináld meg, hogy a check gomb mindenhol a klaviatúra felett legyen".
// A szókártya, a mondatkártya és a táblakártya a Check / Next sávot a képernyő aljára dokkolja
// (DockedAction), a billentyűzet felső élén. A nyelvtani drill (ragozás, átírás, diktálás) és a
// teszt/vizsga beírós kártyái a saját görgetőjükben, a tartalom alatt tartottak inline gombot.
// Ez a közös rés: a KÉPERNYŐ (host) kirajzolja a dokkolt sávot, a beírós tétel (consumer) csak
// bejelenti, mi legyen rajta (useDockedAction), így a tétel nem kell ismerje a képernyő szerkezetét.
// Host nélkül (önálló render, teszt) a tétel a régi inline gombot rajzolja.

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
  /** A görgető alján ennyi hely kell, hogy a tartalom ne kerüljön a dokkolt sáv / a 💬 alá. */
  padBottom: number;
}

const DockContext = createContext<DockContextValue | null>(null);

interface DockSlotHost {
  value: DockContextValue;
  /** A dokkolt sáv, a képernyő-konténer KÖZVETLEN gyerekeként kell kirajzolni (absolute, bottom = a billentyűzet emelése). */
  node: ReactNode;
  /** A 💬 gomb `bottomOffset`-je: csak akkor van, ha éppen van dokkolt sáv. */
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
 * A beírós tétel bejelenti a dokkolt sáv tartalmát (null = nincs sáv). `docked` = van host, ilyenkor
 * a tétel nem rajzol inline gombot, a görgető alján `padBottom` üres helyet hagy.
 */
export function useDockedAction(spec: DockSpec | null): { docked: boolean; padBottom: number } {
  const ctx = useContext(DockContext);
  const register = ctx?.register;
  // A sáv gombja mindig a legfrissebb `onPress`-t hívja (a zárt `check` a beírt szöveggel újra jön
  // minden gépeléskor), ezért csak a felirat / tónus / szín / azonosító változása jelent újra-bejelentést.
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
