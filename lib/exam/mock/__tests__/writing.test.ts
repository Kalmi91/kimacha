// Az írás-pontozás ne legyen laza.
// Üres, egyszavas, értelmetlen ("asdf"), ismételt szavas vagy a feladat szövegéből bemásolt válasz
// NEM kap pontot; a jó válasz magas pontot kap; a pontozás arányos marad (a félig jó válasz fél
// pontot, a rövid de őszinte válasz a tartalmi pontokat kapja, a szószám-jegyet nem).

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

// 40 különböző, de értelmetlen "szó" (magánhangzós, nem betűhalmaz, nincs a szótárban).
const GIBBERISH = Array.from({ length: 40 }, (_, i) => `${['zo', 'ku', 'fe', 'bi', 'nu'][i % 5]}${['kafe', 'lupo', 'minu', 'torka'][i % 4]}${['xa', 'qui', 'zo', 'vu', 'ye', 'jo', 'ha', 'wu'][(i * 3) % 8]}`).join(' ');

describe('írás-üzenet: ami NEM kap pontot', () => {
  it('üres és csak szóköz = 0', () => {
    expect(scoreMsg('').correct).toBe(0);
    expect(scoreMsg('   \n  ').correct).toBe(0);
  });

  it('egyszavas válasz = 0', () => {
    expect(scoreMsg('hola').correct).toBe(0);
    expect(scoreMsg('Vivo').correct).toBe(0);
  });

  it('értelmetlen betűhalmaz = 0: "asdf", ismételve, és különböző értelmetlen szavakból is', () => {
    expect(scoreMsg('asdf').correct).toBe(0);
    expect(scoreMsg('asdf '.repeat(40)).correct).toBe(0);
    expect(scoreMsg('asdf qwer zxcv jkl lkj qwerty asdfgh ñlkj '.repeat(5)).correct).toBe(0);
    expect(scoreMsg(GIBBERISH).correct).toBe(0);
  });

  it('latin töltelékszöveg és más nyelvű (angol) szöveg = 0 (nem a célnyelv ismert szavai)', () => {
    expect(scoreMsg('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua').correct).toBe(0);
    expect(scoreMsg('Hello, my name is Anna and I am from Hungary. I live in Mexico City now. At the weekend I like to walk and read a book with my friends. What do you do on Saturday? I would like to know more about your house and your work.').correct).toBe(0);
  });

  it('a feladat szövegének (utasítás + kérés) beillesztése = 0, akárhányszor', () => {
    const pasted = `${message.instruction} ${message.prompt}`;
    expect(scoreMsg(pasted).correct).toBe(0);
    expect(scoreMsg(`${pasted} ${pasted}`).correct).toBe(0);
    expect(scoreMsg(message.prompt).correct).toBe(0);
    expect(scoreMsg(`${message.prompt} hola`).correct).toBe(0);
  });

  it('két szóba zsúfolt kulcsszó nem pont: a tartalmi pont a minimum-szószám felét kéri', () => {
    expect(scoreMsg('me llamo vivo sábado ¿?').correct).toBe(0);
    expect(scoreMsg('Me llamo Ana. Vivo en México. Sábado. ¿Y tú?').correct).toBe(0);
  });

  it('a bemásolt feladat-szöveg mellett írt valódi tartalom nem hozza vissza a másolt pontokat', () => {
    const r = scoreMsg(`${message.prompt} Hola.`);
    expect(r.items.every((i) => !i.ok)).toBe(true);
  });
});

describe('írás-üzenet: a jó válasz magas pontot kap, a pontozás arányos', () => {
  it('teljes jó válasz = minden tartalmi pont + a szószám-jegy', () => {
    const r = scoreMsg(GOOD);
    expect(r.items.map((i) => i.ok)).toEqual([true, true, true, true, true]);
    expect(r.correct).toBe(r.total);
  });

  it('ugyanez szótár nélkül (a szótár-lépés kimarad) is teljes', () => {
    expect(scoreMsg(GOOD, undefined).correct).toBe(5);
  });

  it('rövid, de őszinte válasz a tartalmi pontokat kapja, a szószám-jegyet nem', () => {
    const short = 'Hola, me llamo Ana y soy de Hungría. Vivo en la Ciudad de México con mi familia. Me gusta leer un libro.';
    const r = scoreMsg(short);
    expect(r.items.map((i) => i.ok)).toEqual([true, true, false, false, false]);
    expect(r.correct).toBe(2);
  });

  it('félig jó válasz (két tartalmi pont hiányzik) fél körüli pontot kap, nem nullát és nem teljeset', () => {
    const half =
      'Hola, me llamo Ana y soy de Hungría. Ahora vivo en la Ciudad de México con mi familia y tengo un perro. ' +
      'Me gusta mucho mi casa porque es grande y tiene una cocina muy bonita para comer con todos los amigos.';
    const r = scoreMsg(half);
    expect(r.correct).toBeGreaterThanOrEqual(2);
    expect(r.correct).toBeLessThan(r.total);
    expect(r.items[r.items.length - 1].ok).toBe(true); // a szószám megvan
  });

  it('a feladat szövegének természetes visszhangja (a "fines de semana" kifejezés) nem veszi el a pontot', () => {
    expect(scoreMsg(GOOD).items[2]).toMatchObject({ label: 'Habla del fin de semana', ok: true });
  });

  it('a jó válasz a bemásolt feladat-szöveggel együtt is megkapja a saját pontjait, a másolt rész nem számít', () => {
    const plain = scoreMsg(GOOD);
    const padded = scoreMsg(`${message.prompt} ${GOOD}`);
    expect(padded.correct).toBe(plain.correct);
  });
});

describe('űrlap: kitöltve ÉS értelmes értékkel', () => {
  const fields = Object.fromEntries(form.fields.map((f) => [f.id, f]));
  const GOOD_FORM = { nombre: 'Ana Kovács', edad: '30', nacionalidad: 'húngara', direccion: 'Calle Ficticia 123', telefono: '55 0000 0000', correo: 'ana@example.com', nivel: 'A1' };

  it('üres = 0, jó adatok = mind', () => {
    expect(scoreMockTask(form, {}).correct).toBe(0);
    expect(scoreMockTask(form, GOOD_FORM).correct).toBe(form.fields.length);
  });

  it('minden mezőben "asdf" (vagy sima "x") = 0 pont', () => {
    expect(scoreMockTask(form, Object.fromEntries(form.fields.map((f) => [f.id, 'asdf']))).correct).toBe(0);
    expect(scoreMockTask(form, Object.fromEntries(form.fields.map((f) => [f.id, 'x']))).correct).toBe(0);
    expect(scoreMockTask(form, Object.fromEntries(form.fields.map((f) => [f.id, '1']))).correct).toBe(0);
  });

  it('mezőnként a fajtának megfelelő érték kell', () => {
    expect(checkField(fields.nombre, 'Ana')).toBe(false); // nombre y apellidos: két szó
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
    expect(checkField(fields.direccion, 'Calle Rébsamen')).toBe(false); // szám nélkül nem cím
    expect(checkField(fields.direccion, 'qwerty 1234')).toBe(false);
    expect(checkField(fields.nacionalidad, 'asdf')).toBe(false);
    expect(checkField(fields.nacionalidad, 'húngara')).toBe(true);
  });
});

describe('papír szinten: az értelmetlen írás 0 pont, a jó 25', () => {
  it('az írás-papír pontja a tartalomtól függ, nem attól, hogy írt-e valamit', () => {
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
    // Félig kitöltve fél körüli pont: a jó űrlap + üres üzenet = 7 / 12 jegy.
    const half = pts(answers(goodForm, ''));
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(25);
  });
});

describe('segédek', () => {
  it('foldedTokens: kisbetű, ékezet nélkül, írásjel és szám nélkül', () => {
    expect(foldedTokens('¿Qué haces, Ñandú? 123 don\'t')).toEqual(['que', 'haces', 'nandu', "don't"]);
  });

  it('isNonsenseToken: magánhangzó nélküli, ismételt betűs, hosszú mássalhangzó-sor; valódi szó nem', () => {
    expect(isNonsenseToken('bcdfg')).toBe(true);
    expect(isNonsenseToken('aaaaa')).toBe(true);
    expect(isNonsenseToken('xyzbcdfg')).toBe(true);
    for (const w of ['hola', 'construccion', 'strengths', 'y', 'tres', "don't"]) expect(isNonsenseToken(w)).toBe(false);
  });

  it('assessMessage: bemásolt 5 szavas szakasz kiesik, természetes visszhang (3 szó) nem', () => {
    const ref = ['Escriba un mensaje a un amigo nuevo sobre los fines de semana'];
    const echo = assessMessage('Los fines de semana camino mucho', ref);
    expect(echo.words).toBe(6);
    const copy = assessMessage('escriba un mensaje a un amigo nuevo', ref);
    expect(copy.words).toBe(0);
    expect(copy.valid).toBe(false);
  });
});

describe('es→en irány (angol írás-feladat)', () => {
  const lexEn = lexiconFor('en');
  setPcicTarget('es');
  const email = { ...(MOCK_WRITING['en:A2'][0] as Omit<MockShortMessageTask, 'id'>), id: 'w1' } as MockShortMessageTask;
  const run = (text: string) => scoreMockTask(email, { text }, { lexicon: lexEn });
  const GOOD_EN =
    'Hello Anna, thank you very much for the invitation to your party on Saturday. Unfortunately I cannot come because I have to work all day. ' +
    'Last weekend I went to the cinema with my sister and we stayed at home on Sunday. How about we meet next week? ' +
    'We can have lunch together in the city centre. Sorry again and see you soon.';

  it('jó angol válasz magas pont, üres / értelmetlen / bemásolt feladat / spanyol szöveg = 0', () => {
    const good = run(GOOD_EN);
    expect(good.correct).toBe(good.total);
    expect(run('').correct).toBe(0);
    expect(run('asdf '.repeat(50)).correct).toBe(0);
    expect(run(`${email.instruction} ${email.prompt}`).correct).toBe(0);
    expect(run('Hola Ana, muchas gracias por la invitación a tu fiesta del sábado. No puedo ir porque tengo que trabajar todo el día. El fin de semana pasado fui al cine con mi hermana y nos quedamos en casa el domingo. ¿Qué te parece si nos vemos la próxima semana?').correct).toBe(0);
  });
});
