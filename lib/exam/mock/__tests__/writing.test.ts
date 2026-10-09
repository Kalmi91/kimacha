// Writing scoring must not be lax.
// Empty, one-word, nonsense ("asdf"), repeated-word or answers pasted from the task text get NO
// points; a good answer gets high points; scoring stays proportional (a half-good answer gets half the
// points, a short but honest answer gets the content points but not the word-count mark).

import { PCIC_LEVELS, pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { MOCK_WRITING } from '../author';
import { buildMockExam } from '../build';
import { scoreMockExam, scoreMockTask } from '../score';
import type { MockAnswers, MockFormFillTask, MockShortMessageTask, MockTarget } from '../types';
import { assessMessage, buildLexicon, checkField, foldedTokens, isNonsenseToken } from '../writing';

afterAll(() => setPcicTarget('es'));

function lexiconFor(target: MockTarget) {
  setPcicTarget(target);
  return buildLexicon(PCIC_LEVELS.flatMap((l) => pcicItemsForLevel(l)), target);
}

const LEX_ES = lexiconFor('es');
setPcicTarget('es');

const message = { ...(MOCK_WRITING['es:A1'][1] as Omit<MockShortMessageTask, 'id'>), id: 'w2' } as MockShortMessageTask;
const form = { ...(MOCK_WRITING['es:A1'][0] as Omit<MockFormFillTask, 'id'>), id: 'w1' } as MockFormFillTask;

const GOOD =
  'Hola, me llamo Ana y soy de Hungría. Ahora vivo en la Ciudad de México con mi familia. ' +
  'Los fines de semana me gusta caminar, leer un libro y comer con mis amigos en un restaurante. ' +
  '¿Y tú, qué haces el sábado? Quiero saber más sobre tu casa y tu trabajo.';

const scoreMsg = (text: string, lexicon: ReadonlySet<string> | undefined = LEX_ES) => scoreMockTask(message, { text }, { lexicon });

// 40 distinct but meaningless "words" (with vowels, not a jumble of letters, not in the dictionary).
const GIBBERISH = Array.from({ length: 40 }, (_, i) => `${['zo', 'ku', 'fe', 'bi', 'nu'][i % 5]}${['kafe', 'lupo', 'minu', 'torka'][i % 4]}${['xa', 'qui', 'zo', 'vu', 'ye', 'jo', 'ha', 'wu'][(i * 3) % 8]}`).join(' ');

describe('writing message: what gets NO point', () => {
  it('empty and whitespace-only = 0', () => {
    expect(scoreMsg('').correct).toBe(0);
    expect(scoreMsg('   \n  ').correct).toBe(0);
  });

  it('a one-word answer = 0', () => {
    expect(scoreMsg('hola').correct).toBe(0);
    expect(scoreMsg('Vivo').correct).toBe(0);
  });

  it('a meaningless letter pile = 0: "asdf", repeated, and from different meaningless words too', () => {
    expect(scoreMsg('asdf').correct).toBe(0);
    expect(scoreMsg('asdf '.repeat(40)).correct).toBe(0);
    expect(scoreMsg('asdf qwer zxcv jkl lkj qwerty asdfgh ñlkj '.repeat(5)).correct).toBe(0);
    expect(scoreMsg(GIBBERISH).correct).toBe(0);
  });

  it('Latin filler text and text in another language (English) = 0 (not known words of the target language)', () => {
    expect(scoreMsg('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua').correct).toBe(0);
    expect(scoreMsg('Hello, my name is Anna and I am from Hungary. I live in Mexico City now. At the weekend I like to walk and read a book with my friends. What do you do on Saturday? I would like to know more about your house and your work.').correct).toBe(0);
  });

  it('pasting the task text (instruction + request) = 0, however many times', () => {
    const pasted = `${message.instruction} ${message.prompt}`;
    expect(scoreMsg(pasted).correct).toBe(0);
    expect(scoreMsg(`${pasted} ${pasted}`).correct).toBe(0);
    expect(scoreMsg(message.prompt).correct).toBe(0);
    expect(scoreMsg(`${message.prompt} hola`).correct).toBe(0);
  });

  it('a keyword crammed into two words is not a point: the content point asks for half of the minimum word count', () => {
    expect(scoreMsg('me llamo vivo sábado ¿?').correct).toBe(0);
    expect(scoreMsg('Me llamo Ana. Vivo en México. Sábado. ¿Y tú?').correct).toBe(0);
  });

  it('real content written next to the pasted task text does not bring back the pasted points', () => {
    const r = scoreMsg(`${message.prompt} Hola.`);
    expect(r.items.every((i) => !i.ok)).toBe(true);
  });
});

describe('writing message: a good answer gets a high score, the scoring is proportional', () => {
  it('a full good answer = every content point + the word-count mark', () => {
    const r = scoreMsg(GOOD);
    expect(r.items.map((i) => i.ok)).toEqual([true, true, true, true, true]);
    expect(r.correct).toBe(r.total);
  });

  it('the same without a dictionary (the dictionary step is skipped) is also full', () => {
    expect(scoreMsg(GOOD, undefined).correct).toBe(5);
  });

  it('a short but honest answer gets the content points, not the word-count mark', () => {
    const short = 'Hola, me llamo Ana y soy de Hungría. Vivo en la Ciudad de México con mi familia. Me gusta leer un libro.';
    const r = scoreMsg(short);
    expect(r.items.map((i) => i.ok)).toEqual([true, true, false, false, false]);
    expect(r.correct).toBe(2);
  });

  it('a half-good answer (two content points missing) gets about half the score, not zero and not full', () => {
    const half =
      'Hola, me llamo Ana y soy de Hungría. Ahora vivo en la Ciudad de México con mi familia y tengo un perro. ' +
      'Me gusta mucho mi casa porque es grande y tiene una cocina muy bonita para comer con todos los amigos.';
    const r = scoreMsg(half);
    expect(r.correct).toBeGreaterThanOrEqual(2);
    expect(r.correct).toBeLessThan(r.total);
    expect(r.items[r.items.length - 1].ok).toBe(true); // the word count is met
  });

  it('the natural echo of the task text (the phrase "fines de semana") does not take away the point', () => {
    expect(scoreMsg(GOOD).items[2]).toMatchObject({ label: 'Habla del fin de semana', ok: true });
  });

  it('a good answer together with the pasted task text still gets its own points, the pasted part does not count', () => {
    const plain = scoreMsg(GOOD);
    const padded = scoreMsg(`${message.prompt} ${GOOD}`);
    expect(padded.correct).toBe(plain.correct);
  });
});

describe('form: filled in AND with a sensible value', () => {
  const fields = Object.fromEntries(form.fields.map((f) => [f.id, f]));
  const GOOD_FORM = { nombre: 'Ana Kovács', edad: '30', nacionalidad: 'húngara', direccion: 'Calle Ficticia 123', telefono: '55 0000 0000', correo: 'ana@example.com', nivel: 'A1' };

  it('empty = 0, good data = all', () => {
    expect(scoreMockTask(form, {}).correct).toBe(0);
    expect(scoreMockTask(form, GOOD_FORM).correct).toBe(form.fields.length);
  });

  it('"asdf" (or a plain "x") in every field = 0 points', () => {
    expect(scoreMockTask(form, Object.fromEntries(form.fields.map((f) => [f.id, 'asdf']))).correct).toBe(0);
    expect(scoreMockTask(form, Object.fromEntries(form.fields.map((f) => [f.id, 'x']))).correct).toBe(0);
    expect(scoreMockTask(form, Object.fromEntries(form.fields.map((f) => [f.id, '1']))).correct).toBe(0);
  });

  it('each field needs a value fitting its kind', () => {
    expect(checkField(fields.nombre, 'Ana')).toBe(false); // nombre y apellidos: two words
    expect(checkField(fields.nombre, 'Ana Kovács')).toBe(true);
    expect(checkField(fields.nombre, 'asdf asdf')).toBe(false);
    expect(checkField(fields.nombre, 'Ana 3')).toBe(false);
    expect(checkField(fields.edad, 'treinta')).toBe(false);
    expect(checkField(fields.edad, '200')).toBe(false);
    expect(checkField(fields.edad, '4')).toBe(false);
    expect(checkField(fields.edad, '30')).toBe(true);
    expect(checkField(fields.telefono, '12')).toBe(false);
    expect(checkField(fields.telefono, '5500000000')).toBe(true);
    expect(checkField(fields.correo, 'ana')).toBe(false);
    expect(checkField(fields.correo, 'ana@example')).toBe(false);
    expect(checkField(fields.correo, 'ana@example.com')).toBe(true);
    expect(checkField(fields.nivel, 'zz')).toBe(false);
    expect(checkField(fields.nivel, 'a1')).toBe(true);
    expect(checkField(fields.direccion, 'Calle Ficticia')).toBe(false); // without a number it is not an address
    expect(checkField(fields.direccion, 'qwerty 1234')).toBe(false);
    expect(checkField(fields.nacionalidad, 'asdf')).toBe(false);
    expect(checkField(fields.nacionalidad, 'húngara')).toBe(true);
  });
});

describe('at paper level: meaningless writing is 0 points, a good one 25', () => {
  it('the points of the writing paper depend on the content, not on whether something was written', () => {
    setPcicTarget('es');
    const exam = buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1'), seed: 5 });
    const writing = exam.papers.find((p) => p.id === 'writing')!;
    const [formTask, msgTask] = writing.tasks;
    const answers = (f: Record<string, string>, text: string): MockAnswers => ({ [formTask.id]: f, [msgTask.id]: { text } });
    const asdfForm = Object.fromEntries((formTask as MockFormFillTask).fields.map((f) => [f.id, 'asdf']));
    const goodForm = { nombre: 'Ana Kovács', edad: '30', nacionalidad: 'húngara', direccion: 'Calle Ficticia 123', telefono: '5500000000', correo: 'ana@example.com', nivel: 'A1' };
    const pts = (a: MockAnswers) => scoreMockExam(exam, a, { lexicon: LEX_ES }).skills.find((p) => p.skill === 'writing')!.points;
    expect(pts(answers({}, ''))).toBe(0);
    expect(pts(answers(asdfForm, 'asdf '.repeat(60)))).toBe(0);
    expect(pts(answers(asdfForm, `${(msgTask as MockShortMessageTask).prompt} ${(msgTask as MockShortMessageTask).prompt}`))).toBe(0);
    expect(pts(answers(goodForm, GOOD))).toBe(25);
    // Half filled in gives about half the points: the good form + an empty message = 7 / 12 marks.
    const half = pts(answers(goodForm, ''));
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(25);
  });
});

describe('helpers', () => {
  it('foldedTokens: lowercase, without accents, without punctuation and numbers', () => {
    expect(foldedTokens('¿Qué haces, Ñandú? 123 don\'t')).toEqual(['que', 'haces', 'nandu', "don't"]);
  });

  it('isNonsenseToken: without a vowel, repeated letters, a long consonant run; a real word is not', () => {
    expect(isNonsenseToken('bcdfg')).toBe(true);
    expect(isNonsenseToken('aaaaa')).toBe(true);
    expect(isNonsenseToken('xyzbcdfg')).toBe(true);
    for (const w of ['hola', 'construccion', 'strengths', 'y', 'tres', "don't"]) expect(isNonsenseToken(w)).toBe(false);
  });

  it('assessMessage: a pasted 5-word span drops out, a natural echo (3 words) does not', () => {
    const ref = ['Escriba un mensaje a un amigo nuevo sobre los fines de semana'];
    const echo = assessMessage('Los fines de semana camino mucho', ref);
    expect(echo.words).toBe(6);
    const copy = assessMessage('escriba un mensaje a un amigo nuevo', ref);
    expect(copy.words).toBe(0);
    expect(copy.valid).toBe(false);
  });
});

describe('es→en direction (English writing task)', () => {
  const lexEn = lexiconFor('en');
  setPcicTarget('es');
  const email = { ...(MOCK_WRITING['en:A2'][0] as Omit<MockShortMessageTask, 'id'>), id: 'w1' } as MockShortMessageTask;
  const run = (text: string) => scoreMockTask(email, { text }, { lexicon: lexEn });
  const GOOD_EN =
    'Hello Anna, thank you very much for the invitation to your party on Saturday. Unfortunately I cannot come because I have to work all day. ' +
    'Last weekend I went to the cinema with my sister and we stayed at home on Sunday. How about we meet next week? ' +
    'We can have lunch together in the city centre. Sorry again and see you soon.';

  it('a good English answer high score, empty / meaningless / pasted task / Spanish text = 0', () => {
    const good = run(GOOD_EN);
    expect(good.correct).toBe(good.total);
    expect(run('').correct).toBe(0);
    expect(run('asdf '.repeat(50)).correct).toBe(0);
    expect(run(`${email.instruction} ${email.prompt}`).correct).toBe(0);
    expect(run('Hola Ana, muchas gracias por la invitación a tu fiesta del sábado. No puedo ir porque tengo que trabajar todo el día. El fin de semana pasado fui al cine con mi hermana y nos quedamos en casa el domingo. ¿Qué te parece si nos vemos la próxima semana?').correct).toBe(0);
  });
});
