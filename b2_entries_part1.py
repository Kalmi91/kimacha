#!/usr/bin/env python3
"""
B2 entry data - part 1.
Each tuple: (raw_word, action, lemma_es, article_or_None, hu, en, sentence_es, sentence_hu, sentence_en, de, sentence_de)
action: 'add' | 'skip_proper' | 'skip_abbrev' | 'skip_existing' | 'skip_dup'

Lemmatization decisions:
- Conjugated verbs -> infinitive
- Inflected nouns -> singular (with article)
- Adj inflected -> base masc sg
- Clitic-attached verbs -> stripped infinitive
- Proper names, abbreviations -> skip
"""

# (raw, action, lemma, article, hu, en, sentence_es, sentence_hu, sentence_en, de, sentence_de)
# article: 'el'/'la'/'los'/'las' or None
ENTRIES = [
# batch0
("matarte",   "add", "matar",     None,  "megölni", "to kill", "No quiero matarte.", "Nem akarlak megölni.", "I don't want to kill you.", "töten", "Ich will dich nicht töten."),
("palacio",   "add", "el palacio",None,  "palota",  "palace",  "El rey vive en un palacio.", "A király palotában él.", "The king lives in a palace.", "der Palast", "Der König lebt in einem Palast."),
("convierte", "add", "convertir", None,  "átalakítani / változtatni", "to convert / to turn into", "El calor convierte el agua en vapor.", "A hő vízgőzzé alakítja a vizet.", "Heat converts water into steam.", "verwandeln / konvertieren", "Die Hitze verwandelt Wasser in Dampf."),
("ja",        "skip_abbrev", None, None, None, None, None, None, None, None, None),  # interjection/filler
("vivos",     "add", "vivo",      None,  "élő / eleven", "alive / living", "Salieron vivos del accidente.", "Élve kerültek ki a balesetből.", "They came out of the accident alive.", "lebendig / am Leben", "Sie kamen lebendig aus dem Unfall heraus."),
("pasamos",   "add", "pasar",     None,  "átmenni / eltölteni", "to pass / to spend (time)", "Pasamos el verano en la playa.", "A nyarat a strandon töltöttük.", "We spent the summer at the beach.", "verbringen / passieren", "Wir verbrachten den Sommer am Strand."),
("firme",     "add", "firme",     None,  "határozott / szilárd", "firm / steady", "Mantén una postura firme.", "Tarts ki a szilárd álláspontod mellett.", "Keep a firm stance.", "fest / standhaft", "Bleib bei deiner festen Haltung."),
("daría",     "add", "dar",       None,  "adni", "to give", "Te daría todo si pudiera.", "Mindent odaadnék neked, ha tudnám.", "I would give you everything if I could.", "geben", "Ich würde dir alles geben, wenn ich könnte."),
("piense",    "add", "pensar",    None,  "gondolni / gondolkodni", "to think", "Quiero que piense antes de decidir.", "Azt szeretném, ha gondolkodna, mielőtt dönt.", "I want him to think before deciding.", "denken / nachdenken", "Ich möchte, dass er nachdenkt, bevor er entscheidet."),
("oigo",      "add", "oír",       None,  "hallani", "to hear", "Oigo pasos en el pasillo.", "Lépéseket hallok a folyosón.", "I hear steps in the hallway.", "hören", "Ich höre Schritte auf dem Flur."),
("phil",      "skip_proper", None, None, None, None, None, None, None, None, None),
("sorprende", "add", "sorprender",None,  "meglepni", "to surprise", "Me sorprende su reacción.", "Meglep a reakciója.", "His reaction surprises me.", "überraschen", "Seine Reaktion überrascht mich."),
("alemanes",  "add", "alemán",    None,  "német (ember)", "German (person)", "Los alemanes celebran la Oktoberfest.", "A németek megünneplik az Oktoberfestet.", "Germans celebrate Oktoberfest.", "der Deutsche", "Die Deutschen feiern das Oktoberfest."),
("milagro",   "add", "el milagro",None,  "csoda", "miracle", "Fue un milagro que sobreviviera.", "Csoda volt, hogy túlélte.", "It was a miracle that he survived.", "das Wunder", "Es war ein Wunder, dass er überlebte."),
("soportar",  "add", "soportar",  None,  "elviselni / kibírni", "to bear / to stand", "No puedo soportar el ruido.", "Nem bírom elviselni a zajt.", "I can't stand the noise.", "ertragen / aushalten", "Ich kann den Lärm nicht ertragen."),
("dejaron",   "add", "dejar",     None,  "hagyni / elhagyni", "to leave / to let", "Me dejaron solo en casa.", "Egyedül hagytak otthon.", "They left me alone at home.", "lassen / verlassen", "Sie ließen mich allein zu Hause."),
("smith",     "skip_proper", None, None, None, None, None, None, None, None, None),
("disculpen", "add", "disculpar", None,  "bocsánatot kérni", "to excuse / to forgive", "Disculpen las molestias.", "Elnézést a kellemetlenségért.", "Please excuse the inconvenience.", "entschuldigen", "Entschuldigen Sie die Unannehmlichkeiten."),
("moda",      "add", "la moda",   None,  "divat", "fashion / trend", "Sigue la moda de cerca.", "Szorosan követi a divatot.", "She follows fashion closely.", "die Mode", "Sie folgt der Mode genau."),
("despacho",  "add", "el despacho",None, "iroda / dolgozószoba", "office / study", "El jefe está en su despacho.", "A főnök az irodájában van.", "The boss is in his office.", "das Büro / das Arbeitszimmer", "Der Chef ist in seinem Büro."),
("vecinos",   "add", "el vecino", None,  "szomszéd", "neighbor", "Los vecinos son muy amables.", "A szomszédok nagyon kedvesek.", "The neighbors are very kind.", "der Nachbar", "Die Nachbarn sind sehr freundlich."),
("vaso",      "add", "el vaso",   None,  "pohár", "glass (drinking)", "Dame un vaso de agua, por favor.", "Adj egy pohár vizet, kérlek.", "Give me a glass of water, please.", "das Glas", "Gib mir bitte ein Glas Wasser."),
("dejarte",   "skip_dup", None, None, None, None, None, None, None, None, None),  # dejar already added
("explosión", "add", "la explosión",None,"robbanás", "explosion", "La explosión destruyó el edificio.", "A robbanás elpusztította az épületet.", "The explosion destroyed the building.", "die Explosion", "Die Explosion zerstörte das Gebäude."),
("poderes",   "add", "el poder",  None,  "hatalom / erő", "power", "Tiene poderes especiales.", "Különleges erői vannak.", "He has special powers.", "die Macht / die Kraft", "Er hat besondere Kräfte."),
("regla",     "add", "la regla",  None,  "szabály", "rule", "Hay que respetar las reglas.", "Be kell tartani a szabályokat.", "You have to respect the rules.", "die Regel", "Man muss die Regeln einhalten."),
("acaban",    "skip_dup", None, None, None, None, None, None, None, None, None),  # acabar — common A2/B1 verb; adding it
("copia",     "add", "la copia",  None,  "másolat", "copy", "Necesito una copia del contrato.", "Szükségem van a szerződés másolatára.", "I need a copy of the contract.", "die Kopie", "Ich brauche eine Kopie des Vertrags."),
("siguiendo", "add", "seguir",    None,  "követni / folytatni", "to follow / to continue", "Sigue siguiendo tus sueños.", "Kövesd tovább az álmaidat.", "Keep following your dreams.", "folgen / weitermachen", "Folge weiterhin deinen Träumen."),
("viajar",    "add", "viajar",    None,  "utazni", "to travel", "Me encanta viajar por el mundo.", "Imádok utazni a világban.", "I love to travel the world.", "reisen", "Ich reise gerne durch die Welt."),
("cadena",    "add", "la cadena", None,  "lánc / csatorna", "chain / channel", "Rompió la cadena de oro.", "Eltörte az arányláncot.", "He broke the gold chain.", "die Kette / der Kanal", "Er zerbrach die Goldkette."),
("fábrica",   "add", "la fábrica",None,  "gyár", "factory", "Trabaja en una fábrica de coches.", "Egy autógyárban dolgozik.", "He works in a car factory.", "die Fabrik", "Er arbeitet in einer Autofabrik."),
("mantiene",  "skip_dup", None, None, None, None, None, None, None, None, None),  # mantener — adding via mantén later; add here
("meter",     "add", "meter",     None,  "betenni / belerakni", "to put in / to insert", "No metas la mano ahí.", "Ne tedd be a kezed oda.", "Don't put your hand in there.", "hineinstecken / einführen", "Steck deine Hand nicht da rein."),
("contenta",  "add", "contento",  None,  "elégedett / boldog", "happy / satisfied", "Estoy muy contenta con el resultado.", "Nagyon elégedett vagyok az eredménnyel.", "I'm very happy with the result.", "zufrieden / glücklich", "Ich bin sehr zufrieden mit dem Ergebnis."),
("comiendo",  "add", "comer",     None,  "enni", "to eat", "Estaba comiendo cuando llamaste.", "Éppen evett, amikor hívtál.", "He was eating when you called.", "essen", "Er aß gerade, als du anriefst."),
("educación", "add", "la educación",None,"oktatás / nevelés", "education", "La educación es clave para el futuro.", "Az oktatás kulcs a jövőhöz.", "Education is key to the future.", "die Bildung / die Erziehung", "Bildung ist der Schlüssel zur Zukunft."),
("maneras",   "add", "la manera", None,  "mód / módszer", "manner / way", "Hay muchas maneras de hacerlo.", "Sok módja van megcsinálni.", "There are many ways to do it.", "die Art und Weise", "Es gibt viele Wege, es zu tun."),
("fumar",     "add", "fumar",     None,  "dohányozni", "to smoke", "Está prohibido fumar aquí.", "Tilos itt dohányozni.", "Smoking is prohibited here.", "rauchen", "Hier ist das Rauchen verboten."),
("encantador","add", "encantador",None,  "bájos / elragadó", "charming / delightful", "Es un hombre encantador.", "Egy bájos férfi.", "He is a charming man.", "charmant / bezaubernd", "Er ist ein charmanter Mann."),
("cuantos",   "add", "cuánto",    None,  "mennyi / hány", "how many / how much", "¿Cuántos años tienes?", "Hány éves vagy?", "How old are you?", "wie viel / wie viele", "Wie alt bist du?"),
("homicidio", "add", "el homicidio",None,"emberölés", "homicide", "Lo acusaron de homicidio.", "Emberöléssel vádolták.", "He was charged with homicide.", "der Totschlag / der Mord", "Er wurde wegen Totschlags angeklagt."),
("madera",    "add", "la madera", None,  "fa (anyag)", "wood / timber", "La mesa es de madera.", "Az asztal fából van.", "The table is made of wood.", "das Holz", "Der Tisch ist aus Holz."),
("mayores",   "add", "mayor",     None,  "idősebb / nagyobb / felnőtt", "older / greater / adult", "Los mayores deben dar ejemplo.", "A felnőtteknek példát kell mutatniuk.", "Adults should set an example.", "älter / erwachsen", "Erwachsene sollten ein Beispiel geben."),
("grado",     "add", "el grado",  None,  "fok / fokozat", "degree / grade", "La temperatura subió tres grados.", "A hőmérséklet három fokkal emelkedett.", "The temperature rose three degrees.", "der Grad", "Die Temperatur stieg um drei Grad."),
("blancos",   "add", "blanco",    None,  "fehér", "white", "Llevaba zapatos blancos.", "Fehér cipőt viselt.", "He wore white shoes.", "weiß", "Er trug weiße Schuhe."),
("lord",      "skip_proper", None, None, None, None, None, None, None, None, None),
("anterior",  "add", "anterior",  None,  "korábbi / előző", "previous / prior", "El modelo anterior era mejor.", "A korábbi modell jobb volt.", "The previous model was better.", "vorherig / früher", "Das vorherige Modell war besser."),
("comisario", "add", "el comisario",None,"rendőrkapitány / biztos", "commissioner / inspector", "El comisario dirigió la investigación.", "A rendőrkapitány vezette a nyomozást.", "The commissioner led the investigation.", "der Kommissar", "Der Kommissar leitete die Ermittlung."),
("pizza",     "add", "la pizza",  None,  "pizza", "pizza", "Pedimos una pizza para cenar.", "Pizzát rendeltünk vacsorára.", "We ordered a pizza for dinner.", "die Pizza", "Wir bestellten eine Pizza zum Abendessen."),
("millas",    "add", "la milla",  None,  "mérföld", "mile", "Corrió diez millas sin parar.", "Tíz mérföldet futott megállás nélkül.", "He ran ten miles without stopping.", "die Meile", "Er lief zehn Meilen ohne Pause."),
("tira",      "add", "tirar",     None,  "dobni / húzni", "to throw / to pull", "No tires la basura aquí.", "Ne dobd ide a szemetet.", "Don't throw trash here.", "werfen / ziehen", "Wirf den Müll nicht hier hin."),
("fueran",    "skip_dup", None, None, None, None, None, None, None, None, None),  # ser/ir inflection — skip (basic)
("cumplir",   "add", "cumplir",   None,  "teljesíteni / betartani", "to fulfill / to comply", "Debes cumplir tu promesa.", "Be kell tartanod az ígéreted.", "You must keep your promise.", "erfüllen / einhalten", "Du musst dein Versprechen halten."),
("plata",     "add", "la plata",  None,  "ezüst / pénz (informális)", "silver / money (informal)", "Tengo plata suficiente.", "Van elég pénzem.", "I have enough money.", "das Silber / das Geld (umgangssprachlich)", "Ich habe genug Geld."),
("quedará",   "skip_dup", None, None, None, None, None, None, None, None, None),  # quedar — add via quedamos/quedé
("quedaré",   "add", "quedar",    None,  "maradni / találkozni", "to stay / to meet up", "Me quedaré en casa esta noche.", "Ma este otthon maradok.", "I'll stay home tonight.", "bleiben / sich treffen", "Ich bleibe heute Abend zu Hause."),
("aléjate",   "add", "alejarse",  None,  "eltávolodni / messzire menni", "to move away / to distance oneself", "Aléjate del peligro.", "Távolodj el a veszélytől.", "Move away from danger.", "sich entfernen / weggehen", "Entferne dich von der Gefahr."),
("decidir",   "add", "decidir",   None,  "eldönteni / dönteni", "to decide", "Tienes que decidir ahora.", "Most kell döntened.", "You have to decide now.", "entscheiden", "Du musst jetzt entscheiden."),
("lío",       "add", "el lío",    None,  "zűrzavar / baj", "mess / trouble", "Se metió en un lío.", "Bajba keveredett.", "He got himself into trouble.", "das Durcheinander / der Ärger", "Er geriet in Schwierigkeiten."),
("preguntó",  "skip_dup", None, None, None, None, None, None, None, None, None),  # preguntar — add via preguntando
("agencia",   "add", "la agencia",None,  "ügynökség", "agency", "Trabajo en una agencia de viajes.", "Egy utazási irodában dolgozom.", "I work at a travel agency.", "die Agentur", "Ich arbeite bei einer Reiseagentur."),
("humanidad", "add", "la humanidad",None,"emberiség", "humanity", "Hay que proteger a la humanidad.", "Meg kell védeni az emberiséget.", "We must protect humanity.", "die Menschheit", "Wir müssen die Menschheit schützen."),
("usado",     "add", "usar",      None,  "használni", "to use", "He usado este método antes.", "Korábban használtam ezt a módszert.", "I've used this method before.", "benutzen / verwenden", "Ich habe diese Methode zuvor benutzt."),
("guardias",  "add", "el guardia",None,  "őr", "guard", "Los guardias bloquearon la entrada.", "Az őrök elzárták a bejáratot.", "The guards blocked the entrance.", "der Wachmann", "Die Wachleute blockierten den Eingang."),
("parada",    "add", "la parada", None,  "megálló / megállás", "stop (bus/metro)", "La parada de autobús está cerca.", "A buszmegálló közel van.", "The bus stop is nearby.", "die Haltestelle", "Die Bushaltestelle ist in der Nähe."),
("leyes",     "add", "la ley",    None,  "törvény", "law", "Todos deben respetar las leyes.", "Mindenki köteles betartani a törvényeket.", "Everyone must respect the laws.", "das Gesetz", "Alle müssen die Gesetze einhalten."),
("funcionó",  "add", "funcionar", None,  "működni / működni (vminek)", "to work / to function", "El plan funcionó perfectamente.", "A terv tökéletesen működött.", "The plan worked perfectly.", "funktionieren", "Der Plan funktionierte einwandfrei."),
("odia",      "add", "odiar",     None,  "gyűlölni", "to hate", "Odia madrugar los lunes.", "Utálja hétfőnként korán kelni.", "She hates getting up early on Mondays.", "hassen", "Sie hasst es, montags früh aufzustehen."),
("levanta",   "add", "levantar",  None,  "emelni / felkelni", "to lift / to get up", "Levanta la mano si tienes preguntas.", "Emeld fel a kezed, ha kérdésed van.", "Raise your hand if you have questions.", "heben / aufstehen", "Heb die Hand, wenn du Fragen hast."),
("mires",     "skip_dup", None, None, None, None, None, None, None, None, None),  # mirar — skip
("respira",   "add", "respirar",  None,  "lélegezni", "to breathe", "Respira profundo y relájate.", "Lélegezz mélyen és lazíts.", "Breathe deeply and relax.", "atmen", "Atme tief und entspann dich."),
("escaleras", "add", "la escalera",None, "lépcső", "stairs / staircase", "Subió por las escaleras corriendo.", "Futva ment fel a lépcsőn.", "She ran up the stairs.", "die Treppe", "Sie rannte die Treppe hoch."),
("decisiones","add", "la decisión",None, "döntés", "decision", "Toma decisiones con cuidado.", "Gondosan hozz döntéseket.", "Make decisions carefully.", "die Entscheidung", "Triff Entscheidungen sorgfältig."),
("queréis",   "skip_dup", None, None, None, None, None, None, None, None, None),  # querer — skip
("salvaje",   "add", "salvaje",   None,  "vad / vadállati", "wild / savage", "El perro salvaje atacó al pastor.", "A vad kutya megtámadta a pásztort.", "The wild dog attacked the shepherd.", "wild / ungezähmt", "Der wilde Hund griff den Hirten an."),
("preguntando","skip_dup",None, None, None, None, None, None, None, None, None),  # preguntar — add it properly
("pasos",     "add", "el paso",   None,  "lépés", "step", "Dio los primeros pasos del proyecto.", "Megtette a projekt első lépéseit.", "He took the first steps of the project.", "der Schritt", "Er unternahm die ersten Schritte des Projekts."),
("ambulancia","add", "la ambulancia",None,"mentő / mentőautó", "ambulance", "Llamaron a la ambulancia de inmediato.", "Azonnal hívták a mentőt.", "They called the ambulance immediately.", "der Krankenwagen", "Sie riefen sofort den Krankenwagen."),
("traducción","add", "la traducción",None,"fordítás", "translation", "La traducción fue muy precisa.", "A fordítás nagyon pontos volt.", "The translation was very accurate.", "die Übersetzung", "Die Übersetzung war sehr präzise."),
("trabajado", "skip_dup", None, None, None, None, None, None, None, None, None),  # trabajar
("básicamente","add","básicamente",None, "alapvetően / lényegében", "basically / essentially", "Básicamente, no hay solución.", "Alapvetően nincs megoldás.", "Basically, there's no solution.", "grundsätzlich / im Grunde", "Im Grunde gibt es keine Lösung."),
("tratado",   "add", "tratar",    None,  "kezelni / megpróbálni / tárgyalni", "to treat / to try / to deal with", "Ha tratado de mejorar su situación.", "Megpróbálta javítani a helyzetét.", "He has tried to improve his situation.", "behandeln / versuchen", "Er hat versucht, seine Situation zu verbessern."),
("parado",    "add", "parar",     None,  "megállni / állni", "to stop / to be stopped", "El coche quedó parado en la carretera.", "Az autó az úton maradt állva.", "The car was stopped on the road.", "stoppen / anhalten", "Das Auto blieb auf der Straße stehen."),
("especiales","add", "especial",  None,  "különleges", "special", "Hoy es un día especial.", "Ma különleges nap van.", "Today is a special day.", "besonders / speziell", "Heute ist ein besonderer Tag."),
("mentiroso", "add", "mentiroso", None,  "hazug / hazudós", "liar", "No confíes en ese mentiroso.", "Ne bízz abban a hazudósban.", "Don't trust that liar.", "der Lügner", "Vertrau diesem Lügner nicht."),
("libres",    "add", "libre",     None,  "szabad", "free", "Somos libres de elegir.", "Szabadon választhatunk.", "We are free to choose.", "frei", "Wir sind frei zu wählen."),
("servicios", "add", "el servicio",None, "szolgáltatás / toalett", "service / restroom", "Los servicios están al fondo.", "A mellékhelyiség a végén van.", "The restrooms are at the end.", "der Service / die Toilette", "Die Toiletten sind am Ende des Ganges."),
("pedirle",   "skip_dup", None, None, None, None, None, None, None, None, None),  # pedir — add properly
("vivía",     "add", "vivir",     None,  "élni / lakni", "to live", "Vivía en Madrid hace diez años.", "Tíz évvel ezelőtt Madridban élt.", "He lived in Madrid ten years ago.", "leben / wohnen", "Er lebte vor zehn Jahren in Madrid."),
("medios",    "add", "el medio",  None,  "médium / közeg / közép", "medium / means / media", "Los medios de comunicación informan.", "A kommunikációs médiumok tájékoztatnak.", "The media inform the public.", "das Mittel / die Medien", "Die Medien informieren die Öffentlichkeit."),
("compra",    "add", "comprar",   None,  "vásárolni / vásárlás", "to buy / purchase", "Fue de compras al supermercado.", "Elment vásárolni a szupermarketbe.", "She went shopping at the supermarket.", "kaufen / der Einkauf", "Sie ging im Supermarkt einkaufen."),
("conocimiento","add","el conocimiento",None,"tudás / ismeret","knowledge","El conocimiento es poder.","A tudás hatalom.","Knowledge is power.","das Wissen","Wissen ist Macht."),
("armario",   "add", "el armario",None,  "szekrény", "wardrobe / closet", "Cuelga la ropa en el armario.", "Akaszd a szekrénybe a ruhát.", "Hang the clothes in the wardrobe.", "der Schrank", "Häng die Kleidung in den Schrank."),
("lobo",      "add", "el lobo",   None,  "farkas", "wolf", "El lobo aullaba en el bosque.", "A farkas üvöltött az erdőben.", "The wolf howled in the forest.", "der Wolf", "Der Wolf heulte im Wald."),
("quedamos",  "skip_dup", None, None, None, None, None, None, None, None, None),  # quedar already added
("ciertamente","add","ciertamente",None, "bizonyosan / kétségtelenül", "certainly / definitely", "Ciertamente, tiene razón.", "Kétségtelenül igaza van.", "He is certainly right.", "sicherlich / gewiss", "Er hat sicherlich recht."),
("tráfico",   "add", "el tráfico",None,  "forgalom / közlekedés", "traffic", "Hay mucho tráfico en hora punta.", "Csúcsforgalomban sok a kocsi az úton.", "There's a lot of traffic at rush hour.", "der Verkehr", "In der Stoßzeit gibt es viel Verkehr."),
("uniforme",  "add", "el uniforme",None, "egyenruha", "uniform", "Los estudiantes llevan uniforme.", "A diákok egyenruhát viselnek.", "Students wear uniforms.", "die Uniform", "Die Schüler tragen Uniformen."),
("estuvimos", "skip_dup", None, None, None, None, None, None, None, None, None),  # estar
# batch1
("alemania",  "skip_proper", None, None, None, None, None, None, None, None, None),
("suave",     "add", "suave",     None,  "sima / lágy / enyhe", "smooth / soft / mild", "La música es muy suave.", "A zene nagyon lágy.", "The music is very soft.", "sanft / weich / mild", "Die Musik ist sehr sanft."),
("propias",   "add", "propio",    None,  "saját", "own / proper", "Tiene sus propias ideas.", "Megvannak a saját ötletei.", "She has her own ideas.", "eigen", "Sie hat ihre eigenen Ideen."),
("balas",     "add", "la bala",   None,  "golyó (lőszer)", "bullet", "Encontraron dos balas en la pared.", "Két golyót találtak a falban.", "They found two bullets in the wall.", "die Kugel", "Sie fanden zwei Kugeln in der Wand."),
("asqueroso", "add", "asqueroso", None,  "undorító / utálatos", "disgusting / gross", "Ese olor es asqueroso.", "Az a szag undorító.", "That smell is disgusting.", "ekelhaft / widerlich", "Dieser Geruch ist widerlich."),
("ciento",    "add", "ciento",    None,  "száz (összetételekben)", "one hundred (in compounds)", "El noventa por ciento está listo.", "Kilencven százaléka kész.", "Ninety percent is ready.", "hundert (in Zusammensetzungen)", "Neunzig Prozent ist fertig."),
("consigo",   "add", "conseguir", None,  "elérni / megszerezni", "to achieve / to get", "No consigo entenderlo.", "Nem értem meg.", "I can't manage to understand it.", "erreichen / bekommen", "Ich schaffe es nicht, es zu verstehen."),
("encuentre", "skip_dup", None, None, None, None, None, None, None, None, None),  # encontrar
("jenny",     "skip_proper", None, None, None, None, None, None, None, None, None),
("conductor", "add", "el conductor",None,"sofőr / vezető", "driver / conductor", "El conductor perdió el control del coche.", "A sofőr elvesztette az uralmát az autó felett.", "The driver lost control of the car.", "der Fahrer", "Der Fahrer verlor die Kontrolle über das Auto."),
("equipos",   "add", "el equipo", None,  "csapat / felszerelés", "team / equipment", "Los dos equipos jugaron bien.", "Mindkét csapat jól játszott.", "Both teams played well.", "das Team / die Ausrüstung", "Beide Teams spielten gut."),
("arena",     "add", "la arena",  None,  "homok / aréna", "sand / arena", "Los niños juegan en la arena.", "A gyerekek homokban játszanak.", "The children play in the sand.", "der Sand / die Arena", "Die Kinder spielen im Sand."),
("park",      "skip_proper", None, None, None, None, None, None, None, None, None),
("licencia",  "add", "la licencia",None, "engedély / jogosítvány", "license / permit", "Necesitas una licencia para conducir.", "Jogosítványra van szükséged a vezetéshez.", "You need a license to drive.", "die Lizenz / der Führerschein", "Du brauchst einen Führerschein zum Fahren."),
("tíos",      "add", "el tío",    None,  "bácsi / fickó (informális)", "uncle / dude (informal)", "Mis tíos viven en el campo.", "A nagybácsiaim vidéken élnek.", "My uncles live in the countryside.", "der Onkel / der Typ (umgangssprachlich)", "Meine Onkel leben auf dem Land."),
("jackson",   "skip_proper", None, None, None, None, None, None, None, None, None),
("dijera",    "skip_dup", None, None, None, None, None, None, None, None, None),  # decir
("espejo",    "add", "el espejo", None,  "tükör", "mirror", "Se miró en el espejo.", "Megnézte magát a tükörben.", "She looked at herself in the mirror.", "der Spiegel", "Sie schaute sich im Spiegel an."),
("marina",    "add", "la marina", None,  "tengerészet / haditengerészet", "navy / marina", "Sirvió en la marina durante diez años.", "Tíz évig szolgált a haditengerészetnél.", "He served in the navy for ten years.", "die Marine", "Er diente zehn Jahre bei der Marine."),
("matando",   "skip_dup", None, None, None, None, None, None, None, None, None),  # matar already added
("seres",     "add", "el ser",    None,  "lény", "being / creature", "Los seres humanos son sociales.", "Az emberek társas lények.", "Human beings are social.", "das Wesen", "Menschen sind soziale Wesen."),
("fiestas",   "add", "la fiesta", None,  "buli / ünnepség", "party / celebration", "Las fiestas del pueblo duran tres días.", "A falusi ünnepségek három napig tartanak.", "The village festivities last three days.", "das Fest / die Party", "Das Dorffest dauert drei Tage."),
("mover",     "add", "mover",     None,  "mozgatni / mozogni", "to move", "No puedo mover el brazo.", "Nem tudom mozgatni a karomat.", "I can't move my arm.", "bewegen", "Ich kann meinen Arm nicht bewegen."),
("coincidencia","add","la coincidencia",None,"egybeesés / véletlen egyezés","coincidence","¡Qué coincidencia encontrarte aquí!","Micsoda véletlen, hogy itt találkozunk!","What a coincidence to meet you here!","die Zufälligkeit / der Zufall","Welch ein Zufall, dich hier zu treffen!"),
("análisis",  "add", "el análisis",None, "elemzés / analízis", "analysis", "El análisis mostró resultados positivos.", "Az elemzés pozitív eredményeket mutatott.", "The analysis showed positive results.", "die Analyse", "Die Analyse zeigte positive Ergebnisse."),
("llegando",  "skip_dup", None, None, None, None, None, None, None, None, None),  # llegar
("azúcar",    "add", "el azúcar", None,  "cukor", "sugar", "¿Quieres azúcar en el café?", "Akarsz cukrot a kávéba?", "Do you want sugar in your coffee?", "der Zucker", "Willst du Zucker im Kaffee?"),
("tim",       "skip_proper", None, None, None, None, None, None, None, None, None),
("casar",     "add", "casarse",   None,  "megházasodni / összekelni", "to get married", "Quieren casarse en primavera.", "Tavasszal akarnak összekelni.", "They want to get married in spring.", "heiraten", "Sie wollen im Frühling heiraten."),
("sótano",    "add", "el sótano", None,  "pince / alagsor", "basement / cellar", "El vino está guardado en el sótano.", "A bor a pincében van eltárolva.", "The wine is stored in the cellar.", "der Keller", "Der Wein ist im Keller gelagert."),
("volvamos",  "skip_dup", None, None, None, None, None, None, None, None, None),  # volver
("sabrá",     "skip_dup", None, None, None, None, None, None, None, None, None),  # saber
("taylor",    "skip_proper", None, None, None, None, None, None, None, None, None),
("ocasión",   "add", "la ocasión",None,  "alkalom / lehetőség", "occasion / opportunity", "Aprovechó la ocasión para hablar.", "Kihasználta az alkalmat a beszédre.", "He took the opportunity to speak.", "die Gelegenheit", "Er nutzte die Gelegenheit zu sprechen."),
("cheque",    "add", "el cheque", None,  "csekk", "check / cheque", "Pagó con un cheque.", "Csekkel fizetett.", "He paid with a check.", "der Scheck", "Er zahlte mit einem Scheck."),
("revisar",   "add", "revisar",   None,  "ellenőrizni / átnézni", "to review / to check", "Necesito revisar el documento.", "Át kell néznem a dokumentumot.", "I need to review the document.", "überprüfen / durchsehen", "Ich muss das Dokument überprüfen."),
("ponerme",   "skip_dup", None, None, None, None, None, None, None, None, None),  # poner
("suceder",   "add", "suceder",   None,  "megtörténni / következni", "to happen / to follow", "¿Qué puede suceder si fallamos?", "Mi történhet, ha kudarcot vallunk?", "What can happen if we fail?", "geschehen / passieren", "Was kann passieren, wenn wir scheitern?"),
("acusado",   "add", "el acusado",None,  "vádlott", "the accused / defendant", "El acusado negó todos los cargos.", "A vádlott tagadott minden vádat.", "The accused denied all charges.", "der Angeklagte", "Der Angeklagte bestritt alle Vorwürfe."),
("dímelo",    "skip_dup", None, None, None, None, None, None, None, None, None),  # decir
("quedé",     "skip_dup", None, None, None, None, None, None, None, None, None),  # quedar already added
("conciencia","add","la conciencia",None,"lelkiismeret / tudat","conscience / consciousness","Actuó según su conciencia.","A lelkiismerete szerint cselekedett.","He acted according to his conscience.","das Gewissen / das Bewusstsein","Er handelte nach seinem Gewissen."),
("doc",       "skip_abbrev", None, None, None, None, None, None, None, None, None),
("pesadilla", "add","la pesadilla",None, "rémálom", "nightmare", "Tuve una pesadilla terrible.", "Szörnyű rémálmom volt.", "I had a terrible nightmare.", "der Albtraum", "Ich hatte einen schrecklichen Albtraum."),
("sopa",      "add", "la sopa",   None,  "leves", "soup", "Preparó una sopa caliente.", "Forró levest készített.", "She prepared a hot soup.", "die Suppe", "Sie bereitete eine heiße Suppe zu."),
("saltar",    "add", "saltar",    None,  "ugrani / átugorni", "to jump / to leap", "El gato saltó sobre la mesa.", "A macska az asztalra ugrott.", "The cat jumped onto the table.", "springen", "Die Katze sprang auf den Tisch."),
("heridas",   "add", "la herida", None,  "seb / sérülés", "wound / injury", "Las heridas tardaron en curar.", "A sebek lassan gyógyultak.", "The wounds took time to heal.", "die Wunde / die Verletzung", "Die Wunden brauchten Zeit zum Heilen."),
("pienses",   "skip_dup", None, None, None, None, None, None, None, None, None),  # pensar already added
("suicidio",  "add", "el suicidio",None, "öngyilkosság", "suicide", "El suicidio es una tragedia social.", "Az öngyilkosság társadalmi tragédia.", "Suicide is a social tragedy.", "der Selbstmord / der Suizid", "Selbstmord ist eine gesellschaftliche Tragödie."),
("llamarme",  "skip_dup", None, None, None, None, None, None, None, None, None),  # llamar
("posibilidades","add","la posibilidad",None,"lehetőség","possibility","Existen varias posibilidades.","Több lehetőség is létezik.","There are several possibilities.","die Möglichkeit","Es gibt mehrere Möglichkeiten."),
("elegido",   "add", "elegir",    None,  "választani / megválasztani", "to choose / to elect", "Ha elegido el mejor camino.", "A legjobb utat választotta.", "He has chosen the best path.", "wählen / auswählen", "Er hat den besten Weg gewählt."),
("divorcio",  "add", "el divorcio",None, "válás", "divorce", "Pidió el divorcio tras cinco años.", "Öt év után válást kért.", "She filed for divorce after five years.", "die Scheidung", "Sie reichte nach fünf Jahren die Scheidung ein."),
("registros", "add", "el registro",None, "nyilvántartás / bejegyzés", "record / register", "Los registros muestran el historial.", "A nyilvántartások mutatják az előzményeket.", "The records show the history.", "das Register / der Datensatz", "Die Register zeigen die Vorgeschichte."),
("recibí",    "skip_dup", None, None, None, None, None, None, None, None, None),  # recibir
("joey",      "skip_proper", None, None, None, None, None, None, None, None, None),
("escuchas",  "skip_dup", None, None, None, None, None, None, None, None, None),  # escuchar
("mirad",     "skip_dup", None, None, None, None, None, None, None, None, None),  # mirar
("pierde",    "skip_dup", None, None, None, None, None, None, None, None, None),  # perder
("abogados",  "add", "el abogado",None,  "ügyvéd", "lawyer / attorney", "Los abogados presentaron nuevas pruebas.", "Az ügyvédek új bizonyítékokat mutattak be.", "The lawyers presented new evidence.", "der Anwalt / die Anwältin", "Die Anwälte präsentierten neue Beweise."),
("trataba",   "skip_dup", None, None, None, None, None, None, None, None, None),  # tratar already added
("americanos","add","el americano",None,"amerikai (ember)","American (person)","Los americanos celebran el Día de Acción de Gracias.","Az amerikaiak megünneplik a Hálaadást.","Americans celebrate Thanksgiving.","der Amerikaner","Die Amerikaner feiern Thanksgiving."),
("llevando",  "skip_dup", None, None, None, None, None, None, None, None, None),  # llevar
("miel",      "add", "la miel",   None,  "méz", "honey", "Le pone miel al té.", "Mézet tesz a teájába.", "She puts honey in her tea.", "der Honig", "Sie gibt Honig in ihren Tee."),
("regrese",   "skip_dup", None, None, None, None, None, None, None, None, None),  # regresar
("dilo",      "skip_dup", None, None, None, None, None, None, None, None, None),  # decir
("hermanas",  "add", "la hermana",None,  "nővér / húg", "sister", "Tengo dos hermanas mayores.", "Két idősebb nővérem van.", "I have two older sisters.", "die Schwester", "Ich habe zwei ältere Schwestern."),
("alemán",    "skip_dup", None, None, None, None, None, None, None, None, None),  # alemán already added via alemanes
("iría",      "skip_dup", None, None, None, None, None, None, None, None, None),  # ir
("lady",      "skip_proper", None, None, None, None, None, None, None, None, None),
("salí",      "skip_dup", None, None, None, None, None, None, None, None, None),  # salir
("particular","add","particular",  None, "különleges / magán", "particular / private", "Tiene un estilo muy particular.", "Nagyon különleges stílusa van.", "He has a very particular style.", "besonders / privat", "Er hat einen sehr besonderen Stil."),
("miras",     "skip_dup", None, None, None, None, None, None, None, None, None),  # mirar
("frontera",  "add","la frontera", None, "határ (ország)", "border / frontier", "Cruzaron la frontera ilegalmente.", "Illegálisan lépték át a határt.", "They crossed the border illegally.", "die Grenze", "Sie überquerten die Grenze illegal."),
("alerta",    "add","la alerta",   None, "riasztás / éberség", "alert / warning", "Las autoridades emitieron una alerta.", "A hatóságok riasztást adtak ki.", "The authorities issued an alert.", "die Warnung / die Alarmbereitschaft", "Die Behörden gaben eine Warnung heraus."),
("piscina",   "add","la piscina",  None, "medence (úszó)", "swimming pool", "Nos bañamos en la piscina.", "A medencében fürödtünk.", "We swam in the pool.", "das Schwimmbad / der Pool", "Wir badeten im Pool."),
("regalos",   "add","el regalo",   None, "ajándék", "gift / present", "Abrió los regalos con alegría.", "Örömmel nyitotta ki az ajándékokat.", "She opened the gifts with joy.", "das Geschenk", "Sie öffnete die Geschenke freudig."),
("comportamiento","add","el comportamiento",None,"viselkedés","behavior","Su comportamiento fue inaceptable.","A viselkedése elfogadhatatlan volt.","His behavior was unacceptable.","das Verhalten","Sein Verhalten war inakzeptabel."),
("julia",     "skip_proper", None, None, None, None, None, None, None, None, None),
("señales",   "add","la señal",    None, "jel / jelzés", "signal / sign", "Las señales de tráfico son obligatorias.", "A közlekedési jelzések kötelezők.", "Traffic signs are mandatory.", "das Signal / das Zeichen", "Verkehrszeichen sind verbindlich."),
("salimos",   "skip_dup", None, None, None, None, None, None, None, None, None),  # salir
("revista",   "add","la revista",  None, "folyóirat / magazin", "magazine", "Lee una revista de ciencias.", "Tudományos folyóiratot olvas.", "She reads a science magazine.", "die Zeitschrift", "Sie liest eine Wissenschaftszeitschrift."),
("hecha",     "skip_dup", None, None, None, None, None, None, None, None, None),  # hacer
("imágenes",  "add","la imagen",   None, "kép / képmás", "image / picture", "Las imágenes son muy impactantes.", "A képek nagyon megdöbbentők.", "The images are very striking.", "das Bild", "Die Bilder sind sehr eindrucksvoll."),
("llegas",    "skip_dup", None, None, None, None, None, None, None, None, None),  # llegar
("rápida",    "add","rápido",      None, "gyors", "fast / quick", "Es una solución rápida.", "Ez egy gyors megoldás.", "It's a quick solution.", "schnell", "Es ist eine schnelle Lösung."),
("canal",     "add","el canal",    None, "csatorna (tv/víz)", "canal / channel", "El canal televisivo emite en directo.", "A tévécsatorna élőben közvetít.", "The TV channel broadcasts live.", "der Kanal", "Der Fernsehkanal sendet live."),
("paciencia", "add","la paciencia",None, "türelem", "patience", "La paciencia es una virtud.", "A türelem erény.", "Patience is a virtue.", "die Geduld", "Geduld ist eine Tugend."),
("sacado",    "skip_dup", None, None, None, None, None, None, None, None, None),  # sacar
("echo",      "skip_dup", None, None, None, None, None, None, None, None, None),  # echar
("asesinos",  "add","el asesino",  None, "gyilkos", "murderer / killer", "Los asesinos fueron capturados.", "A gyilkosokat elfogták.", "The murderers were captured.", "der Mörder", "Die Mörder wurden gefasst."),
("oíste",     "skip_dup", None, None, None, None, None, None, None, None, None),  # oír already added
("dejando",   "skip_dup", None, None, None, None, None, None, None, None, None),  # dejar already added
("estarías",  "skip_dup", None, None, None, None, None, None, None, None, None),  # estar
("anteriormente","add","anteriormente",None,"korábban / azelőtt","previously / formerly","Anteriormente vivía en Francia.","Korábban Franciaországban élt.","He previously lived in France.","früher / zuvor","Er lebte früher in Frankreich."),
("vigilancia","add","la vigilancia",None,"megfigyelés / éberség","surveillance / vigilance","La cámara de vigilancia grabó todo.","A megfigyelőkamera mindent rögzített.","The surveillance camera recorded everything.","die Überwachung","Die Überwachungskamera zeichnete alles auf."),
("desierto",  "add","el desierto", None, "sivatag", "desert", "El desierto del Sahara es enorme.", "A Szahara sivatag hatalmas.", "The Sahara Desert is enormous.", "die Wüste", "Die Sahara-Wüste ist riesig."),
("asustada",  "add","asustado",    None, "ijedt / rémült", "frightened / scared", "La niña estaba asustada.", "A kislány ijedt volt.", "The girl was frightened.", "erschrocken / verängstigt", "Das Mädchen war verängstigt."),
("cuerda",    "add","la cuerda",   None, "kötél", "rope / string", "Ata el paquete con una cuerda.", "Kösd meg a csomagot egy kötéllel.", "Tie the package with a rope.", "das Seil / die Schnur", "Bind das Paket mit einem Seil."),
("míos",      "skip_dup", None, None, None, None, None, None, None, None, None),  # possessive pronoun — skip
]

print(f"Part1 entries defined: {len(ENTRIES)}")
adds = [e for e in ENTRIES if e[1] == 'add']
print(f"  adds: {len(adds)}")
print(f"  skip_proper: {len([e for e in ENTRIES if e[1]=='skip_proper'])}")
print(f"  skip_abbrev: {len([e for e in ENTRIES if e[1]=='skip_abbrev'])}")
print(f"  skip_dup: {len([e for e in ENTRIES if e[1]=='skip_dup'])}")
print(f"  skip_existing: {len([e for e in ENTRIES if e[1]=='skip_existing'])}")
