import en from '../en';
import common from './common';
import learn from './learn';
import grammar from './grammar';
import exam from './exam';
import stats from './stats';
import settings from './settings';

// complete interface translation, with every key of en/ (the English namespace files)
// (the `Strings` type enforces this: if a key is
// missing or its type differs, the file does not compile). This is the interface language in the
// es→en pair (you learn English from Spanish), informal "tú", natural Mexican/
// neutral Spanish; the ¿/¡ marks are fine here (this is interface text,
// not text written on the developer's behalf). The `usage` block (target-language toasts) is
// unchanged from the Kimacha Play en-es era, `stringsFor('es')` reads that.
type Strings = typeof en;

// The namespace files mirror lib/i18n/en/ one to one; each is typed against its English twin,
// and this assembly against the whole of en, so a missing or extra key fails the compile.
const es: Strings = {
  ...common,
  ...learn,
  ...grammar,
  ...exam,
  ...stats,
  ...settings,
};

export default es;
