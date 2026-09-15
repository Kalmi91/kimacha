# Prompt policy audit (PROMPT-POLICY 1 + 9)

Generated: 2026-09-15T13:08:48.212Z

Ez a riport a PROMPT-POLICY 9.1 "egyszeri korpusz-menet" bemenete: minden
sor egy szó, ami egy másik szóval megosztja a promptját (egy szinten belül).
A `[exact]` a teljesen azonos promptot jelöli, a `[partial: <sense>]` a
részleges átfedést és annak okát (a közös, normalizált sense).

## es sáv

- headword mező: `es`, prompt mező: `en`
- spec-elvárás: 17 exact + 179 partial

### A1

[partial: teacher]
- 1142 | el profesor / los profesores | the teacher / the teachers (both forms)
- 1147 | el profesor | the teacher

[partial: dog]
- 1143 | el perro / los perros | the dog / the dogs (both forms)
- 1382 | el perro | the dog

[partial: student]
- 1145 | el estudiante / los estudiantes | the student / the students (both forms)
- 1148 | el estudiante | the student

[partial: road]
- 1301 | el camino | the road / path (general)
- 1843 | la carretera | the road (highway)

### C1

[exact]
- 530 | rebatir | to refute
- 3925 | refutar | to refute

[exact]
- 6614 | la fabricación | manufacturing
- 6630 | manufacturero | manufacturing

[partial: magnitude]
- 504 | la envergadura | magnitude / scope
- 7362 | la magnitud | magnitude

[partial: prejudice]
- 516 | el perjuicio | damage / prejudice
- 6767 | el prejuicio | prejudice

[partial: situation]
- 521 | la coyuntura | situation / juncture
- 815 | la tesitura | situation / predicament

[partial: to avoid]
- 524 | eludir | to evade / to avoid
- 532 | soslayar | to sidestep / to avoid

[partial: firm]
- 542 | férrea | iron / firm
- 543 | tajante | categorical / firm

[partial: remote]
- 549 | recóndito | hidden / remote
- 6695 | remoto | remote

[partial: avant-garde]
- 6799 | la vanguardia | avant-garde
- 6813 | vanguardista | avant-garde (adj.)

### C2

[partial: credible]
- 623 | fidedigno | trustworthy / credible
- 650 | verosímil | plausible / credible

[partial: disgrace]
- 638 | el oprobio | opprobrium / disgrace
- 830 | el baldón | disgrace / stigma

[partial: insult]
- 828 | el denuesto | insult / invective
- 860 | la contumelia | contumely / insult

## hu sáv

- headword mező: `hu`, prompt mező: `en`
- spec-elvárás: 24 exact + 19 partial

### A0

[exact]
- 6100 | szia | hello
- 6106 | helló | hello

### A1

[exact]
- 6002 | te vagy | you are
- 6005 | ti vagytok | you are

[exact]
- 6298 | vissza | back
- 6359 | a hát | the back

[exact]
- 6300 | felkelek | I get up
- 9882 | kelek | I get up

[exact]
- 6325 | rövid | short
- 6861 | alacsony | short

[exact]
- 6425 | mikor | when
- 6996 | amikor | when

[exact]
- 6484 | a szatyor | the bag
- 9419 | a táska | bag

[exact]
- 6520 | a nagyapa | the grandfather
- 9401 | a nagypapa | grandfather

[exact]
- 6574 | az ég | the sky
- 9616 | az égbolt | sky

[exact]
- 6594 | a bors | the pepper
- 6776 | a paprika | the pepper

[exact]
- 6623 | a szabadság | the holiday
- 6909 | az ünnep | the holiday

[exact]
- 6641 | a házad | your house
- 9644 | a ti házatok | your house

[exact]
- 6642 | a háza | his house
- 9645 | az ő háza | his house

[exact]
- 6643 | a házunk | our house
- 9643 | a mi házunk | our house

[exact]
- 6712 | a szög | the nail
- 9510 | a köröm | nail

[exact]
- 6844 | utalok | I transfer
- 6852 | átszállok | I transfer

[exact]
- 6850 | a menetrend | the timetable
- 9840 | az órarend | timetable

[partial: you]
- 6201 | te | you
- 6204 | ti | you (plural)
- 6208 | ön | you (formal)
- 9640 | téged | you (object)

[partial: son]
- 6212 | a fiú | the son / the boy
- 9402 | a fia | son

[partial: daughter]
- 6213 | a lány | the daughter / the girl
- 9403 | a lánya | daughter

[partial: soup]
- 6240 | a leves | the soup
- 6254 | levest | soup (object)

[partial: meat]
- 6241 | a hús | the meat
- 6259 | húst | meat (object)

[partial: cheese]
- 6243 | a sajt | the cheese
- 6258 | sajtot | cheese (object)

[partial: milk]
- 6245 | a tej | the milk
- 6257 | tejet | milk (object)

[partial: wine]
- 6248 | a bor | the wine
- 6256 | bort | wine (object)

[partial: dress]
- 6370 | a ruha | the clothes / the dress
- 9418 | a női ruha | dress

## en sáv

- headword mező: `en`, prompt mező: `hu`
- spec-elvárás: 11 exact + 26 partial

## Summary

- es: 4 exact, 28 partial (DIFFERS from spec)
- hu: 34 exact, 20 partial (DIFFERS from spec)
- en: 0 exact, 0 partial (DIFFERS from spec)
