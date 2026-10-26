import en from '../en';
import common from './common';
import learn from './learn';
import grammar from './grammar';
import exam from './exam';
import stats from './stats';
import settings from './settings';
import cloud from './cloud';

// complete interface translation, with every key of en/ (the English namespace files)
// (the `Strings` type enforces this: if a key is missing or its type differs, the file does not
// compile). Interface language of the hu→es and hu→en pairs, informal "tegező" Hungarian. The
// `usage` block (target-language toasts) is shown to people LEARNING Hungarian, so it is simple
// A1-level Hungarian; `stringsFor('hu')` reads it.
type Strings = typeof en;

// The namespace files mirror lib/i18n/en/ one to one; each is typed against its English twin,
// and this assembly against the whole of en, so a missing or extra key fails the compile.
const hu: Strings = {
  ...common,
  ...learn,
  ...grammar,
  ...exam,
  ...stats,
  ...settings,
  ...cloud,
};

export default hu;
