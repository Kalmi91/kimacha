// react-native-sherpa-onnx lists the background downloader as a peer, but its native code never calls it (only
// its JS `download` entry does, which the app does not import). Linked on Android, the downloader would add
// FOREGROUND_SERVICE(_DATA_SYNC), WAKE_LOCK and RUN_USER_INITIATED_JOBS and a dataSync service to the release
// manifest, so react-native.config.js keeps it out of the autolinking.

import fs from 'fs';
import path from 'path';

const DOWNLOADER = '@kesha-antonov/react-native-background-downloader';
const root = path.join(__dirname, '..', '..');

describe('background downloader stays out of the Android build', () => {
  it('react-native.config.js switches its Android autolinking off', () => {
    const config = require('../../react-native.config.js');
    expect(config.dependencies[DOWNLOADER].platforms.android).toBeNull();
  });

  it('the app code never imports it or the sherpa package download entry (that is what makes the exclusion safe)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'android', 'ios', '.git', 'dist', '.expo', '__tests__'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && full !== path.join(root, 'react-native.config.js')) {
          const text = fs.readFileSync(full, 'utf8');
          if (text.includes(DOWNLOADER) || text.includes('react-native-sherpa-onnx/download')) offenders.push(path.relative(root, full));
        }
      }
    };
    for (const dir of ['app', 'components', 'lib', 'scripts', 'plugins']) walk(path.join(root, dir));
    expect(offenders).toEqual([]);
  });
});
