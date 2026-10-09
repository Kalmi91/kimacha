import { useEffect, useRef, useState } from 'react';
import { router, usePathname } from 'expo-router';

import { getDb } from '@/lib/database';
import { loadResumePath, resumablePath, resumeSteps, saveResumePath } from '@/lib/resumeRoute';

// On cold start it steps to the saved place (only if onboarding is done and the app started on the home screen), then saves every resumable
// screen change. Saving starts AFTER the restore has FINISHED, and the starting point of the restoring navigation
// (the Learn home screen) is not written to the saved place before the navigation has arrived: otherwise the
// home screen would overwrite the saved place. `onboardingDone` is null while the startup check is running.
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
      // Only an app started on the home screen (Learn, '/') is restored; one started with a deep link / on another route is not.
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
