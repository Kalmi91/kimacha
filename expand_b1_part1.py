#!/usr/bin/env python3
"""
Expand b1.json with new entries from b1_batch0..b1_batch4.
Lemmatizes, dedupes against existing + intra-run set, skips proper nouns/abbrev.
"""
import json

DATA_PATH = '/home/kalmi/ai/kimacha/data/words/b1.json'

data = json.load(open(DATA_PATH, encoding='utf-8'))
existing_es = set()
for e in data:
    es = e['es'].lower()
    for art in ['el ', 'la ', 'los ', 'las ']:
        if es.startswith(art):
            es = es[len(art):]
            break
    existing_es.add(es)

max_id = max(e['id'] for e in data)
next_id = max_id + 1

intra_run = set()
skip_proper = []
skip_lemma_dup = []
skip_intra = []

# Each entry: (lemma_key, full_es, hu, en, sentence_es, sentence_hu, sentence_en, de, sentence_de)
entries_to_add = [
    # === BATCH 0 ===
    # oiga -> oír (already? check: 'oír' not in existing)
    ("oír", "oír", "hallgat / meghallgat", "to hear / to listen", "Oiga, ¿puede repetir eso más despacio?", "Figyeljen, meg tudná ismételni lassabban?", "Excuse me, could you repeat that more slowly?", "hören", "Hören Sie, könnten Sie das langsamer wiederholen?"),
    # estén -> estar (already in existing? 'estar' not listed)
    ("estar", "estar", "lenni (állapot)", "to be (state/condition)", "Espero que estén bien cuando lleguen.", "Remélem, jól lesznek, amikor megérkeznek.", "I hope they are well when they arrive.", "sein (Zustand)", "Ich hoffe, dass es ihnen gut geht, wenn sie ankommen."),
    # cuentas -> cuenta (noun: la cuenta)
    ("cuenta", "la cuenta", "számla / számadás", "account / bill", "¿Puedes revisar las cuentas del mes pasado?", "Meg tudod nézni a múlt havi számlákat?", "Can you check last month's accounts?", "die Rechnung / das Konto", "Kannst du die Konten des letzten Monats überprüfen?"),
    # taxi -> el taxi
    ("taxi", "el taxi", "taxi", "taxi", "Tomamos un taxi porque perdimos el último autobús.", "Taxit vettünk, mert lekéstük az utolsó buszt.", "We took a taxi because we missed the last bus.", "das Taxi", "Wir nahmen ein Taxi, weil wir den letzten Bus verpasst hatten."),
    # anillo -> el anillo
    ("anillo", "el anillo", "gyűrű", "ring", "Le regaló un anillo de oro el día de su cumpleaños.", "Arany gyűrűt ajándékozott neki a születésnapján.", "He gave her a gold ring on her birthday.", "der Ring", "Er schenkte ihr einen Goldring zu ihrem Geburtstag."),
    # richard -> SKIP proper noun
    # victoria -> SKIP proper noun (also means 'victory' but as listed context is name)
    # quiénes -> quién (pronoun, skip - grammatical word)
    # héroe -> el héroe
    ("héroe", "el héroe", "hős", "hero", "El bombero fue considerado un héroe por salvar a los niños.", "A tűzoltót hősnek tekintették, amiért megmentette a gyerekeket.", "The firefighter was considered a hero for saving the children.", "der Held", "Der Feuerwehrmann wurde als Held betrachtet, weil er die Kinder gerettet hatte."),
    # pequeños -> pequeño (adj, already? 'pequeño' not in existing)
    ("pequeño", "pequeño", "kicsi / kis", "small / little", "Los pequeños detalles marcan la diferencia en este trabajo.", "A kis részletek teszik a különbséget ebben a munkában.", "Small details make the difference in this job.", "klein", "Die kleinen Details machen den Unterschied in dieser Arbeit."),
    # decidido -> decidir (verb) — check existing: not there
    ("decidir", "decidir", "dönteni", "to decide", "Ha decidido cambiar de carrera después de muchos años.", "Úgy döntött, hogy évek után pályát vált.", "He has decided to change careers after many years.", "entscheiden", "Er hat sich entschieden, nach vielen Jahren die Karriere zu wechseln."),
    # películas -> la película
    ("película", "la película", "film", "film / movie", "Vimos una película muy emocionante el viernes por la noche.", "Nagyon izgalmas filmet néztünk péntek este.", "We watched a very exciting film on Friday night.", "der Film", "Wir haben am Freitagabend einen sehr aufregenden Film gesehen."),
    # trago -> el trago (drink)
    ("trago", "el trago", "korty / ital", "drink / sip", "Tomó un trago de agua antes de continuar hablando.", "Ivott egy korty vizet, mielőtt folytatta a beszédet.", "He took a sip of water before continuing to speak.", "der Schluck / das Getränk", "Er trank einen Schluck Wasser, bevor er weitersprach."),
    # volverá -> volver (check existing: not there)
    ("volver", "volver", "visszatérni / visszamenni", "to return / to come back", "Prometió que volvería antes de que anocheciera.", "Megígérte, hogy visszatér, mielőtt besötétedik.", "He promised he would return before dark.", "zurückkehren", "Er versprach, vor Einbruch der Dunkelheit zurückzukehren."),
    # árbol -> el árbol
    ("árbol", "el árbol", "fa", "tree", "El árbol más antiguo del parque tiene más de doscientos años.", "A park legöregebb fája több mint kétszáz éves.", "The oldest tree in the park is more than two hundred years old.", "der Baum", "Der älteste Baum im Park ist mehr als zweihundert Jahre alt."),
    # ibas -> ir (skip - basic verb, likely already covered; 'ir' not in existing list explicitly - add)
    ("ir", "ir", "menni", "to go", "¿Adónde ibas cuando te llamé?", "Hova mentél, amikor hívtalak?", "Where were you going when I called you?", "gehen / fahren", "Wohin gingst du, als ich dich anrief?"),
    # dientes -> el diente
    ("diente", "el diente", "fog (testrész)", "tooth", "Es importante cepillarse los dientes después de cada comida.", "Fontos minden étkezés után fogat mosni.", "It is important to brush your teeth after every meal.", "der Zahn", "Es ist wichtig, nach jeder Mahlzeit die Zähne zu putzen."),
    # encantado -> encantar (verb/adj)
    ("encantar", "encantar", "imádni / nagyon tetszeni", "to love / to delight", "Me encanta la música en vivo, especialmente el jazz.", "Imádom az élő zenét, különösen a jazzt.", "I love live music, especially jazz.", "begeistern / lieben", "Ich liebe Live-Musik, besonders Jazz."),
    # camión -> el camión
    ("camión", "el camión", "teherautó / busz (Mx)", "truck / bus (Mx)", "El camión de reparto llegó tarde por el tráfico.", "A szállítóteherautó késve érkezett a forgalom miatt.", "The delivery truck arrived late because of traffic.", "der Lastwagen / der Bus", "Der Lieferwagen kam wegen des Verkehrs zu spät."),
    # vender -> already? no. add
    ("vender", "vender", "eladni", "to sell", "Decidieron vender la casa y mudarse al campo.", "Úgy döntöttek, hogy eladják a házat és vidékre költöznek.", "They decided to sell the house and move to the countryside.", "verkaufen", "Sie entschieden sich, das Haus zu verkaufen und aufs Land zu ziehen."),
    # llame -> llamar (check existing: not there)
    ("llamar", "llamar", "hívni / nevezni", "to call / to name", "Llame a emergencias si nota algo sospechoso.", "Hívja a segélyszolgálatot, ha valami gyanúsat észlel.", "Call emergency services if you notice anything suspicious.", "anrufen / nennen", "Rufen Sie den Notruf an, wenn Sie etwas Verdächtiges bemerken."),
    # detente -> detener (stop)
    ("detener", "detener", "megállítani / feltartóztatni", "to stop / to arrest", "La policía logró detener al sospechoso cerca del aeropuerto.", "A rendőrség sikeresen feltartóztatta a gyanúsítottat a repülőtér közelében.", "The police managed to stop the suspect near the airport.", "anhalten / verhaften", "Die Polizei schaffte es, den Verdächtigen in der Nähe des Flughafens aufzuhalten."),
    # luchar -> already? no
    ("luchar", "luchar", "harcolni / küzdeni", "to fight / to struggle", "Hay que luchar por los derechos de todos los ciudadanos.", "Harcolni kell minden polgár jogaiért.", "We must fight for the rights of all citizens.", "kämpfen", "Wir müssen für die Rechte aller Bürger kämpfen."),
    # cabo -> el cabo
    ("cabo", "el cabo", "fok (földrajzi) / végpont / kötél vége", "cape / end / corporal", "Al cabo de una semana, los resultados fueron evidentes.", "Egy héttel később az eredmények nyilvánvalóak voltak.", "After a week, the results were evident.", "das Kap / der Korporal", "Nach einer Woche waren die Ergebnisse offensichtlich."),
    # lucha -> la lucha (luchar already added, lucha = noun)
    ("lucha", "la lucha", "harc / küzdelem", "fight / struggle", "La lucha por la igualdad requiere esfuerzo de toda la sociedad.", "Az egyenlőségért folytatott küzdelem az egész társadalom erőfeszítését igényli.", "The struggle for equality requires effort from all of society.", "der Kampf", "Der Kampf für Gleichheit erfordert den Einsatz der gesamten Gesellschaft."),
    # muere -> morir
    ("morir", "morir", "meghalni", "to die", "En la novela, el protagonista muere al final del tercer capítulo.", "A regényben a főszereplő a harmadik fejezet végén hal meg.", "In the novel, the protagonist dies at the end of the third chapter.", "sterben", "Im Roman stirbt der Protagonist am Ende des dritten Kapitels."),
    # reloj -> el reloj
    ("reloj", "el reloj", "óra / karóra", "clock / watch", "Se le paró el reloj justo antes de la reunión importante.", "Épp a fontos találkozó előtt megállt az órája.", "His watch stopped just before the important meeting.", "die Uhr", "Seine Uhr blieb kurz vor dem wichtigen Meeting stehen."),
    # averiguar
    ("averiguar", "averiguar", "kideríteni / utánajárni", "to find out / to investigate", "Necesito averiguar quién envió ese paquete anónimo.", "Ki kell deríteni, ki küldte azt a névtelen csomagot.", "I need to find out who sent that anonymous package.", "herausfinden", "Ich muss herausfinden, wer dieses anonyme Paket geschickt hat."),
    # volar
    ("volar", "volar", "repülni", "to fly", "Siempre le ha gustado volar sobre las montañas en helicóptero.", "Mindig is szeretett helikopterrel a hegyeken repülni.", "He has always loved flying over the mountains in a helicopter.", "fliegen", "Er hat es immer geliebt, mit dem Hubschrauber über die Berge zu fliegen."),
    # vayamos -> ir (already added)
    # tanta -> tanto (adj/adv - functional word, skip)
    # vendrá -> venir (already in existing)
    # corriendo -> correr
    ("correr", "correr", "futni", "to run", "Sale a correr todas las mañanas antes del desayuno.", "Minden reggel fut reggeli előtt.", "He goes running every morning before breakfast.", "laufen / rennen", "Er geht jeden Morgen vor dem Frühstück laufen."),
    # yendo -> ir (already added)
    # colegio -> el colegio
    ("colegio", "el colegio", "iskola", "school", "Mis hijos van al colegio público del barrio.", "A gyerekeim a kerületi állami iskolába járnak.", "My children go to the public school in the neighborhood.", "die Schule", "Meine Kinder gehen in die öffentliche Schule im Viertel."),
    # sonido -> el sonido
    ("sonido", "el sonido", "hang / zaj", "sound", "El sonido del mar siempre le ayuda a relajarse.", "A tenger hangja mindig segít neki ellazulni.", "The sound of the sea always helps him relax.", "der Klang / der Ton", "Das Meeresrauschen hilft ihm immer, sich zu entspannen."),
    # caballero -> el caballero
    ("caballero", "el caballero", "lovag / úriember", "knight / gentleman", "Se comportó como un verdadero caballero durante toda la velada.", "Az egész este során igazi úriemberként viselkedett.", "He behaved like a true gentleman throughout the evening.", "der Ritter / der Gentleman", "Er verhielt sich den ganzen Abend wie ein echter Gentleman."),
    # pasada -> pasado (adj/noun) -- la pasada or el pasado; 'pasada' is fem adj form
    ("pasado", "el pasado", "múlt", "past", "No podemos cambiar el pasado, solo aprender de él.", "Nem változtathatjuk meg a múltat, csak tanulhatunk belőle.", "We cannot change the past, only learn from it.", "die Vergangenheit", "Wir können die Vergangenheit nicht ändern, nur von ihr lernen."),
    # código -> el código
    ("código", "el código", "kód", "code", "Olvidé el código de acceso y no puedo entrar al edificio.", "Elfelejtettem a belépési kódot, és nem tudok bemenni az épületbe.", "I forgot the access code and can't get into the building.", "der Code", "Ich habe den Zugangscode vergessen und kann das Gebäude nicht betreten."),
    # hagamos -> hacer (basic verb, skip)
    # imagen -> la imagen
    ("imagen", "la imagen", "kép / képmás", "image / picture", "La imagen del candidato mejoró tras el debate televisivo.", "A jelölt képe javult a televíziós vita után.", "The candidate's image improved after the television debate.", "das Bild / das Image", "Das Bild des Kandidaten verbesserte sich nach der Fernsehdebatte."),
    # llegamos -> llegar
    ("llegar", "llegar", "megérkezni", "to arrive", "Llegamos justo a tiempo para ver el comienzo del espectáculo.", "Éppen időben értünk oda, hogy lássuk a műsor kezdetét.", "We arrived just in time to see the beginning of the show.", "ankommen", "Wir kamen gerade rechtzeitig an, um den Beginn der Show zu sehen."),
    # alguno -> algún (determiner, skip - functional)
    # millón -> el millón
    ("millón", "el millón", "millió", "million", "La empresa ganó más de un millón de euros el año pasado.", "A vállalat több mint egymillió eurót keresett tavaly.", "The company earned more than a million euros last year.", "die Million", "Das Unternehmen verdiente letztes Jahr mehr als eine Million Euro."),
    # malas -> malo (adj) -- 'malo' not in existing
    ("malo", "malo", "rossz / gonosz", "bad / evil", "Los malos hábitos son difíciles de eliminar sin disciplina.", "A rossz szokásokat nehéz fegyelem nélkül megszüntetni.", "Bad habits are difficult to eliminate without discipline.", "schlecht / böse", "Schlechte Gewohnheiten sind ohne Disziplin schwer abzulegen."),
    # dama -> la dama
    ("dama", "la dama", "hölgy", "lady", "Las damas del público aplaudieron al final de la actuación.", "A közönség hölgyei megtapsolták az előadás végén.", "The ladies in the audience applauded at the end of the performance.", "die Dame", "Die Damen im Publikum applaudierten am Ende der Aufführung."),
    # hielo -> el hielo
    ("hielo", "el hielo", "jég", "ice", "Añade un poco de hielo al vaso para que la bebida esté más fría.", "Tégy egy kis jeget a pohárba, hogy hidegebb legyen az ital.", "Add a little ice to the glass so the drink is colder.", "das Eis", "Gib etwas Eis ins Glas, damit das Getränk kälter ist."),
    # coño -> el coño (vulgar, include faithfully)
    ("coño", "el coño", "pina (vulgáris)", "cunt (vulgar)", "¡Coño, se me olvidó el paraguas y está lloviendo a cántaros!", "A francba, elfelejtettem az esernyőt és szakad az eső!", "Damn it, I forgot my umbrella and it's pouring rain!", "Scheiße (vulgär)", "Scheiße, ich habe den Regenschirm vergessen und es gießt in Strömen!"),
    # cayó -> caer
    ("caer", "caer", "esni / leesni", "to fall", "La fruta cayó del árbol por el fuerte viento.", "A gyümölcs lehullott a fáról az erős szélben.", "The fruit fell from the tree due to the strong wind.", "fallen", "Die Frucht fiel durch den starken Wind vom Baum."),
    # prensa -> la prensa
    ("prensa", "la prensa", "sajtó", "press", "La prensa libre es fundamental para una democracia saludable.", "A szabad sajtó alapvető fontosságú egy egészséges demokráciához.", "A free press is fundamental to a healthy democracy.", "die Presse", "Eine freie Presse ist für eine gesunde Demokratie grundlegend."),
    # vengan -> venir (already in existing)
    # eddie -> SKIP proper noun
    # televisión -> la televisión
    ("televisión", "la televisión", "televízió", "television", "Pasaba horas frente a la televisión en lugar de estudiar.", "Órákat töltött a televízió előtt tanulás helyett.", "He spent hours in front of the television instead of studying.", "das Fernsehen / der Fernseher", "Er verbrachte Stunden vor dem Fernseher, anstatt zu lernen."),
    # pasará -> pasar
    ("pasar", "pasar", "megtörténni / elmenni / tölteni (időt)", "to happen / to pass / to spend (time)", "¿Qué pasará si no tomamos una decisión antes del lunes?", "Mi fog történni, ha hétfő előtt nem hozunk döntést?", "What will happen if we don't make a decision before Monday?", "passieren / vergehen", "Was passiert, wenn wir bis Montag keine Entscheidung treffen?"),
    # momentos -> el momento
    ("momento", "el momento", "pillanat", "moment", "Hay momentos en la vida que no se olvidan nunca.", "Vannak pillanatok az életben, amelyeket soha nem felejt el az ember.", "There are moments in life that are never forgotten.", "der Moment / der Augenblick", "Es gibt Momente im Leben, die man nie vergisst."),
    # coger -> already 'coger' not in existing - but wait, let me check... 'cortar' is but not coger
    ("coger", "coger", "megfogni / felvenni / elkapni", "to grab / to catch / to take (ES)", "Coge el autobús de las ocho si no quieres llegar tarde.", "Vedd fel a nyolcas buszt, ha nem akarsz késni.", "Take the eight o'clock bus if you don't want to be late.", "nehmen / greifen", "Nimm den Acht-Uhr-Bus, wenn du nicht zu spät kommen willst."),
    # posibilidad -> la posibilidad
    ("posibilidad", "la posibilidad", "lehetőség", "possibility", "Existe la posibilidad de cancelar el viaje si el tiempo empeora.", "Fennáll a lehetősége az utazás törlésének, ha romlik az idő.", "There is a possibility of canceling the trip if the weather worsens.", "die Möglichkeit", "Es besteht die Möglichkeit, die Reise abzusagen, wenn das Wetter schlechter wird."),
    # hubiese -> haber (aux, skip)
    # mark -> SKIP proper noun
    # asiento -> el asiento
    ("asiento", "el asiento", "ülőhely / szék", "seat / chair", "Por favor, tome asiento y espere su turno.", "Kérem, foglaljon helyet és várja meg a sorát.", "Please take a seat and wait your turn.", "der Sitz / der Platz", "Bitte nehmen Sie Platz und warten Sie auf Ihren Zug."),
    # tuviste -> tener (basic auxiliary, skip)
    # herido -> herido (adj/noun)
    ("herido", "el herido", "sebesült / sérült", "the wounded / injured person", "Los médicos atendieron a los heridos de inmediato.", "Az orvosok azonnal ellátták a sebesülteket.", "The doctors attended to the wounded immediately.", "der Verletzte", "Die Ärzte versorgten die Verletzten sofort."),
    # maría -> SKIP proper noun
    # seguramente -> seguro (adv already via 'seguramente' - add as adverb)
    ("seguramente", "seguramente", "biztosan / valószínűleg", "surely / probably", "Seguramente olvidó la cita porque tenía muchas cosas en mente.", "Biztosan elfelejtette a találkozót, mert sok minden járt a fejében.", "He surely forgot the appointment because he had many things on his mind.", "sicher / wahrscheinlich", "Er hat den Termin sicher vergessen, weil er viel um die Ohren hatte."),
    # proyecto -> el proyecto
    ("proyecto", "el proyecto", "projekt / terv", "project / plan", "El proyecto de construcción del puente tardará tres años.", "A híd építési projektje három évig tart.", "The bridge construction project will take three years.", "das Projekt", "Das Brückenprojekt wird drei Jahre dauern."),
    # pared -> la pared
    ("pared", "la pared", "fal", "wall", "Colgó un cuadro grande en la pared del salón.", "Egy nagy képet akasztott a nappali falára.", "He hung a large painting on the living room wall.", "die Wand", "Er hängte ein großes Gemälde an die Wohnzimmerwand."),
    # sentí -> sentir
    ("sentir", "sentir", "érezni", "to feel", "Sentí un gran alivio cuando supe que todos estaban bien.", "Nagy megkönnyebbülést éreztem, amikor megtudtam, hogy mindenki jól van.", "I felt great relief when I found out everyone was okay.", "fühlen / spüren", "Ich fühlte große Erleichterung, als ich erfuhr, dass alle in Ordnung waren."),
    # sospechoso -> el sospechoso / adj
    ("sospechoso", "el sospechoso", "gyanúsított / gyanús", "suspect / suspicious", "La policía detuvo a un sospechoso cerca de la escena del crimen.", "A rendőrség feltartóztatott egy gyanúsítottat a bűntett helyszínének közelében.", "The police stopped a suspect near the crime scene.", "der Verdächtige", "Die Polizei hielt einen Verdächtigen in der Nähe des Tatorts an."),
    # naturaleza -> la naturaleza
    ("naturaleza", "la naturaleza", "természet", "nature", "Caminar por la naturaleza ayuda a desconectar del estrés diario.", "A természetben való séta segít lekapcsolódni a napi stresszről.", "Walking in nature helps to disconnect from daily stress.", "die Natur", "In der Natur spazieren zu gehen hilft, vom täglichen Stress abzuschalten."),
    # ésa -> ese/esa (demonstrative, skip)
    # perdió -> perder
    ("perder", "perder", "elveszíteni / veszíteni", "to lose", "Perdió las llaves del coche y tuvo que llamar a un cerrajero.", "Elveszítette az autókulcsait és lakatost kellett hívnia.", "He lost his car keys and had to call a locksmith.", "verlieren", "Er verlor seine Autoschlüssel und musste einen Schlüsseldienst rufen."),
    # robert -> SKIP proper noun
    # policías -> el policía
    ("policía", "el policía", "rendőr", "police officer", "Varios policías acordonaron la zona después del accidente.", "Több rendőr lezárta a területet a baleset után.", "Several police officers cordoned off the area after the accident.", "der Polizist", "Mehrere Polizisten sperrten nach dem Unfall die Zone ab."),
    # arreglar -> already? no
    ("arreglar", "arreglar", "megjavítani / rendezni", "to fix / to arrange", "El técnico tardó dos horas en arreglar el ordenador.", "A technikus két óráig tartott a számítógépet megjavítani.", "The technician took two hours to fix the computer.", "reparieren / arrangieren", "Der Techniker brauchte zwei Stunden, um den Computer zu reparieren."),
    # sentado -> sentar (sit)
    ("sentar", "sentar", "leültetni / illik", "to seat / to sit down", "Se sentó en el banco del parque y leyó el periódico.", "Leült a park padjára és elolvasta az újságot.", "He sat down on the park bench and read the newspaper.", "setzen / sitzen", "Er setzte sich auf die Parkbank und las die Zeitung."),
    # papi -> el papi (informal: dad) -- include
    ("papi", "el papi", "apu / papa", "dad / daddy", "Papi, ¿puedes venir a buscarme al colegio hoy?", "Apu, tudsz ma jönni értem az iskolába?", "Dad, can you come pick me up from school today?", "Papa / Vati", "Papa, kannst du mich heute von der Schule abholen?"),
    # ideas -> la idea
    ("idea", "la idea", "ötlet / elképzelés", "idea", "Tiene ideas muy creativas para mejorar el negocio familiar.", "Nagyon kreatív ötletei vannak a családi vállalkozás fejlesztésére.", "He has very creative ideas for improving the family business.", "die Idee", "Er hat sehr kreative Ideen zur Verbesserung des Familienunternehmens."),
    # obtener
    ("obtener", "obtener", "megszerezni / kapni", "to obtain / to get", "Es difícil obtener un préstamo sin un historial crediticio sólido.", "Nehéz hitelt kapni szilárd hitelhistória nélkül.", "It's hard to obtain a loan without a solid credit history.", "erhalten / bekommen", "Es ist schwer, ohne eine solide Kredithistorie einen Kredit zu bekommen."),
    # felices -> feliz (adj)
    ("feliz", "feliz", "boldog", "happy", "Son muy felices desde que se mudaron al campo.", "Nagyon boldogok, mióta vidékre költöztek.", "They are very happy since they moved to the countryside.", "glücklich", "Sie sind sehr glücklich, seit sie aufs Land gezogen sind."),
    # señoría -> already in existing
    # bebe -> beber (verb) / el bebé (noun) -- el bebé more likely as noun for freq
    ("bebé", "el bebé", "baba / csecsemő", "baby", "El bebé empezó a caminar a los doce meses.", "A baba tizenkét hónapos korában kezdett el járni.", "The baby started walking at twelve months.", "das Baby", "Das Baby begann mit zwölf Monaten zu laufen."),
    # mírame -> mirar
    ("mirar", "mirar", "nézni", "to look / to watch", "Mírame cuando te hablo, por favor.", "Nézz rám, amikor veled beszélek, kérlek.", "Look at me when I'm talking to you, please.", "anschauen / beobachten", "Schau mich an, wenn ich mit dir rede, bitte."),
    # chris -> SKIP proper noun
    # papa -> el papa (pope) or la papa (potato, LAm) -- context suggests 'potato' in LAm Spanish
    ("papa", "la papa", "krumpli (Lat-Am)", "potato (Latin America)", "En México, las papas fritas se comen con chile y limón.", "Mexikóban a sült krumplit chilével és citrommal eszik.", "In Mexico, French fries are eaten with chili and lime.", "die Kartoffel", "In Mexiko werden Pommes frites mit Chili und Limette gegessen."),
    # llorar
    ("llorar", "llorar", "sírni", "to cry", "Lloró de alegría cuando recibió la noticia de la beca.", "Örömében sírt, amikor megkapta a hírt az ösztöndíjról.", "She cried with joy when she received the news about the scholarship.", "weinen", "Sie weinte vor Freude, als sie die Nachricht über das Stipendium erhielt."),
    # quedó -> quedar
    ("quedar", "quedar", "maradni / találkozni", "to stay / to meet up", "¿A qué hora quedamos para el partido?", "Hány órakor találkozunk a meccsre?", "What time do we meet up for the game?", "bleiben / sich treffen", "Um wie viel Uhr treffen wir uns für das Spiel?"),
    # familiar -> familiar (adj) / el familiar (noun: relative)
    ("familiar", "el familiar", "rokon / ismerős", "relative / familiar", "Invitamos a todos los familiares a la celebración del aniversario.", "Minden rokont meghívtunk az évforduló ünnepségére.", "We invited all the relatives to the anniversary celebration.", "der Verwandte / vertraut", "Wir luden alle Verwandten zur Jubiläumsfeier ein."),
    # desastre -> el desastre
    ("desastre", "el desastre", "katasztrófa", "disaster", "La inundación fue un desastre para las familias de la región.", "Az árvíz katasztrófát jelentett a régió családjai számára.", "The flood was a disaster for the families of the region.", "die Katastrophe", "Die Überschwemmung war eine Katastrophe für die Familien der Region."),
    # locos -> loco (adj)
    ("loco", "loco", "őrült / bolond", "crazy / mad", "Está loco por el fútbol, no se pierde ningún partido.", "Rajong a focirt, egyetlen meccset sem hagy ki.", "He is crazy about football, he doesn't miss any game.", "verrückt", "Er ist verrückt nach Fußball und verpasst kein Spiel."),
    # escuche -> escuchar
    ("escuchar", "escuchar", "meghallgatni / hallgatni", "to listen", "Es importante escuchar a los demás antes de responder.", "Fontos meghallgatni a többieket, mielőtt válaszolunk.", "It's important to listen to others before responding.", "zuhören", "Es ist wichtig, anderen zuzuhören, bevor man antwortet."),
    # quedarte -> quedar (already added)
    # pedí -> pedir
    ("pedir", "pedir", "kérni / rendelni", "to ask for / to order", "Pedí una mesa para cuatro personas en el restaurante.", "Négy személyes asztalt rendeltem a vendéglőben.", "I asked for a table for four people at the restaurant.", "bitten / bestellen", "Ich bat um einen Tisch für vier Personen im Restaurant."),
    # sois -> ser (basic verb, skip)
    # nosotras -> pronoun, skip
    # will -> SKIP (English word / proper noun)
    # enfermedad -> la enfermedad
    ("enfermedad", "la enfermedad", "betegség", "illness / disease", "La enfermedad avanzó rápidamente a pesar del tratamiento.", "A betegség gyorsan előrehaladt a kezelés ellenére.", "The illness progressed rapidly despite the treatment.", "die Krankheit", "Die Krankheit schritt trotz der Behandlung schnell voran."),
    # encontraron -> encontrar
    ("encontrar", "encontrar", "megtalálni / találkozni", "to find / to meet", "Los investigadores encontraron nuevas pruebas en la escena.", "A nyomozók új bizonyítékokat találtak a helyszínen.", "The investigators found new evidence at the scene.", "finden / treffen", "Die Ermittler fanden neue Beweise am Tatort."),
    # colega -> el/la colega
    ("colega", "el colega", "kollega / haver", "colleague / buddy", "Mi colega me ayudó a preparar la presentación para el cliente.", "A kollégám segített felkészülni az ügyfélprezentációra.", "My colleague helped me prepare the presentation for the client.", "der Kollege", "Mein Kollege half mir, die Präsentation für den Kunden vorzubereiten."),
    # príncipe -> el príncipe
    ("príncipe", "el príncipe", "herceg", "prince", "El príncipe heredero asistió a la ceremonia oficial.", "Az örökös herceg részt vett a hivatalos szertartáson.", "The crown prince attended the official ceremony.", "der Prinz", "Der Kronprinz nahm an der offiziellen Zeremonie teil."),
    # bajar -> already? 'subir' is in existing but 'bajar' not
    ("bajar", "bajar", "lemenni / levinni / csökkenteni", "to go down / to lower", "Hay que bajar el volumen porque los vecinos se quejan.", "Le kell csökkenteni a hangerőt, mert a szomszédok panaszkodnak.", "We need to lower the volume because the neighbors are complaining.", "heruntergehen / senken", "Wir müssen die Lautstärke senken, weil die Nachbarn sich beschweren."),
    # === BATCH 1 ===
    # nervioso -> nervioso (adj)
    ("nervioso", "nervioso", "ideges / izgult", "nervous / anxious", "Estaba muy nervioso antes de la entrevista de trabajo.", "Nagyon ideges volt az állásinterjú előtt.", "He was very nervous before the job interview.", "nervös", "Er war sehr nervös vor dem Bewerbungsgespräch."),
    # vengo -> venir (already in existing)
    # inspector -> el inspector
    ("inspector", "el inspector", "felügyelő / nyomozó", "inspector", "El inspector revisó todos los documentos con gran detenimiento.", "A felügyelő nagy gondossággal ellenőrzött minden dokumentumot.", "The inspector reviewed all the documents very carefully.", "der Inspektor", "Der Inspektor prüfte alle Dokumente sehr sorgfältig."),
    # sirve -> servir
    ("servir", "servir", "szolgálni / felszolgálni / használni", "to serve / to be useful", "Esta herramienta sirve para cortar madera con precisión.", "Ez az eszköz precízen vágni tudja a fát.", "This tool is used to cut wood with precision.", "dienen / servieren", "Dieses Werkzeug dient dazu, Holz präzise zu schneiden."),
    # puertas -> la puerta
    ("puerta", "la puerta", "ajtó / kapu", "door / gate", "Dejó la puerta abierta y entró el frío.", "Nyitva hagyta az ajtót és bejött a hideg.", "He left the door open and the cold came in.", "die Tür / das Tor", "Er ließ die Tür offen und die Kälte kam herein."),
    # fuerzas -> la fuerza
    ("fuerza", "la fuerza", "erő", "strength / force", "Reunió todas sus fuerzas para terminar la maratón.", "Összeszedte minden erejét, hogy befejezze a maratont.", "He gathered all his strength to finish the marathon.", "die Kraft / die Stärke", "Er sammelte all seine Kraft, um den Marathon zu beenden."),
    # cantar
    ("cantar", "cantar", "énekelni", "to sing", "Le encanta cantar en la ducha por las mañanas.", "Imád reggel zuhanyozás közben énekelni.", "She loves to sing in the shower in the mornings.", "singen", "Sie liebt es, morgens unter der Dusche zu singen."),
    # déjeme -> dejar (to let/leave) -- 'dejar' not in existing
    ("dejar", "dejar", "hagyni / elengedni", "to let / to leave", "Por favor, déjeme explicar mi punto de vista.", "Kérem, hagyja elmagyarázni az álláspontomat.", "Please let me explain my point of view.", "lassen / verlassen", "Bitte lassen Sie mich meinen Standpunkt erklären."),
    # velocidad -> la velocidad
    ("velocidad", "la velocidad", "sebesség", "speed / velocity", "El tren alcanzó una velocidad máxima de trescientos kilómetros por hora.", "A vonat elérte a háromszáz kilómeteres óránkénti maximális sebességet.", "The train reached a maximum speed of three hundred kilometers per hour.", "die Geschwindigkeit", "Der Zug erreichte eine Höchstgeschwindigkeit von dreihundert Kilometern pro Stunde."),
    # total -> total (adj/adv/noun)
    ("total", "total", "teljes / összesen", "total / complete", "El costo total del proyecto supera el presupuesto inicial.", "A projekt teljes költsége meghaladja a kezdeti keretet.", "The total cost of the project exceeds the initial budget.", "total / gesamt", "Die Gesamtkosten des Projekts übersteigen das ursprüngliche Budget."),
    # cabello -> el cabello
    ("cabello", "el cabello", "haj", "hair", "Se cortó el cabello muy corto para el verano.", "Nagyon rövidre vágta a haját a nyárra.", "She cut her hair very short for the summer.", "das Haar", "Sie schnitt ihr Haar für den Sommer sehr kurz."),
    # suficientemente -> suficiente (already in existing: 'suficiente')
    # huellas -> la huella (already 'huella' in existing)
    # haberte -> haber (aux skip)
    # debí -> deber
    ("deber", "deber", "kell / tartozni", "must / to owe", "Debes entregar el informe antes del viernes sin falta.", "A jelentést péntek előtt mindenképpen be kell adnod.", "You must submit the report before Friday without fail.", "müssen / schulden", "Du musst den Bericht bis Freitag ohne Ausnahme einreichen."),
    # unidad -> la unidad
    ("unidad", "la unidad", "egység", "unit / unity", "La unidad del equipo fue clave para ganar el campeonato.", "A csapat egysége kulcsfontosságú volt a bajnokság megnyeréséhez.", "The team's unity was key to winning the championship.", "die Einheit", "Die Einheit des Teams war entscheidend für den Gewinn der Meisterschaft."),
    # estan -> estar (basic, skip)
    # cuchillo -> el cuchillo
    ("cuchillo", "el cuchillo", "kés", "knife", "El cocinero usó un cuchillo muy afilado para cortar la carne.", "A szakács nagyon éles késsel vágta a húst.", "The cook used a very sharp knife to cut the meat.", "das Messer", "Der Koch benutzte ein sehr scharfes Messer, um das Fleisch zu schneiden."),
    # oigan -> oír (already added)
    # quienes -> quien (pronoun skip)
    # gana -> ganar
    ("ganar", "ganar", "nyerni / keresni", "to win / to earn", "Trabaja mucho para ganar lo suficiente y mantener a su familia.", "Sokat dolgozik, hogy eleget keressen és eltartsa a családját.", "He works hard to earn enough and support his family.", "gewinnen / verdienen", "Er arbeitet hart, um genug zu verdienen und seine Familie zu unterstützen."),
    # tonterías -> la tontería
    ("tontería", "la tontería", "ostobaság / hülyeség", "nonsense / foolishness", "Deja de decir tonterías y céntrate en el trabajo.", "Hagyd abba az ostobaságokat és koncentrálj a munkára.", "Stop talking nonsense and focus on the work.", "der Unsinn / die Dummheit", "Hör auf, Unsinn zu reden, und konzentriere dich auf die Arbeit."),
    # emergencia -> la emergencia
    ("emergencia", "la emergencia", "vészhelyzet", "emergency", "En caso de emergencia, marca el número ciento doce.", "Vészhelyzet esetén hívd a száztizenkettest.", "In case of emergency, dial one hundred and twelve.", "der Notfall", "Im Notfall wähle die Nummer einhundertundzwölf."),
    # perfecta -> perfecto (adj)
    ("perfecto", "perfecto", "tökéletes", "perfect", "El plan parecía perfecto sobre el papel, pero falló en la práctica.", "A terv papíron tökéletesnek tűnt, de a gyakorlatban megbukott.", "The plan seemed perfect on paper, but failed in practice.", "perfekt", "Der Plan schien auf dem Papier perfekt, scheiterte aber in der Praxis."),
    # hable -> hablar (already? 'hablar' not in existing)
    ("hablar", "hablar", "beszélni", "to speak / to talk", "Necesita hablar con su jefe sobre el problema cuanto antes.", "Minél hamarabb kell beszélnie a főnökével a problémáról.", "He needs to talk to his boss about the problem as soon as possible.", "sprechen / reden", "Er muss so bald wie möglich mit seinem Chef über das Problem sprechen."),
    # gustaba -> gustar
    ("gustar", "gustar", "tetszeni / szeretni", "to like / to please", "Le gustaba mucho leer novelas históricas antes de dormir.", "Nagyon szeretett történelmi regényeket olvasni lefekvés előtt.", "He really liked reading historical novels before going to sleep.", "mögen / gefallen", "Er mochte es sehr, vor dem Schlafen historische Romane zu lesen."),
    # lugares -> el lugar
    ("lugar", "el lugar", "hely", "place / location", "Escogieron un lugar tranquilo para celebrar la boda.", "Nyugodt helyet választottak az esküvő megünneplésére.", "They chose a quiet place to celebrate the wedding.", "der Ort / die Stelle", "Sie wählten einen ruhigen Ort, um die Hochzeit zu feiern."),
    # ryan -> SKIP proper
    # show -> el show (borrowed word)
    ("show", "el show", "műsor / show", "show / performance", "El show de magia duró casi dos horas y fue espectacular.", "A bűvész-show majdnem két óráig tartott és lenyűgöző volt.", "The magic show lasted almost two hours and was spectacular.", "die Show", "Die Zaubershow dauerte fast zwei Stunden und war spektakulär."),
    # robo -> el robo
    ("robo", "el robo", "rablás / lopás", "robbery / theft", "El robo del banco fue planeado durante varios meses.", "A banki rablást több hónapon át tervezték.", "The bank robbery was planned for several months.", "der Raub / der Diebstahl", "Der Banküberfall wurde über mehrere Monate geplant."),
    # permite -> permitir (already in existing)
    # parque -> el parque
    ("parque", "el parque", "park", "park", "Los niños juegan en el parque todas las tardes después del colegio.", "A gyerekek minden délután az iskolából hazajövet a parkban játszanak.", "The children play in the park every afternoon after school.", "der Park", "Die Kinder spielen jeden Nachmittag nach der Schule im Park."),
    # uds. -> SKIP abbreviation
    # roto -> romper (adj form) / roto as adj meaning broken
    ("roto", "roto", "törött / elromlott", "broken", "El vaso estaba roto cuando abrí la caja.", "A pohár törött volt, amikor kinyitottam a dobozt.", "The glass was broken when I opened the box.", "kaputt / zerbrochen", "Das Glas war zerbrochen, als ich die Schachtel öffnete."),
    # serie -> la serie
    ("serie", "la serie", "sorozat", "series", "Pasamos el fin de semana viendo una serie de crimen en la televisión.", "A hétvégét egy krimi-sorozat nézésével töltöttük a televízióban.", "We spent the weekend watching a crime series on television.", "die Serie", "Wir verbrachten das Wochenende damit, eine Krimiserie im Fernsehen zu schauen."),
    # puse -> poner
    ("poner", "poner", "tenni / rakni / bekapcsolni", "to put / to place / to turn on", "Puse las llaves encima de la mesa para no olvidarlas.", "Az asztalra tettem a kulcsokat, hogy ne felejtsem el.", "I put the keys on the table so I wouldn't forget them.", "legen / stellen / einschalten", "Ich legte die Schlüssel auf den Tisch, damit ich sie nicht vergesse."),
    # nuevas -> nuevo (adj) 'nuevo' not in existing
    ("nuevo", "nuevo", "új", "new", "El gobierno presentó una nueva ley para proteger el medio ambiente.", "A kormány új törvényt mutatott be a környezet védelmére.", "The government presented a new law to protect the environment.", "neu", "Die Regierung präsentierte ein neues Gesetz zum Schutz der Umwelt."),
    # evidencia -> la evidencia
    ("evidencia", "la evidencia", "bizonyíték", "evidence", "La evidencia presentada en el juicio fue determinante para el veredicto.", "A tárgyaláson bemutatott bizonyíték meghatározó volt az ítélet szempontjából.", "The evidence presented at the trial was decisive for the verdict.", "die Beweise / die Evidenz", "Die beim Prozess vorgelegten Beweise waren entscheidend für das Urteil."),
    # conocerte -> conocer
    ("conocer", "conocer", "ismerni / megismerni", "to know / to meet", "Es un placer conocerte en persona después de hablar tanto por teléfono.", "Nagy öröm személyesen megismerni téged, miután annyit telefonáltunk.", "It's a pleasure to meet you in person after talking so much on the phone.", "kennen / kennenlernen", "Es ist eine Freude, Sie persönlich kennenzulernen, nachdem wir so viel telefoniert haben."),
    # estúpida -> estúpido (adj)
    ("estúpido", "estúpido", "buta / hülye", "stupid", "Fue una decisión estúpida salir sin paraguas con ese cielo.", "Buta döntés volt esernyő nélkül kimenni ilyen égbolt mellett.", "It was a stupid decision to go out without an umbrella in that weather.", "dumm / blöd", "Es war eine dumme Entscheidung, bei dem Wetter ohne Regenschirm rauszugehen."),
    # preocupe -> preocupar
    ("preocupar", "preocupar", "aggódni / nyugtalanítani", "to worry", "No te preocupes tanto por las cosas que no puedes controlar.", "Ne aggódj annyira az olyan dolgok miatt, amelyeket nem tudsz kontrollálni.", "Don't worry so much about things you can't control.", "sich sorgen / beunruhigen", "Mach dir nicht so viele Sorgen um Dinge, die du nicht kontrollieren kannst."),
    # perdone -> perdonar
    ("perdonar", "perdonar", "megbocsátani", "to forgive / to pardon", "Con el tiempo aprendió a perdonar a quienes le habían hecho daño.", "Az idő múlásával megtanult megbocsátani azoknak, akik megbántották.", "Over time he learned to forgive those who had hurt him.", "vergeben / verzeihen", "Mit der Zeit lernte er, denjenigen zu vergeben, die ihm geschadet hatten."),
    # botella -> la botella
    ("botella", "la botella", "üveg / palack", "bottle", "Recicla las botellas de vidrio en el contenedor correspondiente.", "A üvegpalackokat dobja a megfelelő szelektív gyűjtőbe.", "Recycle the glass bottles in the appropriate container.", "die Flasche", "Recyceln Sie die Glasflaschen im entsprechenden Behälter."),
    # mando -> el mando / mandar (command)
    # 'mando' as noun = remote control / command; mandar = to send/command -- already 'mando' in existing? Check: yes 'mando' is in existing_es
    # extraña -> extraño (adj/verb: to miss)
    ("extraño", "extraño", "különös / idegen", "strange / foreign", "Había algo extraño en su comportamiento esa noche.", "Valami különös volt a viselkedésében azon az ésten.", "There was something strange about his behavior that night.", "seltsam / fremd", "Es war etwas Seltsames an seinem Verhalten in jener Nacht."),
    # historias -> la historia
    ("historia", "la historia", "történet / történelem", "story / history", "Les contó una historia increíble sobre su viaje a la selva.", "Egy hihetetlen történetet mesélt nekik a dzsungelban tett útjáról.", "He told them an incredible story about his trip to the jungle.", "die Geschichte / die Geschichte (Geschichte)", "Er erzählte ihnen eine unglaubliche Geschichte über seine Reise in den Dschungel."),
    # aquella -> aquel (demonstrative, skip)
    # tenéis -> tener (skip basic)
    # solos -> solo (adj/adv)
    ("solo", "solo", "egyedül / csak", "alone / only", "Prefiere trabajar solo porque se concentra mejor sin distracciones.", "Inkább egyedül dolgozik, mert elvonó tényezők nélkül jobban tud koncentrálni.", "He prefers to work alone because he concentrates better without distractions.", "allein / nur", "Er arbeitet lieber allein, weil er ohne Ablenkungen besser konzentrieren kann."),
    # apoyo -> el apoyo / apoyar
    ("apoyo", "el apoyo", "támogatás / támasz", "support", "Recibió el apoyo incondicional de su familia durante la crisis.", "A válság idején megkapta családja feltétel nélküli támogatását.", "He received the unconditional support of his family during the crisis.", "die Unterstützung", "Er erhielt während der Krise die bedingungslose Unterstützung seiner Familie."),
    # bala -> la bala
    ("bala", "la bala", "golyó (lövedék)", "bullet", "La bala atravesó la pared de madera sin dificultad.", "A golyó nehézség nélkül áthatolt a falon.", "The bullet went through the wooden wall without difficulty.", "die Kugel", "Die Kugel durchdrang die Holzwand mühelos."),
    # verdadera -> verdadero (adj)
    ("verdadero", "verdadero", "igazi / valódi", "true / real / genuine", "Encontró su verdadera vocación cuando empezó a estudiar medicina.", "Akkor találta meg igazi hivatását, amikor el kezdett orvostant tanulni.", "He found his true calling when he started studying medicine.", "wahr / echt", "Er fand seine wahre Berufung, als er anfing, Medizin zu studieren."),
    # tiro -> el tiro / tirar
    ("tiro", "el tiro", "lövés / dobás", "shot / throw", "El tiro libre del delantero entró directo a la portería.", "A csatár szabadrúgása egyenesen a kapuba ment.", "The striker's free kick went straight into the goal.", "der Schuss / der Wurf", "Der Freistoß des Stürmers ging direkt ins Tor."),
    # época -> la época
    ("época", "la época", "korszak / időszak", "era / period", "En aquella época la gente vivía de forma mucho más sencilla.", "Abban az időszakban az emberek sokkal egyszerűbben éltek.", "In that era people lived much more simply.", "die Epoche / die Zeit", "In jener Epoche lebten die Menschen viel einfacher."),
    # puente -> el puente
    ("puente", "el puente", "híd / hosszú hétvége", "bridge / long weekend", "El puente sobre el río fue construido hace más de cien años.", "A folyón átívelő hidat több mint száz éve építették.", "The bridge over the river was built more than a hundred years ago.", "die Brücke", "Die Brücke über den Fluss wurde vor mehr als hundert Jahren gebaut."),
    # olvídalo -> olvidar (already? no - 'olvidar' not in existing)
    ("olvidar", "olvidar", "elfelejteni", "to forget", "No olvides apagar las luces cuando salgas de la oficina.", "Ne felejtsd el lekapcsolni a villanyt, amikor kijössz az irodából.", "Don't forget to turn off the lights when you leave the office.", "vergessen", "Vergiss nicht, das Licht auszuschalten, wenn du das Büro verlässt."),
    # distancia -> la distancia
    ("distancia", "la distancia", "távolság", "distance", "La distancia entre las dos ciudades es de unos doscientos kilómetros.", "A két város közötti távolság körülbelül kétszáz kilométer.", "The distance between the two cities is about two hundred kilometers.", "die Entfernung / die Distanz", "Die Entfernung zwischen den beiden Städten beträgt etwa zweihundert Kilometer."),
    # desea -> desear
    ("desear", "desear", "kívánni / vágyni", "to wish / to desire", "Solo deseo que seas feliz y que encuentres tu camino.", "Csak azt kívánom, hogy boldog légy és megtaláld az utadat.", "I only wish that you are happy and find your path.", "wünschen / begehren", "Ich wünsche mir nur, dass du glücklich bist und deinen Weg findest."),
    # dejarlo -> dejar (already added)
    # pelear
    ("pelear", "pelear", "harcolni / verekedni", "to fight / to quarrel", "Los hermanos siempre pelean por el mando a distancia.", "A fivérek mindig a távirányítón veszekednek.", "The brothers always fight over the remote control.", "kämpfen / streiten", "Die Brüder streiten sich immer um die Fernbedienung."),
    # pierna -> la pierna
    ("pierna", "la pierna", "láb (comb)", "leg", "Se rompió la pierna durante el entrenamiento de fútbol.", "Eltörte a lábát a futball edzésen.", "He broke his leg during football training.", "das Bein", "Er brach sich beim Fußballtraining das Bein."),
    # echar
    ("echar", "echar", "dobni / kidobni / önteni", "to throw / to pour / to kick out", "Échale un vistazo al documento antes de firmarlo.", "Vess egy pillantást a dokumentumra, mielőtt aláírod.", "Take a look at the document before signing it.", "werfen / gießen / rauswerfen", "Wirf einen Blick auf das Dokument, bevor du es unterschreibst."),
    # descanso -> el descanso
    ("descanso", "el descanso", "pihenés / szünet", "rest / break", "Después de tres horas de trabajo, necesitamos un descanso.", "Három óra munka után szükségünk van egy szünetre.", "After three hours of work, we need a break.", "die Pause / die Erholung", "Nach drei Stunden Arbeit brauchen wir eine Pause."),
    # américa -> SKIP proper noun (continent name)
    # área -> el área
    ("área", "el área", "terület / körzet", "area / zone", "El área metropolitana de Madrid supera los seis millones de habitantes.", "Madrid nagyvárosi területe meghaladja a hatmillió lakost.", "The metropolitan area of Madrid exceeds six million inhabitants.", "das Gebiet / die Fläche", "Der Ballungsraum Madrid umfasst mehr als sechs Millionen Einwohner."),
    # datos -> el dato (already 'dato' in existing)
    # espectáculo -> el espectáculo
    ("espectáculo", "el espectáculo", "látványosság / előadás", "show / spectacle", "El espectáculo de fuegos artificiales duró media hora.", "A tűzijáték-látványosság fél óráig tartott.", "The fireworks show lasted half an hour.", "die Vorstellung / das Schauspiel", "Das Feuerwerk dauerte eine halbe Stunde."),
    # sube -> subir (already in existing)
    # dejaste -> dejar (already added)
    # acabas -> acabar
    ("acabar", "acabar", "befejezni / végezni", "to finish / to end", "Acaba de llegar y ya quiere irse a dormir.", "Épp most érkezett és már aludni akar menni.", "He has just arrived and already wants to go to sleep.", "beenden / aufhören", "Er ist gerade angekommen und will schon schlafen gehen."),
    # verá -> ver (basic verb, skip)
    # magia -> la magia
    ("magia", "la magia", "varázslat / mágia", "magic", "Creía en la magia de los sueños cuando era niño.", "Gyerekkorában hitt az álmok varázslatában.", "He believed in the magic of dreams when he was a child.", "die Magie / der Zauber", "Als Kind glaubte er an die Magie der Träume."),
    # nacional -> nacional (adj)
    ("nacional", "nacional", "nemzeti", "national", "El equipo nacional ganó la medalla de oro en los Juegos Olímpicos.", "A nemzeti csapat aranyérmet nyert az Olimpiai Játékokon.", "The national team won the gold medal at the Olympic Games.", "national", "Die Nationalmannschaft gewann die Goldmedaille bei den Olympischen Spielen."),
    # universo -> el universo
    ("universo", "el universo", "világegyetem", "universe", "El universo sigue expandiéndose a una velocidad impresionante.", "A világegyetem lenyűgöző sebességgel terjeszkedik tovább.", "The universe continues to expand at an impressive speed.", "das Universum", "Das Universum dehnt sich weiterhin mit beeindruckender Geschwindigkeit aus."),
    # llevaba -> llevar (already in existing)
    # nariz -> la nariz
    ("nariz", "la nariz", "orr", "nose", "Se tapó la nariz porque el olor era insoportable.", "Befogta az orrát, mert a szag elviselhetetlen volt.", "She held her nose because the smell was unbearable.", "die Nase", "Sie hielt sich die Nase zu, weil der Geruch unerträglich war."),
    # aquellos -> aquel (demonstrative, skip)
    # clases -> la clase
    ("clase", "la clase", "osztály / óra / osztályterem", "class / lesson", "Las clases de español empiezan a las nueve de la mañana.", "A spanyol órák reggel kilenckor kezdődnek.", "Spanish classes start at nine in the morning.", "der Unterricht / die Klasse", "Der Spanischunterricht beginnt um neun Uhr morgens."),
    # jake -> SKIP proper noun
    # casas -> la casa
    ("casa", "la casa", "ház / otthon", "house / home", "Compraron una casa pequeña en las afueras de la ciudad.", "Egy kis házat vásároltak a város külvárosában.", "They bought a small house on the outskirts of the city.", "das Haus / das Zuhause", "Sie kauften ein kleines Haus am Stadtrand."),
    # vergüenza -> la vergüenza
    ("vergüenza", "la vergüenza", "szégyen", "shame / embarrassment", "Sintió una gran vergüenza cuando se equivocó delante de todos.", "Nagy szégyent érzett, amikor mindenki előtt hibázott.", "She felt great shame when she made a mistake in front of everyone.", "die Scham / die Peinlichkeit", "Sie schämte sich sehr, als sie sich vor allen einen Fehler erlaubte."),
    # estarán -> estar (skip)
    # monstruo -> el monstruo
    ("monstruo", "el monstruo", "szörnyeteg", "monster", "El niño creía que había un monstruo debajo de su cama.", "A gyerek azt hitte, hogy egy szörnyeteg van az ágya alatt.", "The child believed there was a monster under his bed.", "das Monster / das Ungeheuer", "Das Kind glaubte, dass sich unter seinem Bett ein Monster befände."),
    # princesa -> la princesa
    ("princesa", "la princesa", "hercegnő", "princess", "La princesa asistió a la gala benéfica del hospital.", "A hercegnő részt vett a kórházi jótékonysági gálán.", "The princess attended the hospital charity gala.", "die Prinzessin", "Die Prinzessin nahm an der Wohltätigkeitsgala des Krankenhauses teil."),
    # cuidar
    ("cuidar", "cuidar", "gondozni / vigyázni", "to care for / to look after", "Cuida muy bien a sus plantas y nunca se le mueren.", "Nagyon jól gondozza a növényeit, és soha nem pusztulnak el.", "She takes very good care of her plants and they never die.", "sich kümmern um / pflegen", "Sie kümmert sich sehr gut um ihre Pflanzen und sie sterben nie."),
    # ei -> SKIP (interjection/abbreviation)
    # huevos -> el huevo
    ("huevo", "el huevo", "tojás", "egg", "Prepara huevos revueltos con queso todas las mañanas.", "Minden reggel sajtos rántottát készít.", "He makes scrambled eggs with cheese every morning.", "das Ei", "Er macht jeden Morgen Rührei mit Käse."),
    # pocos -> poco (quantifier, functional word, skip)
    # podrás -> poder (skip basic modal)
    # enferma -> enfermo (adj)
    ("enfermo", "enfermo", "beteg", "sick / ill", "Se quedó en casa porque estaba demasiado enferma para ir al trabajo.", "Otthon maradt, mert túl beteg volt munkába menni.", "She stayed home because she was too sick to go to work.", "krank", "Sie blieb zu Hause, weil sie zu krank war, um zur Arbeit zu gehen."),
    # paseo -> el paseo
    ("paseo", "el paseo", "séta / sétány", "walk / promenade", "Dimos un largo paseo por la orilla del río al atardecer.", "Hosszú sétát tettünk a folyóparton alkonyatkor.", "We took a long walk along the riverbank at sunset.", "der Spaziergang / die Promenade", "Wir machten einen langen Spaziergang am Flussufer beim Sonnenuntergang."),
    # detalles -> el detalle
    ("detalle", "el detalle", "részlet / figyelmesség", "detail / gesture", "Los detalles más pequeños suelen marcar la gran diferencia.", "A legkisebb részletek szokták a nagy különbséget tenni.", "The smallest details usually make the big difference.", "das Detail / die Geste", "Die kleinsten Details machen oft den großen Unterschied."),
    # llamadas -> la llamada
    ("llamada", "la llamada", "hívás / telefonhívás", "call / phone call", "Recibió varias llamadas perdidas mientras dormía.", "Több nem fogadott hívása volt alvás közben.", "He received several missed calls while sleeping.", "der Anruf", "Er erhielt mehrere verpasste Anrufe, während er schlief."),
    # belleza -> la belleza
    ("belleza", "la belleza", "szépség", "beauty", "La belleza del paisaje los dejó sin palabras.", "A táj szépsége szavak nélkül hagyta őket.", "The beauty of the landscape left them speechless.", "die Schönheit", "Die Schönheit der Landschaft verschlug ihnen die Sprache."),
    # francia -> SKIP proper noun
    # viviendo -> vivir
    ("vivir", "vivir", "élni / lakni", "to live", "Lleva diez años viviendo en el extranjero y no quiere volver.", "Tíz éve él külföldön és nem akar visszatérni.", "He has been living abroad for ten years and doesn't want to return.", "leben / wohnen", "Er lebt seit zehn Jahren im Ausland und will nicht zurückkehren."),
    # envió -> enviar (already added: 'enviar')
    # puntos -> el punto
    ("punto", "el punto", "pont / pontszám", "point / dot", "El equipo necesita tres puntos para clasificarse para la final.", "A csapatnak három pontra van szüksége a döntőbe jutáshoz.", "The team needs three points to qualify for the final.", "der Punkt", "Das Team braucht drei Punkte, um sich für das Finale zu qualifizieren."),
    # ministro -> el ministro
    ("ministro", "el ministro", "miniszter", "minister", "El ministro de sanidad presentó el nuevo plan de vacunación.", "Az egészségügyi miniszter bemutatta az új oltási tervet.", "The health minister presented the new vaccination plan.", "der Minister", "Der Gesundheitsminister stellte den neuen Impfplan vor."),
    # conducir
    ("conducir", "conducir", "vezetni (járművet)", "to drive", "Aprendió a conducir con su padre en un aparcamiento vacío.", "Apjával tanult meg vezetni egy üres parkolóban.", "He learned to drive with his father in an empty parking lot.", "fahren / führen", "Er lernte mit seinem Vater auf einem leeren Parkplatz Auto zu fahren."),
]

print(f"Entries prepared for batch 0+1: {len(entries_to_add)}")
PYEOF
