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

## 2. A2 topic-struktúra (900 szó → 15 téma, Origó/ITK alapfok szóbeli témalista)

User-döntés (2026-06-28): a **konkrét magyar nyelvvizsga = Origó (ITK, ELTE)** szóbeli
tételsora alapján.

**Forrás (hivatalos, 1:1):** ELTE Origó B1/alapfok szóbeli **Témalista** (`Temalista_B1-2026.pdf`,
onyc.hu). Megj: az Origó legalsó szintje = alapfok = B1, nincs külön A2 Origó-vizsga; ez a
hivatalos magyar lista a kimacha A2-höz. 15 fő téma, mind A/B altémával. A kimacha-topicok ezekre képezve:

| # | topic id | ikon | Origó téma | név (hu / en / es / de) |
|---|----------|------|------------|--------------------------|
| 1 | yo_familia | 👪 | Én és a családom | Én és a Család / Me & Family / Yo y la Familia / Ich und Familie |
| 2 | hogar_entorno | 🏠 | Otthon és szűkebb környezet | Otthon és Környék / Home & Neighborhood / Casa y Entorno / Zuhause und Umgebung |
| 3 | trabajo_dia | 💼 | Munka világa, napi tevékenység | Munka és Napirend / Work & Daily Life / Trabajo y Día a Día / Arbeit und Alltag |
| 4 | estudios | 🎓 | Tanulás világa | Tanulás / Studies / Estudios / Lernen |
| 5 | comunicacion | 📱 | Kommunikáció | Kommunikáció / Communication / Comunicación / Kommunikation |
| 6 | relaciones | 🧑‍🤝‍🧑 | Kapcsolatok más emberekkel | Kapcsolatok / Relationships / Relaciones / Beziehungen |
| 7 | ocio_cultura | 🎭 | Szórakozás, kultúra | Szórakozás és Kultúra / Entertainment & Culture / Ocio y Cultura / Unterhaltung und Kultur |
| 8 | salud_deporte | 🩺 | Egészség, sport | Egészség és Sport / Health & Sport / Salud y Deporte / Gesundheit und Sport |
| 9 | compras_servicios | 🛍️ | Vásárlás és szolgáltatások | Vásárlás és Szolgáltatások / Shopping & Services / Compras y Servicios / Einkaufen und Dienste |
| 10 | comida_a2 | 🍽️ | Étkezés | Étkezés / Eating / Comida / Essen |
| 11 | transporte_a2 | 🚆 | Közlekedés | Közlekedés / Transport / Transporte / Verkehr |
| 12 | viajes_a2 | ✈️ | Utazás | Utazás / Travel / Viajes / Reisen |
| 13 | naturaleza | 🌳 | Tágabb környezet, természet (állat, időjárás) | Természet / Nature / Naturaleza / Natur |
| 14 | ocio_moda | 👗 | Szabadidő, divat, öltözködés | Szabadidő és Divat / Free Time & Fashion / Ocio y Moda / Freizeit und Mode |
| 15 | paises | 🌍 | Magyarország és célnyelvi országok | Országok / Countries / Países / Länder |

**Al-szintek (A2.1-A2.5)**, 3 téma/tier (Origó-sorrend):
- A2.1 Én és Környezetem: yo_familia, hogar_entorno, trabajo_dia
- A2.2 Tanulás és Kapcsolat: estudios, comunicacion, relaciones
- A2.3 Szórakozás és Egészség: ocio_cultura, salud_deporte, compras_servicios
- A2.4 Mindennapok: comida_a2, transporte_a2, viajes_a2
- A2.5 Világ: naturaleza, ocio_moda, paises

### A2 szó-besorolás (build-fázis, HEAVY token-burn)

A 900 szó 15 témába sorolása **kurátor-pass** (Sonnet-agentek témánként), audit-ellenőrzéssel
(minden szó pontosan 1 témába, 0 besorolatlan). Az a2.json id + 4-nyelv tartalom VÁLTOZATLAN;
csak `topic` + `topicOrder` + `subLevel` mező jön hozzá (mint A1). A `tree.tsx` + feedback-gomb
már kész (A0/A1-gyel), az A2-fa automatikusan megjelenik amint a topic-adat megvan.

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
3. **A2 témák** → ✅ Origó (ITK, ELTE) alapfok szóbeli témalista (lásd 2. szekció). Témalista MEGVAN.
4. **UX-jelzés** a topic-váltásnál → ✅ TOAST. (Beépítve: `4d97224`.)
5. **Sorrend** → ✅ A0 előbb (KÉSZ), aztán A2 (most következik).

## 6. Következő lépés (A2): 900 szó besorolása

A 15-téma Origó-struktúra KÉSZ (fent). Hátra: a **900 A2 szó** besorolása a 15 témába, majd
`data/topics/a2.json` + `data/sublevels/a2.json` + words-patch (`topic`/`topicOrder`/`subLevel`)
+ topics.ts wiring + audit. A `tree.tsx` + feedback-gomb már kész, az A2-fa automatikusan
megjelenik a topic-adattal. Ez **HEAVY token-burn** (900 szó kurátor-pass), külön user-zöld
kell az indításhoz (vagy „égess tokent").
