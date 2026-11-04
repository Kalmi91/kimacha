import fs from 'fs';
import path from 'path';
import { Keyboard, Platform } from 'react-native';

import { dismissKeyboardOnTap, keyboardDismissOnDrag } from '@/lib/keyboardTap';

const ROOT = path.resolve(__dirname, '../..');

describe('dismissKeyboardOnTap', () => {
  afterEach(() => jest.restoreAllMocks());

  it('closes the keyboard on a phone', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    dismissKeyboardOnTap();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves the focus alone on web, a tap on the field itself must not close the keyboard it opened (FB562)', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    dismissKeyboardOnTap();
    expect(dismiss).not.toHaveBeenCalled();
  });
});

describe('keyboardDismissOnDrag', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a drag closes the keyboard on a phone app', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(keyboardDismissOnDrag()).toBe('on-drag');
  });

  it('on web it stays off: react-native-web blurs the field on every scroll, and opening the keyboard scrolls', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    expect(keyboardDismissOnDrag()).toBe('none');
  });

  // The literal on any scroller brings the bug back on that screen, and only a phone browser shows it.
  it('no screen passes the on-drag literal to a scroller', () => {
    const sources = ['app', 'components', 'lib'].flatMap(function walk(dir: string): string[] {
      return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(rel);
        return /\.tsx?$/.test(entry.name) ? [rel] : [];
      });
    });
    expect(sources.length).toBeGreaterThan(100);
    const offenders = sources.filter(
      (rel) => rel !== path.join('lib', 'keyboardTap.ts') && /['"]on-drag['"]/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
