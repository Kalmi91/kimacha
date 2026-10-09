import { useEffect, useRef, useState } from 'react';
import { router, usePathname } from 'expo-router';

import { getDb } from '@/lib/database';
import { loadResumePath, resumablePath, resumeSteps, saveResumePath } from '@/lib/resumeRoute';

// hidegindításkor a mentett helyre lép (csak ha az onboarding kész és az app a kezdőlapon indult), utána minden folytatható
// képernyő-váltást ment. A mentés a visszaállítás LEZÁRULTA után indul, és a visszaállító navigáció
// kezdőpontját (a Learn kezdőlapot) nem írja a mentés helyére, mielőtt a navigáció megérkezne: különben a
// kezdőlap felülírná a mentett helyet. Az `onboardingDone` null, amíg az indulási ellenőrzés fut.
export function useAppResume(onboardingDone: boolean | null): void {
  const pathname = usePathname();
  const [settled, setSettled] = useState(false);
  const pathRef = useRef(pathname);
  const skipPath = useRef<string | null>(null);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (onboardingDone === null) return;
    let alive = true;
    (async () => {
      // Csak a kezdőlapon (Learn, '/') indult app áll vissza; egy mélylinkkel / más útvonalon induló nem.
      if (onboardingDone && pathRef.current === '/') {
        const db = getDb();
        const lang = (await db.getOnboarding())?.target ?? 'es';
        const steps = resumeSteps(await loadResumePath(db), lang);
        if (steps.length > 0) skipPath.current = pathRef.current;
        steps.forEach((href, i) => (i === 0 ? router.replace(href as never) : router.push(href as never)));
      }
      if (alive) setSettled(true);
    })();
    return () => {
      alive = false;
    };
  }, [onboardingDone]);

  useEffect(() => {
    if (!settled) return;
    if (skipPath.current !== null) {
      if (pathname === skipPath.current) return;
      skipPath.current = null;
    }
    const path = resumablePath(pathname);
    if (path) void saveResumePath(getDb(), path);
  }, [pathname, settled]);
}
