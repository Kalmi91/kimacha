// Loads a .ts module on any Node >= 18. Node 20 does not know the .ts extension
// (ERR_UNKNOWN_FILE_EXTENSION); native type stripping exists only from 22.6+ / 24. This helper
// transpiles with the project's typescript and imports the result from a data: URL.
// Only works for import-free modules (a data: URL has no relative resolution): it throws if the module has imports.

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
