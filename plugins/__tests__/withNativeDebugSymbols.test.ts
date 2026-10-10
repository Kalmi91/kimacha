const { patchBuildGradle } = require('../withNativeDebugSymbols');

const TEMPLATE = `
android {
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}
`;

describe('withNativeDebugSymbols.patchBuildGradle', () => {
  it('adds the symbol table to the release build type only', () => {
    const out: string = patchBuildGradle(TEMPLATE);
    expect(out).toMatch(/release \{\n\s+ndk \{\n\s+debugSymbolLevel 'SYMBOL_TABLE'\n\s+\}/);
    expect(out.match(/debugSymbolLevel/g)).toHaveLength(1);
  });

  it('is idempotent', () => {
    const once: string = patchBuildGradle(TEMPLATE);
    expect(patchBuildGradle(once)).toBe(once);
  });

  it('throws when the release build type is missing', () => {
    expect(() => patchBuildGradle('android {\n}\n')).toThrow('anchor not found');
  });
});
