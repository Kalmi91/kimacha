// The bundled right-answer chime (assets/sounds/correct.wav), required lazily so importing lib/chime.ts never
// loads the asset. Its own module, so the chime test stubs this file instead of the asset path (on the Linux CI
// runner the stubbed asset path did not reach the require in lib/chime.ts, and playChime skipped the player).
export function chimeAsset(): number {
  return require('../assets/sounds/correct.wav') as number;
}
