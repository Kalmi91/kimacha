# TOPICS-A0-A2.md, A0 + A2 topic-struktúra terv (DOC-FIRST)

> **Státusz (2026-06-28): A0 KÉSZ (`4d97224`); A2 a konkrét magyar nyelvvizsga
> tételsorára vár.** Forrás: FB21 (A0) + FB22/FB29 (A2). Doc-first döntés 2026-06-27.
> User-döntések 2026-06-28: (1) A0 10-csoport = IGEN; (2) `verbos_a0` = egyben;
> (3) A2 = **konkrét magyar nyelvvizsga** (NEM DELE); (4) topic-váltás jelzés = toast;
> (5) sorrend = **A0 előbb**. A build az A1-minta infráját (`data/topics/`,
> `data/sublevels/`, `tree.tsx`, ikonok, tech-tree) terjeszti ki.

## Miért (user-idézetek 1:1)

**FB21 (06-23, A0):** „topics résznél A0 szinten is legyenekek topicoc. Nézd meg,
hogy milyen szavak vannak itt és tedd be topicocba. Ha valaki egy topicot szeretne
tanulni, tudja azzal folytatni. Fontos Valahogy jelezzük a jatékosnak, hogy a topic
váltás az a jövőbeni szavak fajtáját, módosítja, nem pedig a múlt béli szavakat"

**FB22 (06-23):** „A2 nél nincsenek tipicoc. Legyenek csináld meg, a Nyelvvizsga
szóbeli tételei alapján."

**FB29 (06-25):** „Topics A2 nél, nincs feedback és nincsen topics választás, ezt is
csináld meg" (a feedback-gomb már KÉSZ = FB23; marad: topic-struktúra + választó.)

---

## 1. A0 topic-struktúra (100 szó → 10 topic)

Az A0 100 szava magas-gyakoriságú „túlélő/turista" szó (funkciószavak, alapigék,
alap-főnevek). Nem tematikus mint az A1, ezért **kommunikációs funkció szerint**
csoportosítva. Minden szó PONTOSAN egy topicba kerül. (id = a jelenlegi a0.json id.)

| # | topic id | ikon | név (hu / en / es / de) | szavak (id) |
|---|----------|------|--------------------------|-------------|
| 1 | basicos | 🧩 | Alapszavak / Core Words / Palabras Básicas / Grundwörter | no(1), sí(2), qué(4), es(5), muy(9), todo(10), nada(11), pero(7), también(59), mismo(47), solo(87) |
| 2 | cortesia | 🤝 | Udvariasság / Courtesy / Cortesía / Höflichkeit | gracias(51), por favor(52), perdón(53), hola(54), adiós(55) |
| 3 | personas | 👨‍👩‍👧 | Emberek & Család / People & Family / Personas y Familia / Menschen und Familie | yo(3), el hombre(16), la mujer(17), el amigo(22), la madre(42), el padre(43), el hijo(44), la gente(99), el nombre(41) |
| 4 | tiempo_a0 | ⏰ | Idő / Time / Tiempo / Zeit | el tiempo(13), ahora(12), mañana(56), siempre(57), nunca(58), todavía(60), después(62), antes(63), el día(49), la noche(50), la hora(100) |
| 5 | lugar_a0 | 🧭 | Hely & Irány / Place & Direction / Lugar y Dirección / Ort und Richtung | aquí(8), entre(61), fuera(64), dentro(65), el lugar(98), el mundo(48), la casa(14) |
| 6 | verbos_a0 | 🔁 | Gyakori Igék / Common Verbs / Verbos Comunes / Häufige Verben | comer(25), dormir(26), hablar(27), saber(28), poder(29), querer(30), ir(31), venir(32), tener(33), hacer(34), decir(35), dar(36), ver(37), creer(38), encontrar(39), llamar(40), pensar(78), sentir(79), esperar(80), entender(81), vivir(82), morir(83), gustar(84), necesitar(85) |
| 7 | cuerpo_a0 | 💪 | Testrészek / Body / Cuerpo / Körper | el corazón(66), la cabeza(67), la mano(68), los ojos(69) |
| 8 | emociones_a0 | 😊 | Érzések / Feelings / Emociones / Gefühle | bien(6), feliz(71), triste(72), el miedo(73), loco(88), seguro(89), juntos(86), el amor(23) |
| 9 | cualidades | ✨ | Tulajdonságok / Qualities / Cualidades / Eigenschaften | bueno(18), malo(19), grande(20), nuevo(45), pequeño(46), rápido(90), lento(91), bonito(92), fuerte(93), difícil(94), fácil(95), importante(96) |
| 10 | cosas | 📦 | Mindennapi Dolgok / Everyday Things / Cosas Cotidianas / Alltagsdinge | el dinero(21), el agua(24), la vida(15), la comida(70), la cosa(97), la verdad(74), la mentira(75), el problema(76), la ayuda(77) |

Összeg: 11+5+9+11+7+24+4+8+12+9 = **100** (hézagmentes, átfedésmentes).

**Al-szintek (A0.1-A0.3)** a tech-tree tier-ekhez (mint A1.1-A1.7):
- **A0.1, Első Szavak:** basicos, cortesia, personas (1-3)
- **A0.2, Élet & Idő:** tiempo_a0, lugar_a0, verbos_a0 (4-6)
- **A0.3, Test & Érzés:** cuerpo_a0, emociones_a0, cualidades, cosas (7-10)

`verbos_a0` (24 szó) a legnagyobb; ha túl nagy egy node-nak, build-időben kettéosztható
(verbos_a0_1 / verbos_a0_2), de elsőre egyben javaslom.

**Nyitott kérdés (A0):** a `verbos_a0` 24 szó OK egy topicként, vagy bontsam kétfelé?

---

## 2. A2 topic-struktúra (900 szó → 15 téma, nyelvvizsga szóbeli temario)

A2-nek jelenleg NINCS topic-struktúrája (csak lapos 900 szó). A user kérése:
„a Nyelvvizsga szóbeli tételei alapján".

> ⛔ **BLOKKOLVA (döntés 3, 2026-06-28): konkrét MAGYAR nyelvvizsga tételsora kell, NEM
> a DELE.** Az alábbi 15 téma a nemzetközi A2-standard (DELE), csak REFERENCIA. A build
> előtt kell a választott magyar nyelvvizsga (Origó/ITK, ECL, BME, Euroexam) spanyol A2
> **szóbeli tételsora**, küldd a tételsort vagy mondd meg melyik vizsga, ahhoz igazítom
> a témákat. Addig az A2-build NEM indul.

Referencia (DELE A2 / Instituto Cervantes szóbeli monólogo temario, a magyar tételsorhoz igazítandó):

| # | topic id | ikon | téma (hu / en / es / de) |
|---|----------|------|---------------------------|
| 1 | info_personal | 🪪 | Személyes adatok / Personal Info / Información Personal / Persönliche Daten |
| 2 | familia_amigos | 👪 | Család & Barátok / Family & Friends / Familia y Amigos / Familie und Freunde |
| 3 | casa_vivienda | 🏠 | Otthon & Lakás / Home & Housing / Casa y Vivienda / Wohnen |
| 4 | rutina_diaria_a2 | 🌅 | Napirend / Daily Routine / Rutina Diaria / Tagesablauf |
| 5 | trabajo_estudios | 💼 | Munka & Tanulás / Work & Studies / Trabajo y Estudios / Arbeit und Studium |
| 6 | comida_a2 | 🍽️ | Étkezés & Étterem / Food & Dining / Comida y Restaurante / Essen und Restaurant |
| 7 | compras_ropa | 🛍️ | Vásárlás & Ruha / Shopping & Clothes / Compras y Ropa / Einkaufen und Kleidung |
| 8 | salud_a2 | 🩺 | Egészség & Test / Health & Body / Salud y Cuerpo / Gesundheit und Körper |
| 9 | viajes_transporte | ✈️ | Utazás & Közlekedés / Travel & Transport / Viajes y Transporte / Reisen und Verkehr |
| 10 | ocio_tiempo_libre | 🎮 | Szabadidő & Hobbi / Leisure & Hobbies / Ocio y Tiempo Libre / Freizeit |
| 11 | clima_estaciones | ⛅ | Időjárás & Évszakok / Weather & Seasons / Clima y Estaciones / Wetter und Jahreszeiten |
| 12 | ciudad_servicios | 🏙️ | Város & Szolgáltatások / City & Services / Ciudad y Servicios / Stadt und Dienste |
| 13 | tecnologia_medios | 📱 | Technológia & Média / Technology & Media / Tecnología y Medios / Technik und Medien |
| 14 | fiestas_celebraciones | 🎉 | Ünnepek / Celebrations / Fiestas y Celebraciones / Feste |
| 15 | naturaleza_medioambiente | 🌳 | Természet & Környezet / Nature & Environment / Naturaleza y Medio Ambiente / Natur und Umwelt |

**Al-szintek (A2.1-A2.5)**, 3 téma/tier:
- A2.1 Én & Környezetem: info_personal, familia_amigos, casa_vivienda
- A2.2 Mindennapok: rutina_diaria_a2, trabajo_estudios, comida_a2
- A2.3 Város & Test: compras_ropa, salud_a2, viajes_transporte
- A2.4 Szabadidő & Világ: ocio_tiempo_libre, clima_estaciones, ciudad_servicios
- A2.5 Modern Élet: tecnologia_medios, fiestas_celebraciones, naturaleza_medioambiente

### A2 szó-besorolás (build-fázis, NEM most)

A 900 szó 15 témába sorolása **kurátor-pass** lesz a build-ben (Sonnet-agentek,
témánként), `audit-corpus`-szerű ellenőrzéssel (minden szó pontosan 1 témába, 0
besorolatlan). A jelenlegi a2.json `topic` mező nélküli, a build ezt tölti fel, az
id-k és a 4-nyelv tartalom VÁLTOZATLAN marad (csak `topic` + `topicOrder` + `subLevel`
mező jön hozzá, mint A1-nél).

**Nyitott kérdés (A2):** 15 téma jó, vagy más nyelvvizsgához (pl. ECL/origó magyar
rendszer szerint) igazítsam? A 15 a nemzetközi A2-standard; ha konkrét magyar
nyelvvizsga-temario kell, küldd a tételsort és ahhoz igazítom.

---

## 3. UX: topic-váltás = jövőbeni kártyák (FB21 kifejezett kérés)

User: „a topic váltás az a jövőbeni szavak fajtáját, módosítja, nem pedig a múlt béli
szavakat". Ez MÁR így működik (Task 12b): a választott topic CSAK az ÚJ (reps=0)
kártyákat szűri; az esedékes ISMÉTLÉSEK bármely topicból jönnek (FSRS-integritás).
A hiányzó rész = **vizuális jelzés**. Javaslat:
- A tech-tree node kiválasztásakor egy rövid toast/sor: „Mostantól a **{topic}** új
  szavai jönnek. A korábbi szavak ismétlése marad." (4 nyelven.)
- Vagy a Learn fejlécbe egy halvány alcím a topic-név alatt: „új szavak innen".

**Nyitott kérdés (UX):** toast a váltáskor, vagy állandó fejléc-felirat? (Javaslat: toast,
kevésbé zsúfol.)

---

## 4. Build-terv (jóváhagyás UTÁN, külön menetben)

A1-minta kiterjesztése (smallest-diff, default `es` viselkedés bájtra ne változzon):

1. **Adat:** `data/topics/a0.json` (10) + `data/sublevels/a0.json` (3);
   `data/topics/a2.json` (15) + `data/sublevels/a2.json` (5). A0/A2 word-JSON-ok
   kapnak `topic`/`topicOrder`/`subLevel` mezőt (id + tartalom változatlan).
2. **`data/topics.ts`:** `topicsByLevel` / `subLevelsByLevel` map kiterjesztése a0/a2-re
   (most csak a1 importált).
3. **`app/(tabs)/tree.tsx`:** a `level !== 'A1'` gate (63. sor) → `hasTopics(level)`
   alapú, hogy A0/A2 fát is rajzoljon. Feedback-gomb már KÉSZ (FB23).
4. **`app/(tabs)/index.tsx`:** `computeUnlockedTopics` szabad-választás ága A1-ről
   A0/A2-re is (vagy általános `hasTopics(level)`).
5. **i18n:** topic/sublevel nevek a JSON-ban (mint A1); UX-toast kulcs 4 nyelven.
6. **Korpusz-őr:** `audit-corpus.mjs` A0/A2-aware (most csak es a0/a1).

### Acceptance (a buildhez)
- A0: 10 topic / 3 al-szint, mind a 100 szó besorolva (0 árva); tech-tree rajzol A0-n.
- A2: 15 topic / 5 al-szint, mind a 900 szó besorolva (kurátor + audit: 0 árva, 0 dupla).
- Topic-választó + feedback-gomb működik A0-n és A2-n; választás perzisztens (web+native).
- `tsc` tiszta; `jest` zöld; `audit-corpus` P1=0; `database.ts` + `database.web.ts` szinkron.
- Default es A1 viselkedés változatlan.

---

## 5. Jóváhagyandó kérdések (megválaszolva 2026-06-28)

1. **A0 csoportok** (10 topic) → ✅ IGEN, így jó. (Beépítve: `4d97224`.)
2. **A0 `verbos_a0`** (24 ige) → ✅ EGYBEN. (Beépítve: `4d97224`.)
3. **A2 témák** → ✅ konkrét MAGYAR nyelvvizsga tételsora (NEM DELE). ⏳ Tételsor kell a buildhez (lásd 2. szekció).
4. **UX-jelzés** a topic-váltásnál → ✅ TOAST. (Beépítve: `4d97224`.)
5. **Sorrend** → ✅ A0 előbb (KÉSZ), aztán A2 (tételsor-függő).

## 6. Következő lépés (A2)

A2-build indításához küldd a magyar spanyol A2 szóbeli **tételsort** (vagy a vizsga nevét:
Origó/ITK, ECL, BME, Euroexam). Akkor: tételsorhoz igazított témalista (jóváhagyásod után) →
900 szó kurátor-besorolása → `data/topics/a2.json` + `data/sublevels/a2.json` + `tree.tsx`
(már A0/A1-re kész, A2 automatikusan jön a topic-adattal) + audit. A feedback-gomb A2-n már KÉSZ (FB23).
