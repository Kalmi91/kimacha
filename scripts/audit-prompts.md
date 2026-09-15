# Prompt policy audit (PROMPT-POLICY 1 + 9)

Generated: 2026-09-15T04:05:10.003Z

Ez a riport a PROMPT-POLICY 9.1 "egyszeri korpusz-menet" bemenete: minden
sor egy szó, ami egy másik szóval megosztja a promptját (egy szinten belül).
A `[exact]` a teljesen azonos promptot jelöli, a `[partial: <sense>]` a
részleges átfedést és annak okát (a közös, normalizált sense).

## es sáv

- headword mező: `es`, prompt mező: `en`
- spec-elvárás: 17 exact + 179 partial

### A0

[partial: time]
- 13 | el tiempo | time
- 100 | la hora | hour / time

[partial: this]
- 101 | esto | this (thing)
- 103 | este / esta | this

[partial: that]
- 102 | eso | that (thing)
- 104 | ese / esa | that

### A1

[exact]
- 1026 | naranja | orange
- 1651 | la naranja | the orange

[exact]
- 1059 | el pescado | fish
- 1385 | el pez | the fish

[exact]
- 1129 | el menú | the menu
- 1290 | la carta | the menu

[exact]
- 1250 | claro | light
- 1278 | la luz | the light

[exact]
- 1273 | el bolso | the bag
- 1491 | la bolsa | bag

[exact]
- 1429 | frío | cold | frío is the TEMPERATURE (adjective): El agua está fría. The 
- 1519 | el resfriado | cold | el resfriado is the ILLNESS (noun): Tengo un resfriado. Cold

[exact]
- 1522 | el vendaje | bandage
- 3912 | la venda | bandage

[exact]
- 1757 | el pimiento | the pepper | pimiento is the VEGETABLE (bell pepper), masculine: el pimie
- 3875 | la pimienta | pepper | "La pimienta" on its own already means black pepper; "pimien

[partial: i am]
- 1046 | yo soy | I am
- 1051 | yo estoy | I am (state)

[partial: you are]
- 1047 | tú eres | you are
- 1052 | tú estás | you are (state)

[partial: he is]
- 1048 | él es | he is
- 1053 | él está | he is (state/location)

[partial: we are]
- 1049 | nosotros somos | we are
- 1054 | nosotros estamos | we are (state)

[partial: they are]
- 1050 | ellos son | they are
- 1055 | ellos están | they are (state)

[partial: teacher]
- 1142 | el profesor / los profesores | the teacher / the teachers
- 1147 | el profesor | the teacher

[partial: dog]
- 1143 | el perro / los perros | the dog / the dogs
- 1382 | el perro | the dog

[partial: student]
- 1145 | el estudiante / los estudiantes | the student / the students
- 1148 | el estudiante | the student

[partial: road]
- 1301 | el camino | the road / path
- 1786 | el sendero | the path
- 1843 | la carretera | the road

[partial: to work]
- 1409 | trabajar | to work
- 1846 | funcionar | to work (function)

[partial: short]
- 1417 | bajo | short / low
- 1423 | corto | short

[partial: old]
- 1421 | viejo | old
- 1848 | antiguo | old (ancient)

[partial: hot]
- 1428 | caliente | hot / warm
- 1821 | caluroso | hot (weather)

[partial: to spend]
- 1542 | gastar | to spend
- 1887 | pasar | to happen / to spend (time)

[partial: room]
- 1575 | la habitación | the room
- 1835 | la sala | the room (hall) | In Spain the living room is «el salón». «La sala» is a bigge

### A2

[exact]
- 242 | probar | to try
- 3538 | intentar | to try

[exact]
- 709 | la suerte | luck
- 3754 | suerte | luck

[exact]
- 3462 | diferentes | different
- 2045 | diferente | different

[exact]
- 1893 | ocurrir | to happen / to occur
- 1948 | suceder | to happen / to occur

[exact]
- 1997 | el primero | first
- 2282 | primero | first

[partial: memory]
- 201 | el recuerdo | memory / souvenir
- 3650 | la memoria | the memory

[partial: free]
- 246 | libre | free
- 2113 | gratis | free (of charge)

[partial: next]
- 3439 | próximo | next
- 2047 | siguiente | next / following

[partial: saint]
- 3453 | santo | saint / holy
- 3621 | santa | saint (feminine)

[partial: desire]
- 3454 | las ganas | the desire / the urge
- 3739 | el deseo | wish / desire

[partial: issue]
- 3469 | la cuestión | the question / the issue | Two meanings. 1) QUESTION as a topic raised: una cuestión di
- 2041 | el asunto | matter / issue / subject

[partial: welcome]
- 3473 | bienvenido | welcome
- 3659 | bienvenida | welcome (feminine)

[partial: apartment]
- 3477 | el apartamento | the apartment
- 1953 | el departamento | department / apartment

[partial: principal]
- 3483 | principal | main / principal
- 1932 | el director | director / principal

[partial: to stay]
- 3497 | quedar | to stay / to meet up | Two meanings. 1) TO BE LEFT / stay: queda poco pan = there i
- 3622 | quedarse | to stay (to remain)

[partial: ready]
- 3536 | preparado | prepared / ready
- 1958 | listos | ready
- 2021 | listo | ready / clever

[partial: idiot]
- 3549 | el imbécil | the idiot / the imbecile
- 2030 | el idiota | idiot / fool

[partial: gentlemen]
- 3572 | los señores | the gentlemen / ladies and gentlemen
- 1901 | los caballeros | gentlemen / knights

[partial: same]
- 3583 | mismos | same / themselves
- 2017 | igual | same / equal / anyway

[partial: brilliant]
- 3589 | brillante | brilliant
- 3599 | estupendo | great / wonderful
- 1935 | maravilloso | wonderful / marvelous
- 1998 | genial | great / brilliant

[partial: immediately]
- 3600 | inmediatamente | immediately
- 1951 | enseguida | right away / immediately

[partial: to finish]
- 3610 | acabar | to finish / to end
- 3731 | terminar | to finish

[partial: turn]
- 3654 | el turno | the turn / the shift | Two meanings. 1) TURN, whose go it is: ahora es mi turno. 2)
- 2018 | la vuelta | return / turn / walk

[partial: enough]
- 3679 | basta | enough / that's enough
- 2009 | bastante | quite / enough

[partial: fault]
- 3683 | la falta | lack / fault | Two meanings. 1) LACK: hay falta de tiempo = there is a lack
- 2025 | la culpa | fault / blame / guilt

[partial: real]
- 3687 | real | real
- 1925 | verdadero | true / real / genuine
- 1989 | cierto | certain / true

[partial: officer]
- 3694 | el agente | agent / officer | Two meanings. 1) AGENT, a representative: un agente de viaje
- 1895 | oficial | official / officer

[partial: strange]
- 3696 | raro | strange / rare | Two meanings. 1) STRANGE: qué situación tan rara. 2) RARE: e
- 3708 | extraño | strange

[partial: rest]
- 3707 | el resto | rest / remainder
- 2035 | los demás | the others / the rest

[partial: prison]
- 3730 | la cárcel | prison / jail
- 1964 | la prisión | prison

[partial: to be]
- 3743 | estar | to be (loc)
- 3746 | ser | to be

[partial: reason]
- 3766 | la razón | reason
- 1966 | la causa | cause / reason

[partial: except]
- 1902 | salvo | except / safe
- 2148 | excepto | except

[partial: beautiful]
- 1909 | hermosa | beautiful / gorgeous
- 2145 | bello | beautiful

[partial: funny]
- 1921 | gracioso | funny / amusing
- 2039 | divertido | fun / funny

[partial: room]
- 1936 | el espacio | space / room
- 2031 | el cuarto | room / quarter

[partial: moment]
- 1937 | el rato | a while / a moment
- 1977 | el momento | moment

[partial: guys]
- 1940 | los tipos | guys / types
- 1993 | los chicos | guys / boys

[partial: area]
- 1969 | la zona | zone / area
- 2068 | el área | area

[partial: so many]
- 1986 | tanto | so much / so many
- 2137 | tantos | so many

[partial: who]
- 1990 | quien | who / whoever
- 2204 | quienes | who (plural relative)

[partial: way]
- 1996 | la forma | way / form / shape
- 2000 | la manera | way / manner
- 2034 | el modo | mode / way

[partial: even]
- 2003 | siquiera | even / at least
- 2012 | incluso | even / including

[partial: above]
- 2014 | arriba | up / above
- 2043 | encima | on top / above

[partial: to stop]
- 2161 | parar | to stop
- 2214 | detenerse | to stop (oneself)

### B1

[exact]
- 759 | totalmente | completely
- 3799 | completamente | completely

[exact]
- 3809 | el delito | the crime
- 3847 | la delito | crime

[exact]
- 2513 | el pedazo | piece/chunk
- 2793 | el trozo | piece/chunk

[partial: to argue]
- 316 | discutir | to discuss / to argue
- 2906 | pelear | to fight / to argue

[partial: failure]
- 324 | el fracaso | failure
- 2911 | la falla | fault / failure

[partial: goal]
- 326 | el objetivo | objective / goal
- 752 | la meta | goal

[partial: honest]
- 345 | honesto | honest
- 2691 | sincero | sincere / honest

[partial: figure]
- 723 | la cifra | figure
- 2501 | el personaje | character / figure
- 2872 | la figura | figure / shape

[partial: rule]
- 736 | la norma | rule
- 2408 | la regla | rule / ruler

[partial: trace]
- 738 | la huella | trace
- 2495 | el rastro | trail / trace

[partial: stage]
- 746 | la etapa | stage
- 2882 | la fase | phase / stage

[partial: treatment]
- 751 | el tratamiento | treatment
- 2646 | la terapia | therapy / treatment

[partial: exactly]
- 3802 | exactamente | exactly
- 2487 | precisamente | precisely / exactly

[partial: honestly]
- 2309 | honestamente | honestly
- 2707 | sinceramente | sincerely / honestly
- 2902 | francamente | frankly / honestly

[partial: queue]
- 2384 | la cola | queue / tail
- 2616 | la fila | line / queue / row

[partial: mobile phone]
- 2398 | el celular | mobile phone / cell phone
- 2539 | el móvil | mobile phone

[partial: navy]
- 2438 | la marina | navy / marina
- 2935 | la armada | navy / armada

[partial: to move]
- 2439 | mover | to move
- 2910 | moverse | to move (oneself)

[partial: coincidence]
- 2440 | la coincidencia | coincidence
- 2490 | la casualidad | chance / coincidence

[partial: warning]
- 2453 | la alerta | alert / warning
- 2479 | el aviso | notice / warning

[partial: votes]
- 2502 | los votos | votes / vows
- 2873 | las voces | voices / votes

[partial: to show]
- 2571 | mostrar | to show
- 2641 | enseñar | to teach / to show

[partial: help]
- 2604 | el socorro | help / rescue
- 2625 | el rescate | rescue
- 2928 | el auxilio | help / aid

[partial: competition]
- 2615 | la competencia | competition / competence
- 2690 | el concurso | competition / contest

[partial: patrol]
- 2660 | la ronda | round / patrol
- 2975 | la patrulla | patrol

[partial: sentence]
- 2714 | la frase | sentence / phrase
- 2899 | la sentencia | sentence (legal) / verdict

[partial: to notice]
- 2877 | notar | to notice
- 2931 | fijarse | to notice / to pay attention

[partial: police]
- 2881 | policial | police / crime (adj.)
- 2964 | la policía | police

### B2

[exact]
- 3156 | la plataforma | the platform
- 7131 | el andén | platform

[exact]
- 3390 | el desperdicio | waste
- 7342 | el residuo | waste

[exact]
- 3399 | el panel solar | solar panel
- 7341 | la placa solar | solar panel

[exact]
- 7169 | la retransmisión | broadcast
- 7170 | emitir | broadcast

[partial: essential]
- 401 | imprescindible | essential / indispensable
- 3248 | vital | vital / essential

[partial: nuance]
- 404 | matiz | nuance
- 7171 | matizar | qualify / nuance

[partial: to perform]
- 415 | desempeñar | to perform / to play (a role)
- 3269 | realizar | to carry out / to perform

[partial: to link]
- 416 | vincular | to link / to connect
- 776 | concatenar | to link / to chain together

[partial: performance]
- 422 | el rendimiento | performance / yield
- 3017 | la función | function / performance

[partial: management]
- 423 | la gestión | management
- 3095 | la administración | administration / management

[partial: discovery]
- 3863 | el hallazgo | finding / discovery
- 3180 | el descubrimiento | the discovery

[partial: ruling]
- 3869 | el dictamen | expert opinion / ruling
- 3125 | el fallo | the failure / the ruling

[partial: attendance]
- 770 | la concurrencia | concurrence / attendance
- 3164 | la asistencia | the attendance / the assistance

[partial: stress]
- 3032 | el estrés | stress
- 7279 | recalcar | stress / emphasise

[partial: sentence]
- 3047 | la condena | sentence / condemnation
- 3158 | la oración | the prayer / the sentence

[partial: disorder]
- 3142 | el desorden | the disorder / the mess
- 3327 | el trastorno | disorder

[partial: board]
- 3162 | la tabla | the table / the board / the plank
- 7141 | embarcar | board
- 7205 | el tablero | board (game)

[partial: angle]
- 3182 | el ángulo | the angle
- 7155 | el enfoque | angle / approach
- 7460 | el planteamiento | approach / framing

[partial: content]
- 3194 | el contenido | the content
- 3235 | satisfecho | satisfied / content

[partial: connected]
- 3221 | relacionado | related / connected
- 3223 | conectado | connected

[partial: similar]
- 3226 | similar | similar
- 3247 | semejante | similar / such

[partial: properly]
- 3314 | correctamente | correctly / properly
- 7118 | debidamente | duly / properly

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

[partial: old]
- 6321 | régi | old (thing)
- 6522 | öreg | old (person)

[partial: dress]
- 6370 | a ruha | the clothes / the dress
- 9418 | a női ruha | dress

## en sáv

- headword mező: `en`, prompt mező: `hu`
- spec-elvárás: 11 exact + 26 partial

### A0

[partial: szia]
- 5800 | hello | szia
- 5801 | hi | szia (informális)

[partial: viszlát]
- 5806 | goodbye | viszlát
- 5808 | see you | viszlát (nemsokára)

[partial: egészségedre]
- 5827 | cheers | egészségedre
- 5828 | bless you | egészségedre (tüsszentésre)

### A1

[exact]
- 5027 | orange | narancssárga
- 8534 | orange colour | narancssárga

[exact]
- 5029 | pink | rózsaszín
- 8533 | pink colour | rózsaszín

[exact]
- 5051 | children | gyerekek
- 5223 | the children | a gyerekek

[exact]
- 5068 | that is | az ott van
- 7855 | there it is | ott van

[exact]
- 5093 | hat | kalap
- 8342 | sun hat | kalap

[exact]
- 5098 | there is not | nincs
- 5205 | it is not | az nincs

[exact]
- 5117 | under | alatt
- 8637 | during | alatt

[exact]
- 5118 | next to | mellett
- 7811 | beside | mellett

[exact]
- 5140 | teacher | tanár
- 5222 | the teacher | a tanár

[exact]
- 5295 | shorts | rövidnadrág
- 8701 | short trousers | rövidnadrág

[exact]
- 5357 | how old | hány éves
- 7829 | how many years | hány éves

[exact]
- 7755 | clean the house | takarít
- 8114 | to clean | takarít

[exact]
- 7854 | here it is | itt van
- 7909 | he is here | itt van

[exact]
- 8046 | ill | beteg
- 8159 | he is ill | beteg

[partial: ő van]
- 5003 | he is | ő van (hímnem)
- 5004 | she is | ő van (nőnem)

[partial: van]
- 5005 | it is | az van
- 5097 | there is | van (létezik)

[partial: hét]
- 5014 | seven | hét
- 5164 | week | hét (7 nap)

[partial: nap]
- 5020 | the sun | a nap
- 5165 | day | nap (napszak)

[partial: ő dolgozik]
- 5033 | he works | ő dolgozik (hímnem)
- 5034 | she works | ő dolgozik (nőnem)

[partial: hal]
- 5059 | fish | hal
- 7617 | goldfish | hal (élő)

[partial: ő ...-a]
- 5082 | his | az ő ...-a (hímnem)
- 5083 | her | az ő ...-a (nőnem)
- 5087 | its | az ő ...-a (tárgy)

[partial: nincsenek]
- 5101 | there are not | nincsenek
- 5298 | there aren't | nincsenek (röviden)

[partial: neki van]
- 5134 | he has got | neki van (hímnem)
- 5135 | she has got | neki van (nőnem)

[partial: van neki...?]
- 5138 | has he got | van neki...?
- 5326 | has she got | van neki...? (nőnem)

[partial: tud]
- 5149 | can | tud (képesség)
- 8504 | to know | tud

[partial: nem tud]
- 5150 | cannot | nem tud
- 5341 | can't | nem tud (röviden)

[partial: ő nincs]
- 5203 | he is not | ő nincs (hímnem)
- 5204 | she is not | ő nincs (nőnem)

[partial: nem dolgozik]
- 5237 | he doesn't work | nem dolgozik (röviden, hímnem)
- 5238 | she doesn't work | nem dolgozik (röviden, nőnem)

[partial: sok van]
- 5301 | there is a lot of | sok van (megszámlálhatatlan)
- 5302 | there are a lot of | sok van (megszámlálható)

[partial: mennyi]
- 5355 | how much | mennyi (megszámlálhatatlan)
- 5356 | how many | mennyi (megszámlálható)

[partial: csinálja épp?]
- 5372 | is he doing | csinálja épp? (hímnem)
- 5373 | is she doing | csinálja épp? (nőnem)

[partial: óra]
- 7634 | watch | óra (kar)
- 7721 | hour | óra (időtartam)

[partial: órák]
- 7843 | watches | órák
- 8660 | hours | órák (idő)

[partial: télikabát]
- 8026 | winter coat | télikabát
- 8343 | winter jacket | télikabát (rövid)

[partial: levél]
- 8224 | letter | levél
- 8749 | leaf | levél (fa)

### A2

[exact]
- 5400 | worked | dolgozott
- 8804 | worked hard | dolgozott

[exact]
- 5416 | drank | ivott
- 8812 | drank tea | ivott

[exact]
- 5432 | guide | idegenvezető
- 9026 | tour guide | idegenvezető

[exact]
- 5435 | arrival | érkezés
- 9023 | arrival time | érkezés

[exact]
- 5443 | tonight | ma este
- 5632 | this evening | ma este

[exact]
- 5469 | changing room | próbafülke
- 8831 | fitting room | próbafülke

[exact]
- 5480 | just | épp most
- 5676 | have just | épp most

[exact]
- 5497 | nervous | ideges
- 9246 | to be nervous | ideges

[exact]
- 5511 | slower | lassabb
- 8961 | more slow | lassabb

[exact]
- 5553 | forbidden | tilos
- 8939 | it is forbidden | tilos

[exact]
- 5555 | necessary | szükséges
- 8938 | it is necessary | szükséges

[exact]
- 5573 | app | alkalmazás
- 9161 | application | alkalmazás

[exact]
- 5578 | website | weboldal
- 9165 | web page | weboldal

[exact]
- 5609 | departure | az indulás
- 9024 | departure time | indulás

[exact]
- 5662 | shopping list | bevásárlólista
- 8839 | shopping note | bevásárlólista

[exact]
- 5742 | mistake | hiba
- 9125 | error | hiba

[exact]
- 5768 | interview | állásinterjú
- 8921 | job interview | állásinterjú

[exact]
- 5776 | laptop | laptop
- 9067 | laptop computer | laptop

[partial: jegy]
- 5426 | ticket | jegy
- 5535 | grade | jegy (osztályzat)

[partial: magasabb]
- 5516 | taller | magasabb
- 5708 | higher | magasabb (nem személy)

[partial: alacsonyabb]
- 5517 | shorter | alacsonyabb
- 5709 | lower | alacsonyabb (nem személy)

[partial: legmagasabb]
- 5525 | tallest | a legmagasabb
- 5722 | highest | a legmagasabb (nem személy)

[partial: legkönnyebb]
- 5530 | easiest | a legkönnyebb
- 5725 | lightest | a legkönnyebb (súly)

[partial: kell]
- 5544 | must | kell (kötelező)
- 5546 | have to | kell (szükséges)

[partial: nem szabad]
- 5545 | must not | nem szabad
- 5748 | mustn't | nem szabad (röviden)

[partial: munkatárs]
- 5557 | colleague | munkatárs
- 8922 | work colleague | munkatárs (kolléga)

[partial: fizetés]
- 5562 | salary | fizetés
- 9362 | payment | fizetés (tranzakció)

[partial: megérkezett]
- 5588 | arrived | megérkezett
- 5669 | has arrived | megérkezett (már)

[partial: készül...?]
- 5622 | is he going to | készül...? (ő, hímnem)
- 5623 | is she going to | készül...? (ő, nőnem)
- 5625 | is it going to | készül...? (az)

[partial: ő fog]
- 5636 | she will | ő fog (nőnem)
- 5637 | he will | ő fog (hímnem)

[partial: nehezebb]
- 5710 | heavier | nehezebb (súly)
- 5713 | harder | nehezebb (nehézség)
- 5714 | more difficult | nehezebb (hosszú melléknév)

[partial: könnyebb]
- 5711 | lighter | könnyebb (súly)
- 5712 | easier | könnyebb (nehézség)

[partial: messzebb]
- 5717 | further | messzebb (átv.)
- 9259 | farther | messzebb

[partial: legalacsonyabb]
- 5723 | lowest | a legalacsonyabb (nem személy)
- 5733 | shortest | a legalacsonyabb

[partial: legnehezebb]
- 5724 | heaviest | a legnehezebb (súly)
- 5726 | hardest | a legnehezebb (nehézség)
- 5727 | most difficult | a legnehezebb (hosszú melléknév)

[partial: kell-e neki?]
- 5750 | does he have to | kell-e neki? (hímnem)
- 5751 | does she have to | kell-e neki? (nőnem)

[partial: nem szükséges]
- 5760 | don't need to | nem szükséges (nem kell)
- 5761 | needn't | nem szükséges (röviden)
- 9268 | it is not necessary | nem szükséges

[partial: nehéz]
- 8828 | heavy | nehéz (súly)
- 8865 | difficult | nehéz (feladat)

## Summary

- es: 44 exact, 233 partial (DIFFERS from spec)
- hu: 34 exact, 22 partial (DIFFERS from spec)
- en: 64 exact, 93 partial (DIFFERS from spec)
