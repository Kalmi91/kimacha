import { enForms } from '@/lib/enForms';

function has(word: string, ...forms: string[]) {
  const got = enForms(word);
  for (const form of forms) expect(got).toContain(form);
}

function lacks(word: string, ...forms: string[]) {
  const got = enForms(word);
  for (const form of forms) expect(got).not.toContain(form);
}

describe('enForms, irregular verbs', () => {
  it('knows the past and the participle of the verbs the corpus stories failed on', () => {
    has('become', 'became', 'becomes', 'becoming');
    has('begin', 'began', 'begun', 'beginning');
    has('build', 'built', 'builds', 'building');
    has('hear', 'heard', 'hears', 'hearing');
    has('know', 'knew', 'known', 'knowing');
  });

  it('gives both accepted alternatives', () => {
    has('learn', 'learned', 'learnt');
    has('get', 'got', 'gotten', 'getting');
    has('lie', 'lay', 'lain', 'lied', 'lying');
  });

  it('does not add a regular -ed to an irregular verb', () => {
    lacks('go', 'goed');
    lacks('run', 'runned');
    lacks('take', 'taked', 'takeed');
    lacks('buy', 'buyed');
  });

  it('keeps be/have/do/go whole', () => {
    expect(enForms('be')).toEqual(['am', 'is', 'are', 'was', 'were', 'been', 'being']);
    expect(enForms('have')).toEqual(['has', 'had', 'having']);
    expect(enForms('do')).toEqual(['does', 'did', 'done', 'doing']);
    expect(enForms('go')).toEqual(['goes', 'went', 'gone', 'going']);
  });

  it('doubles the consonant of the -ing of a one-syllable irregular verb', () => {
    has('run', 'running', 'ran');
    has('sit', 'sitting', 'sat');
    has('swim', 'swimming', 'swam', 'swum');
    has('put', 'putting');
    has('forget', 'forgetting', 'forgot', 'forgotten');
  });

  it('uses -es after a sibilant and a vowel-y before s', () => {
    has('teach', 'teaches', 'taught');
    has('catch', 'catches', 'caught');
    has('say', 'says', 'said');
    has('fly', 'flies', 'flew', 'flown');
  });

  it('gives a prefixed verb the forms of its irregular base', () => {
    has('rebuild', 'rebuilt', 'rebuilds', 'rebuilding');
    has('overcome', 'overcame', 'overcoming');
    has('undertake', 'undertook', 'undertaken');
    has('withdraw', 'withdrew', 'withdrawn');
    has('mistake', 'mistook', 'mistaken', 'mistakes');
    has('rethink', 'rethought');
    has('foresee', 'foresaw', 'foreseen');
    has('mislay', 'mislaid');
    has('undo', 'undid', 'undone', 'undoes');
    has('reset', 'resetting');
    has('understand', 'understood');
  });

  it('does not treat a regular word that looks prefixed as irregular', () => {
    has('relay', 'relayed', 'relaying', 'relays');
    lacks('relay', 'relaid');
  });
});

describe('enForms, spelling rules of the regular forms', () => {
  it('doubles the last consonant of a one-syllable consonant-vowel-consonant word', () => {
    has('stop', 'stopped', 'stopping', 'stops');
    has('clap', 'clapped', 'clapping');
    has('plan', 'planned', 'planning');
    has('grab', 'grabbed', 'grabbing');
    has('quiz', 'quizzed', 'quizzing', 'quizzes');
    lacks('stop', 'stoped', 'stoping');
  });

  it('does not double after two vowels, two consonants, or w x y', () => {
    has('rain', 'rained', 'raining');
    has('help', 'helped', 'helping');
    has('snow', 'snowed', 'snowing');
    has('fix', 'fixed', 'fixing', 'fixes');
    has('play', 'played', 'playing', 'plays');
    has('wash', 'washed', 'washing', 'washes');
    lacks('rain', 'rainned');
    lacks('fix', 'fixxed');
  });

  it('does not double a stress-first word of two syllables', () => {
    has('visit', 'visited', 'visiting', 'visits');
    lacks('visit', 'visitted', 'visitting');
    has('open', 'opened', 'opening');
    lacks('open', 'openned');
    has('listen', 'listened');
    has('offer', 'offered');
    has('happen', 'happened');
    has('develop', 'developed');
    has('enter', 'entered');
    has('benefit', 'benefited');
  });

  it('doubles a listed stress-final word', () => {
    has('prefer', 'preferred', 'preferring');
    has('refer', 'referred');
    has('occur', 'occurred', 'occurring');
    has('admit', 'admitted');
    has('permit', 'permitted');
    has('commit', 'committed');
    has('control', 'controlled');
  });

  it('accepts the British double l and the single l', () => {
    has('travel', 'traveled', 'traveling', 'travelled', 'travelling');
    has('cancel', 'canceled', 'cancelled');
  });

  it('turns consonant + y into -ied / -ies, but not vowel + y', () => {
    has('apply', 'applied', 'applies', 'applying');
    has('try', 'tried', 'tries', 'trying');
    has('carry', 'carried', 'carries');
    has('study', 'studied', 'studies', 'studying');
    has('family', 'families');
    has('story', 'stories');
    has('country', 'countries');
    has('enjoy', 'enjoyed', 'enjoys');
    has('day', 'days');
    has('key', 'keys');
    lacks('apply', 'applyed', 'applys');
    lacks('day', 'daies');
  });

  it('drops the silent e before -ing, and adds only d for -ed', () => {
    has('make', 'making', 'makes');
    has('replace', 'replaced', 'replacing', 'replaces');
    has('live', 'lived', 'living');
    has('use', 'used', 'using');
    lacks('replace', 'replaceed', 'replaceing');
    lacks('live', 'liveing', 'maked');
  });

  it('keeps the e of ee / ye / oe and rewrites ie as ying', () => {
    has('agree', 'agreed', 'agreeing');
    has('see', 'seeing');
    has('dye', 'dyed', 'dyeing');
    has('die', 'died', 'dying');
    has('tie', 'tied', 'tying');
    has('singe', 'singeing');
    lacks('singe', 'singing');
  });

  it('adds -es after s x z ch sh, and a k to -ic verbs', () => {
    has('watch', 'watches', 'watched');
    has('box', 'boxes');
    has('bus', 'buses', 'busses');
    has('class', 'classes');
    has('wish', 'wishes');
    has('stomach', 'stomachs');
    has('panic', 'panicked', 'panicking');
  });

  it('adds -s or -es after o', () => {
    has('photo', 'photos');
    has('radio', 'radios');
    has('zoo', 'zoos');
    has('potato', 'potatoes');
    has('hero', 'heroes');
    lacks('photo', 'photoes');
    lacks('potato', 'potatos');
  });
});

describe('enForms, irregular plurals', () => {
  it('knows the listed irregular plurals', () => {
    has('child', 'children');
    has('person', 'people', 'persons');
    has('man', 'men');
    has('woman', 'women');
    has('foot', 'feet');
    has('tooth', 'teeth');
    has('mouse', 'mice');
    has('life', 'lives');
    has('knife', 'knives');
    has('wife', 'wives');
    has('leaf', 'leaves');
    has('half', 'halves');
  });

  it('gives no regular plural or ending next to an irregular plural', () => {
    expect(enForms('child')).toEqual(['children']);
    lacks('life', 'lifes');
    lacks('wife', 'wifes');
  });

  it('pluralises compounds of man / woman / child, but not human', () => {
    has('policeman', 'policemen');
    has('businesswoman', 'businesswomen');
    has('grandchild', 'grandchildren');
    has('human', 'humans');
    lacks('human', 'humen');
  });
});

describe('enForms, edge cases', () => {
  it('returns nothing for an apostrophe, a digit or an empty word', () => {
    expect(enForms("it's")).toEqual([]);
    expect(enForms('b2')).toEqual([]);
    expect(enForms('')).toEqual([]);
  });

  it('gives no endings to a one- or two-letter word, so that "a" never makes "as"', () => {
    expect(enForms('a')).toEqual([]);
    expect(enForms('in')).toEqual([]);
    expect(enForms('we')).toEqual([]);
  });

  it('is case-insensitive, and the word itself is not in the result', () => {
    has('STOP', 'stopped');
    lacks('stop', 'stop');
    lacks('cut', 'cut');
  });
});
