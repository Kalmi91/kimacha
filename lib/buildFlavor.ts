// Kimacha Play-vágás: the same source builds two flavors. The Drive-APK
// (Kálmán's phone, /build_kimacha) keeps sending feedback to the Apps Script
// endpoint; the Play build (AAB, 16. lépés) never makes that network call, so
// EXPO_PUBLIC_PLAY_STORE='1' (set on the bundleRelease command, Metro inlines
// EXPO_PUBLIC_* at bundle time) switches it to the on-device share sheet.
export const IS_PLAY_BUILD = process.env.EXPO_PUBLIC_PLAY_STORE === '1';

// The feedback Apps Script URL must not exist as a string anywhere in the
// Play bundle. Metro packages one module at a time and its minifier only
// folds constants WITHIN a module, not across one, so the env check and the
// URL literal have to sit in this one expression: once EXPO_PUBLIC_PLAY_STORE
// is inlined to the literal '1', `'1' === '1' ? null : '...'` collapses to
// `null` and the string is dropped, not just left unreachable. Splitting this
// into `IS_PLAY_BUILD ? null : URL_FROM_ANOTHER_MODULE` would leave the raw
// URL sitting in that other module's output. Verified via the Play-bundle
// grep in the build gate (see PLAN-play.md step 6).
export const FEEDBACK_URL =
  process.env.EXPO_PUBLIC_PLAY_STORE === '1'
    ? null
    : 'https://script.google.com/macros/s/AKfycbz2ziRYVpdLcQO1fI10CpbAO7l3bqUFZMxfwBTNxVsc19tRAfE8mGAg01JJscB2fRt6/exec';
