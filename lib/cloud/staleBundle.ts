// Web only: a page restored from the browser's cache can start the bundle of an earlier deploy, while the lesson packs
// (lib/games/content/webPacks.ts, fetched with no-cache) already come from the newer one, and the old code then fails on lessons
// it was not built for (2026-11-19). The web gate (components/cloud/CloudGate.tsx) asks this at start: when the deployed page
// names another entry bundle than the one running, the page reloads, once per deployed bundle, so a reload that still lands on
// the old bundle carries on instead of looping.

// Expo's web export names the entry bundle by its hash, in every page's <script> tag
const ENTRY = /\/_expo\/static\/js\/web\/entry-[0-9a-f]+\.js/;
export const STALE_RELOAD_KEY = 'kimacha.staleReload';

/** True when the page is reloading onto the deployed bundle (the caller then stops); false in every other case. */
export async function reloadIfStale(): Promise<boolean> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  const running = Array.from(document.scripts)
    .map((s) => s.src.match(ENTRY)?.[0])
    .find((m) => m !== undefined);
  // the dev server and the tests run no hashed entry bundle
  if (!running) return false;
  let deployed: string | undefined;
  try {
    const res = await fetch('/', { cache: 'no-cache' });
    if (!res.ok) return false;
    deployed = (await res.text()).match(ENTRY)?.[0];
  } catch {
    return false;
  }
  if (!deployed || deployed === running) return false;
  try {
    if (window.sessionStorage.getItem(STALE_RELOAD_KEY) === deployed) return false;
    window.sessionStorage.setItem(STALE_RELOAD_KEY, deployed);
  } catch {
    // without session storage a reload could loop, so the page goes on with the bundle it has
    return false;
  }
  window.location.reload();
  return true;
}
