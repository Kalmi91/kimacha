// The English interface strings, assembled from the namespace files next to this one.
// The key names are the ones t() has always served (t().tabs.home, t().pcic.…): a namespace file
// only decides WHERE a top-level block lives, not what it is called.
import common from './common';
import learn from './learn';
import grammar from './grammar';
import exam from './exam';
import stats from './stats';
import settings from './settings';

export default {
  ...common,
  ...learn,
  ...grammar,
  ...exam,
  ...stats,
  ...settings,
};
