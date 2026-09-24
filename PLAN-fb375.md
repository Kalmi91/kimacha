# PLAN-fb375, nyelvtani feedbackek (FB375-383), 2026-09-23

Ág: `fix/fb375-grammar` (a `fix/fb-round-0923` 20a34b3-ra épül), worktree `~/ai/kimacha-wt-fb375`.
A futó `fix/fb-round-0923` session a PCIC-tételeket viszi (FB360-374, 384-385), ezekhez ez az ág NEM nyúl.
Végén egybe mergeljük a `feat/play-vagas` + `fix/fb-round-0923` ágakkal. Build és PR csak Kálmán szavára.
Becslés: ~400K token (Sonnet író-agent), 1-2 óra.

Kapu minden lépés után: `npx tsc --noEmit && npx jest 2>&1 | tail -5 && node scripts/audit-games.mjs 2>&1 | tail -5`
Minden lépés = 1 commit (`fix(grammar): ... (FBxxx)`), a sor itt `[x]`-re + időbélyeg.
Ütközés-kerülés: `lib/i18n/en.ts` a másik ágon is mozog, új kulcs csak a grammar-szekció VÉGÉRE, minimális.
`data/pcic*`, `lib/pcic*`, `AGENTS.md` tilos (a másik ágé).

## Lépések

- [x] 1. FB376 why-kérdés nem mondja, melyik szóra kérdez → kész, ha: minden `cp-why-*` tételnél látszik a kérdezett szó (kiemelve a mondatban + a kérdésben megnevezve), kapu zöld (2026-09-23)
- [x] 2. FB379 why-drillnél a fordítás elárulja a megoldást → kész, ha: a `tr` sor alapból rejtve, gombbal előhozható, válasz után magától látszik, jest-teszt rá, kapu zöld (2026-09-23)
- [ ] 3. FB381+382+383 igeragozási tábla színezése → kész, ha: jelmagyarázat a tábla FÖLÖTT, minden ige saját színű (chip = jelmagyarázat színe), rendhagyó táblán nincs tő/végződés bontás, jest-teszt rá, kapu zöld
- [ ] 4. FB377 Practice the table sorrendje → kész, ha: a deck a cellákat keverve adja, nem táblázat-sorrendben, teszt rá, kapu zöld
- [ ] 5. FB378 Practice the table angol prompt + 3 új ige → kész, ha: indefinido-regular és -irregular deck angol múlt idejű mondatot kérdez („she spoke" → habló), +1 tábla 3 szabályos igével, audit + kapu zöld
- [ ] 6. FB380 leckén belüli feladatonkénti % → kész, ha: a lecke képernyőn minden feladat mellett ugyanaz a %-logika látszik, ami kint a 80%-ot adja, teszt rá, kapu zöld
- [!] 7. FB375 szó-kártyacsomag a clases-de-palabras leckéhez → vár rám: melyik szavakból és mit kérdezzen (Kálmán dönt, RULES 8: képernyő-leírás jóváhagyás kód előtt)

## Részletes instrukció az író-agentnek (1:1)

Feedback-idézetek (Kimacha Feedback sheet, v4.0.26):
- FB375 `grammar:clases-de-palabras:lesson`: „itt is legyen egy nyelvtanulós kártya csomag a szavakbòl."
- FB376 `grammar:clases-de-palabras:drill:cp-why-01`: „itt nem értem, hogy mire vonatkozik a kérdés"
- FB377 `grammar:indefinido-regular:lesson`: „prectice the table vel kapcsolatban ne egymás után legyenek a szavak benne hanem össze keverve"
- FB378 `grammar:indefinido-regular:lesson`: „practic the table, legyen még 3 szo benne és angolul legyen hogy she speaks és ezt kelljen lefordítani igazából a múltidős alakja legyen és azt kelljen spanyolra fordítani"
- FB379 `grammar:indefinido-regular:drill:ir-why-01`: „itt legyen elrejtve a fordítás amit egy gombbal lehessen felhozni, mert ez most megmondja a megoldást"
- FB380 `grammar:indefinido-regular:lesson`: „kint írja, hogy ez a lecke 80% kész. itt benn jelezze ki az app, hogy melyik feladat milyen százalékkal van kész"
- FB381 `grammar:indefinido-irregular:lesson`: „itt a táblázatban mi ez a színezés? ez azért jött részre hogy a plusz részt mutassa, ha rendhagyí itt noncs értelme mert nincsen közös alap, azt vedd ki. mámont innen a színezést"
- FB382 `grammar:indefinido-irregular:lesson`: „strong stem verbs. Nem értem itt milyen szavak vannak a yo nál. most ez ugyanannak a szónak több alakja vagy más szavak?"
- FB383 `grammar:indefinido-irregular:lesson`: „tener ser poder ja hovy ezek ezek a szavak akkor legy úgy hogy felé teszed nem a tábla alá, és ami tener akkor az a táblazatba is legyen ugyan olyan színű, és mindegyik legyen különböző színű"

Fájlok: leckék `data/games/grammar/es/<topic>.json` (V2: `body` blokkok `kind`-dal, `items` drill-tételek), drill UI `components/grammar/GrammarDrill.tsx`, lecke-törzs `components/grammar/LessonBody.tsx` (`ConjugationTable`, jelmagyarázat a 88. sor körül, most a tábla ALATT), tábla-segédek `lib/grammar/tableShape.ts` (`splitStemEnding`, `verbClassColor`), deck logika `lib/grammar/tableDeck.ts`, deck UI `app/grammar/deck/[topic].tsx`, lecke-képernyő `app/grammar/[topic].tsx`. Olvass szeletet (`grep -n` + offset), ne teljes fájlt, ha nem kell.

1. FB376: a `why` tételeknek nincs mezője arra, melyik szóra vonatkozik a kérdés (`cp-why-01`: „El perro corre en el parque.", opciók IGE/FŐNÉV/MELLÉKNÉV, a helyes a FŐNÉV, azaz a kérdés a `perro`-ra megy, de ez nem látszik). Nézd meg, hogyan rendereli a GrammarDrill a `why` kérdést; ha nincs fókusz-mező, vezess be opcionális `focus: string` mezőt (a kérdezett szó pontosan úgy, ahogy az `es` mondatban áll), a UI emelje ki a mondatban (félkövér + tint szín), és a kérdés-sor nevezze meg (pl. en: `What is "perro"?`, a meglévő why-kérdés szöveg mintájára). Töltsd ki minden `cp-why-*` tételnél (a helyes opció alapján határozd meg a szót), és azoknál a más leckés `why` tételeknél is, ahol a mondatban több jelölt szó van. A típus/séma-validátor (audit-games) fogadja el a mezőt; ha a `focus` nem szerepel az `es`-ben, az audit bukjon.
2. FB379: a `why` drillnél a fordítás (`tr` a tanuló nyelvén) alapból rejtve, helyén egy kis gomb („Show translation", i18n kulcs); koppintásra megjelenik; válasz (helyes vagy hibás) után automatikusan látszik. Minden `why` tételre érvényes, nem csak az `ir-why-01`-re. Jest-teszt: rejtve indul, gombra látszik, válasz után látszik.
3. FB381+382+383, `ConjugationTable`:
   a) Jelmagyarázat a táblázat FÖLÉ (minden conjugation-táblán, nem csak a rendhagyón).
   b) Minden oszlop (ige) saját, egymástól jól megkülönböztethető színt kap oszlop-index szerint (új `verbColumnColor(index, isDark)` a `tableShape.ts`-ben, legalább 5 szín, világos+sötét téma, kontraszt a kártya-háttéren); a chip alakja ÉS a jelmagyarázat infinitivusa ugyanazt a színt kapja. Így „tener" a jelmagyarázatban és minden tener-alak a táblában azonos színű (FB383), és látszik, hogy a „yo" sor chipjei különböző igék (FB382).
   c) Rendhagyó tábla: ha a táblában bármelyik alak nem bontható tisztán `splitStemEnding`-gel az infinitivus tövére, a tábla rendhagyó módban megy: nincs szürke tő + színes végződés bontás, az egész alak az ige színével. Szabályos táblán (pl. indefinido-regular hablar/comer/vivir) a tő/végződés bontás MARAD, csak a végződés színe az oszlop-szín. A jelmagyarázatban a `-ar/-er/-ir` utótag csak szabályos táblán marad.
   d) A jelmagyarázat alá egy rövid sor (i18n): en „Each row is one person; each colour is one verb." (es megfelelővel).
   Jest-teszt: legenda a blokkok előtt; két különböző oszlop két különböző szín; rendhagyó táblán nincs tő-bontás, szabályoson van.
4. FB377: `tableDeck.ts`: a még nem kérdezett cellák sorrendje determinisztikusan keverve (seedelt keverés, pl. a lecke-id + reset-számláló a mag, hogy teszthető legyen, és resetkor új sorrend jöjjön), ne tábla-sorrendben. A meglévő ütemezés (helyes → kész, hibás → 60 s múlva újra, reset) változatlan. Teszt: két szomszédos kérdés nem mindig ugyanabból a sorból/oszlopból jön; mag azonos → sorrend azonos.
5. FB378:
   a) Adat: conjugation-tábla blokk opcionális `enPrompt: string[][]` mezője, alakja = `rows` személy-oszlop nélkül (sor = személy, oszlop = ige), tartalma a cella angol megfelelője a lecke igeidejében, névmással: yo → „I spoke", tú → „you spoke", él/ella/usted → „she spoke" vagy „he spoke" (igénként váltakozva), nosotros → „we spoke", vosotros → „you all spoke", ellos → „they spoke". Az audit ellenőrizze az alakot (sor- és oszlopszám egyezik).
   b) Töltsd ki az `indefinido-regular` és `indefinido-irregular` minden conjugation-táblájára (angol múlt idő, rendhagyó angol alakok helyesen: had, was, could, did, put, knew, came, said, went, gave, stb.).
   c) `indefinido-regular`: új conjugation-tábla a meglévő után, 3 új szabályos igével (trabajar, aprender, escribir), cím hu/en/es/de a meglévő tábla mintájára, `enPrompt`-tal. Ellenőrizd, hogy a szavak A1-A2 szintűek és az audit (glossary, szint) elfogadja.
   d) Deck UI: ha a cellához van `enPrompt`, a kártya fő promptja az angol mondat, alatta kicsiben az infinitivus (pl. „hablar"), és a tanuló a spanyol alakot írja (a válasz-ellenőrzés változatlan, `answer`). Ha nincs `enPrompt`, a mostani személy · ige prompt marad.
   Teszt: buildDeck `enPrompt` átadása, UI prompt-váltás mindkét esetre.
6. FB380: keresd meg, honnan jön a leckelistán kint látszó % (syllabus / progress számítás), és ugyanazzal a logikával a lecke képernyőn (`app/grammar/[topic].tsx`) minden feladat (drill-fajta / tábla-deck / ami a kinti %-ba beleszámít) mellett jelenjen meg a saját %-a. Új számítási logikát ne találj ki: a kinti szám a részek súlyozott összege legyen, a belső számok ezek a részek. Teszt: a részekből visszaszámolt összeg = a kinti %.

Az agent jelentése max 10 sor: lépésenként commit-hash + kapu utolsó sora, elakadás egy mondatban. Ha egy lépésnél kétértelmű a szándék, azt a lépést `[!]`-lel jelöld itt egy mondat okkal, és menj tovább a következőre.
