// .ts modul betöltése bármely Node >= 18-on. A Node 20 nem ismeri a .ts kiterjesztést
// (ERR_UNKNOWN_FILE_EXTENSION), a natív type-stripping csak 22.6+ / 24-től van; ez a segéd a
// projekt typescript-jével transzpilál, és data: URL-ről importálja az eredményt.
// Csak import-mentes modulra jó (a data: URL-ből nincs relatív feloldás): import esetén hibával áll le.

import { readFileSync } from 'node:fs';
import ts from 'typescript';

export async function importTs(file) {
  const source = readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  });
  const deps = ts.preProcessFile(outputText, true, true).importedFiles.map((i) => i.fileName);
  if (deps.length > 0) {
    throw new Error(`importTs: ${file} importál (${deps.join(', ')}), ez a segéd csak import-mentes modult tölt`);
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(outputText, 'utf8').toString('base64');
  return import(url);
}
