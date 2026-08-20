// The running build, as one short human-readable tag ("v3.0.31 (31)").
//
// FB82 put the same string in Settings; Kálmán 2026-08-20 asked for it on every
// feedback row too ("melyik verziójú kimachaból kapod"), so the triage can tell
// a report about an already-fixed build from a fresh one. expoConfig carries
// app.json's version and the Android versionCode, so nothing can drift.

import Constants from 'expo-constants';

export function appBuildTag(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const code = Constants.expoConfig?.android?.versionCode;
  return `v${version}` + (code != null ? ` (${code})` : '');
}

// Same tag, but never empty: the feedback row is useless without a build, so a
// missing expoConfig still yields something the sheet can be filtered on.
export function feedbackBuildTag(): string {
  const tag = appBuildTag();
  return tag === 'v?' ? 'v-unknown' : tag;
}
