# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

# Aktuális feladatok (iter1.2)

Kimacha nyelvtanuló app (Expo/React Native).

**FONTOS — Adat struktúra:**
- Szókészlet: `data/words/a0.json` ... `data/words/c2.json` (szintenként külön JSON)
- Vizsga kérdések: `data/exams/a0.json` ... `data/exams/c2.json` (szintenként külön JSON)
- `data/words.ts` / `data/exams.ts` = csak type + import wrapper. NE IDE ÍRJ adatot, JSON-okat szerkeszd!
- Exam UI: `components/ExamMode.tsx` (külön komponens, NEM index.tsx-ben)
- Done screen: `components/DoneScreen.tsx` (külön komponens)

## ~~1. Szókészlet bővítés (#19)~~ — KÉSZ

402→615 szó. A0:100, A1:80, A2:80, B1:94, B2:84, C1:83, C2:92. Commit: `cda2b3d`

## ~~2. Vizsga kérdések A1-C2~~ — KÉSZ

A1: 30 kérdés, C2: 30 kérdés hozzáadva. Összes szint lefedve: A0(40), A1(30), A2(40), B1(40), B2(40), C1(40), C2(30). Commit: `3f20fd1`

## ~~3. Bugfixek (4 db)~~ — KÉSZ

3a TTS gomb, 3b await, 3c i18n exam.tag (4 nyelv), 3d Levenshtein dist≤2. Commit: `a31107c`

## ~~4. Magyar mondatok természetesítése~~ — KÉSZ

214 sentence_hu javítva (A0:16, A1:16, A2:22, B1:29, B2:48, C1:46, C2:37). Commit: `ea4cbe0`

## ~~5. Vizsga gate logika (#11)~~ — KÉSZ (már implementálva volt)

70% gate, 10 kérdés, 9/10 pass, getReviewedWordCount, DoneScreen progresszió — mind megvolt.

## ~~6. Könnyű mondat kártya típus (#16) — tap-to-order~~ — KÉSZ

`components/EasySentenceCard.tsx` + index.tsx integráció. Sentence reps=0 → easy (tap-to-order), reps>0 → hard (typing). Commit: `09dba29`

## ~~7. Nehéz mondat kártya típus (#16)~~ — KÉSZ

Typing branch kiterjesztve sentence típusra (reps>0). Levenshtein check (dist≤2). Commit: `cc8e1ab`

## 8. A1 Grammar Topic Content (FELADAT 0 — LEGMAGASABB PRIORITÁS)

**Token égetés elsőként EZT csinálja.** Meglévő A1 szavak törlendők, teljes újraírás.

### Mi a feladat

Generáld le az A1 szókészletet topic-ok szerint. 30 topic (~246 kártya): 16 grammar + 14 szókincs, keverve.
Grammar kártya = ragozott forma / nyelvtani elem + kontextus mondat.
Vocab kártya = szó (névelővel ha főnév) + kontextus mondat.

### Topic lista (VÉGLEGES sorrend — keverve)

**📗 Grammar topic-ok:**

| # | topic ID | Kártyák |
|---|----------|---------|
| 1 | presente_ar | yo hablo, tú hablas, él/ella habla, nosotros hablamos, ellos/ellas hablan |
| 3 | presente_er | yo como, tú comes, él come, nosotros comemos, ellos comen |
| 5 | presente_ir | yo vivo, tú vives, él vive, nosotros vivimos, ellos viven |
| 7 | ser | yo soy, tú eres, él es, nosotros somos, ellos son |
| 8 | estar | yo estoy, tú estás, él está, nosotros estamos, ellos están |
| 10 | tener | yo tengo, tú tienes, él tiene, nosotros tenemos, ellos tienen |
| 12 | ir_verb | yo voy, tú vas, él va, nosotros vamos, ellos van |
| 13 | hacer | yo hago, tú haces, él hace, nosotros hacemos, ellos hacen |
| 15 | ser_vs_estar | 8 mondatpár: "Soy alto"/"Estoy cansado", stb. — `es` = mondat, `hu` = fordítás |
| 17 | hay_vs_esta | 5 pár: "Hay un gato en la calle"/"El gato está en la mesa" |
| 19 | genero_numero | 8 db: el libro/los libros, la casa/las casas, el niño/la niña, stb. |
| 21 | posesivos | 6 db: mi, tu, su, nuestro, vuestro, su (plural) — mondatban |
| 23 | preposiciones | 8 db: en, de, a, con, por, para, entre, sin — mindegyik mondatban |
| 25 | interrogativos | 7 db: qué, quién, dónde, cuándo, cómo, cuánto, por qué |
| 27 | negacion | 4 db: no hablo, no tengo, no hay, no es — mondatban |
| 29 | gustar | 5 db: me gusta, te gusta, le gusta, nos gusta, me gustan |

**📘 Vocab topic-ok:**

| # | topic ID | db | Tartalom |
|---|----------|----|----------|
| 2 | numeros | 12 | seis, siete, ocho, nueve, diez, veinte, treinta, cuarenta, cincuenta, sesenta, cien, mil |
| 4 | colores | 8 | negro, blanco, amarillo, naranja, rosa, morado, gris, marrón |
| 6 | presentacion | 10 | bemutatkozás: el nombre, el apellido, la edad, la nacionalidad, el país, la dirección, el correo, llamarse, presentar, encantado |
| 9 | comida | 15 | el arroz, el pollo, la carne, el pescado, la fruta, la verdura, el pan, la sopa, el queso, el huevo, la cerveza, el vino, el zumo, la sal, el azúcar |
| 11 | ropa | 10 | la camisa, el pantalón, los zapatos, la falda, el vestido, la chaqueta, el abrigo, el sombrero, las gafas, el cinturón |
| 14 | casa | 10 | el salón, el dormitorio, el jardín, la escalera, el techo, el suelo, la pared, el armario, la nevera, la lavadora |
| 16 | cuerpo | 10 | la pierna, el brazo, la espalda, el dedo, la rodilla, el hombro, el cuello, la nariz, la boca, la oreja |
| 18 | restaurante | 10 | el menú, la cuenta, el camarero, pedir, reservar, el plato, el tenedor, el cuchillo, la cuchara, la propina |
| 20 | profesiones | 10 | el profesor, el estudiante, el policía, el bombero, el abogado, el ingeniero, la enfermera, el cocinero, el conductor, el vendedor |
| 22 | transporte | 10 | el tren, el avión, la estación, el billete, la parada, el metro, la bicicleta, el taxi, el aeropuerto, el puerto |
| 24 | clima | 8 | nublado, el viento, la tormenta, la nieve, hace calor, hace frío, llover, nevar |
| 26 | dias_meses | 19 | lunes→domingo (7) + enero→diciembre (12) |
| 28 | ciudad | 10 | la plaza, el museo, la farmacia, el supermercado, la iglesia, el parque, el puente, la biblioteca, el banco, correos |
| 30 | tiempo | 8 | el reloj, el minuto, la hora, el mediodía, la medianoche, temprano, tarde (adv), puntual |

### JSON formátum (SZIGORÚAN kövesd)

```json
{
  "id": 1001,
  "level": "A1",
  "es": "yo hablo",
  "hu": "én beszélek",
  "en": "I speak",
  "de": "ich spreche",
  "topic": "presente_ar",
  "topicOrder": 1,
  "sentence_es": "Yo hablo español con mis amigos.",
  "sentence_hu": "Spanyolul beszélek a barátaimmal.",
  "sentence_en": "I speak Spanish with my friends.",
  "sentence_de": "Ich spreche Spanisch mit meinen Freunden."
}
```

### ID szabály
- A1 ID-k: 1001-től indulnak (A0 = 1-100, A1 = 1001+)
- topicOrder: 1-től sorszám a topic-on belül

### Topic definíciók fájl

Generáld: `data/topics/a1.json` — MIND A 30 TOPIC, a fenti sorrendben (order = topic #).

```json
[
  {"id": "presente_ar", "order": 1, "type": "grammar", "name_hu": "Jelen Idő: -ar Igék", "name_en": "Present Tense: -ar Verbs", "name_es": "Presente: Verbos -ar", "name_de": "Präsens: -ar Verben"},
  {"id": "numeros", "order": 2, "type": "vocab", "name_hu": "Számok", "name_en": "Numbers", "name_es": "Números", "name_de": "Zahlen"},
  {"id": "presente_er", "order": 3, "type": "grammar", "name_hu": "Jelen Idő: -er Igék", "name_en": "Present Tense: -er Verbs", "name_es": "Presente: Verbos -er", "name_de": "Präsens: -er Verben"},
  {"id": "colores", "order": 4, "type": "vocab", "name_hu": "Színek", "name_en": "Colors", "name_es": "Colores", "name_de": "Farben"},
  {"id": "presente_ir", "order": 5, "type": "grammar", "name_hu": "Jelen Idő: -ir Igék", "name_en": "Present Tense: -ir Verbs", "name_es": "Presente: Verbos -ir", "name_de": "Präsens: -ir Verben"},
  {"id": "presentacion", "order": 6, "type": "vocab", "name_hu": "Bemutatkozás", "name_en": "Introductions", "name_es": "Presentación", "name_de": "Vorstellung"},
  {"id": "ser", "order": 7, "type": "grammar", "name_hu": "Ser (Létige: Identitás)", "name_en": "Ser (To Be: Identity)", "name_es": "Ser (Identidad)", "name_de": "Ser (Sein: Identität)"},
  {"id": "estar", "order": 8, "type": "grammar", "name_hu": "Estar (Létige: Állapot)", "name_en": "Estar (To Be: State)", "name_es": "Estar (Estado)", "name_de": "Estar (Sein: Zustand)"},
  {"id": "comida", "order": 9, "type": "vocab", "name_hu": "Étel és Ital", "name_en": "Food & Drinks", "name_es": "Comida y Bebida", "name_de": "Essen und Trinken"},
  {"id": "tener", "order": 10, "type": "grammar", "name_hu": "Tener (Birtokolni)", "name_en": "Tener (To Have)", "name_es": "Tener", "name_de": "Tener (Haben)"},
  {"id": "ropa", "order": 11, "type": "vocab", "name_hu": "Ruházat", "name_en": "Clothing", "name_es": "Ropa", "name_de": "Kleidung"},
  {"id": "ir_verb", "order": 12, "type": "grammar", "name_hu": "Ir (Menni)", "name_en": "Ir (To Go)", "name_es": "Ir", "name_de": "Ir (Gehen)"},
  {"id": "hacer", "order": 13, "type": "grammar", "name_hu": "Hacer (Csinálni)", "name_en": "Hacer (To Do/Make)", "name_es": "Hacer", "name_de": "Hacer (Machen)"},
  {"id": "casa", "order": 14, "type": "vocab", "name_hu": "Ház és Lakás", "name_en": "House & Home", "name_es": "Casa y Hogar", "name_de": "Haus und Wohnung"},
  {"id": "ser_vs_estar", "order": 15, "type": "grammar", "name_hu": "Ser vs Estar", "name_en": "Ser vs Estar", "name_es": "Ser vs Estar", "name_de": "Ser vs Estar"},
  {"id": "cuerpo", "order": 16, "type": "vocab", "name_hu": "Testrészek", "name_en": "Body Parts", "name_es": "Partes del Cuerpo", "name_de": "Körperteile"},
  {"id": "hay_vs_esta", "order": 17, "type": "grammar", "name_hu": "Hay vs Está", "name_en": "Hay vs Está", "name_es": "Hay vs Está", "name_de": "Hay vs Está"},
  {"id": "restaurante", "order": 18, "type": "vocab", "name_hu": "Étterem", "name_en": "Restaurant", "name_es": "Restaurante", "name_de": "Restaurant"},
  {"id": "genero_numero", "order": 19, "type": "grammar", "name_hu": "Nem és Szám", "name_en": "Gender & Number", "name_es": "Género y Número", "name_de": "Genus und Numerus"},
  {"id": "profesiones", "order": 20, "type": "vocab", "name_hu": "Foglalkozások", "name_en": "Professions", "name_es": "Profesiones", "name_de": "Berufe"},
  {"id": "posesivos", "order": 21, "type": "grammar", "name_hu": "Birtokos Névmások", "name_en": "Possessive Adjectives", "name_es": "Adjetivos Posesivos", "name_de": "Possessivpronomen"},
  {"id": "transporte", "order": 22, "type": "vocab", "name_hu": "Közlekedés", "name_en": "Transport", "name_es": "Transporte", "name_de": "Verkehr"},
  {"id": "preposiciones", "order": 23, "type": "grammar", "name_hu": "Elöljárók", "name_en": "Prepositions", "name_es": "Preposiciones", "name_de": "Präpositionen"},
  {"id": "clima", "order": 24, "type": "vocab", "name_hu": "Időjárás", "name_en": "Weather", "name_es": "Clima", "name_de": "Wetter"},
  {"id": "interrogativos", "order": 25, "type": "grammar", "name_hu": "Kérdőszavak", "name_en": "Question Words", "name_es": "Interrogativos", "name_de": "Fragewörter"},
  {"id": "dias_meses", "order": 26, "type": "vocab", "name_hu": "Napok és Hónapok", "name_en": "Days & Months", "name_es": "Días y Meses", "name_de": "Tage und Monate"},
  {"id": "negacion", "order": 27, "type": "grammar", "name_hu": "Tagadás", "name_en": "Negation", "name_es": "Negación", "name_de": "Verneinung"},
  {"id": "ciudad", "order": 28, "type": "vocab", "name_hu": "Város és Irányok", "name_en": "City & Directions", "name_es": "Ciudad y Direcciones", "name_de": "Stadt und Richtungen"},
  {"id": "gustar", "order": 29, "type": "grammar", "name_hu": "Gustar Szerkezet", "name_en": "Gustar Structure", "name_es": "Estructura Gustar", "name_de": "Gustar-Struktur"},
  {"id": "tiempo", "order": 30, "type": "vocab", "name_hu": "Idő és Óra", "name_en": "Time & Clock", "name_es": "Tiempo y Reloj", "name_de": "Zeit und Uhr"}
]
```

### Content szabályok
- `sentence_hu` = idiomatikus magyar, NEM tükörfordítás
- Mondatok CSAK jelen idő (A1 szint)
- Mondatok egyszerűek (max 8 szó), A0 szókincsből amennyire lehet
- ser_vs_estar és hay_vs_esta topic-oknál: `es` mező = teljes mondat (nem szó), `hu` = fordítás
- NE legyen duplikátum A0 szavakkal

### Fájl műveletek
1. Töröld meglévő `data/words/a1.json` tartalmát
2. Írd bele az új ~96 grammar kártyát
3. Hozd létre `data/topics/a1.json`-t (mkdir `data/topics/` ha nem létezik)
4. Commitolj: `feat: restructure A1 as grammar topics (16 topics, ~96 cards)`

### Elfogadási kritérium
- ✅ 30 topic (16 grammar + 14 vocab), mindegyikben az elvárt számú kártya
- ✅ Minden kártya: id, level, es, hu, en, de, topic, topicOrder, sentence_* (mind 4 nyelv)
- ✅ ID-k: 1001-től, folyamatosak
- ✅ topicOrder: 1-től, topic-on belül folyamatos
- ✅ Nincs A0 duplikátum
- ✅ Vocab topic-ok: főneveknél MINDIG névelő (el/la/los/las)
- ✅ `data/topics/a1.json` létezik, 30 entry, helyes order, `type` mező (grammar/vocab)
- ✅ JSON szintaktikailag helyes (parseable)
- ✅ ~246 kártya összesen

---

## Szabályok
- Commitolj minden feladat után külön
- i18n: minden szöveg 4 nyelven (hu, en, es, de)
- Title Case gomb labeleken
- NE nyúlj más feature-höz, CSAK ami itt le van írva
