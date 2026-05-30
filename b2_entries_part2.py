#!/usr/bin/env python3
"""B2 entry data - part 2 (words 200-399, batches 2-3)."""

ENTRIES = [
# batch2
("chuck",     "skip_proper", None, None, None, None, None, None, None, None, None),
("seguido",   "add","seguir",      None, "követni / folytatni", "to follow / to continue", "Ha seguido el mismo camino.", "Ugyanazt az utat követte.", "He has followed the same path.", "folgen / weitermachen", "Er ist demselben Weg gefolgt."),
("seremos",   "skip_dup", None, None, None, None, None, None, None, None, None),  # ser
("morgan",    "skip_proper", None, None, None, None, None, None, None, None, None),
("pene",      "add","el pene",     None, "pénisz", "penis", "En educación sexual se habla del pene.", "A szexuális oktatásban szó esik a péniszről.", "In sex education the penis is discussed.", "der Penis", "Im Sexualkundeunterricht wird über den Penis gesprochen."),
("despierto", "add","despierto",   None, "ébren lévő / éber", "awake / alert", "Todavía estoy despierto a medianoche.", "Éjfélkor még ébren vagyok.", "I'm still awake at midnight.", "wach / aufgeweckt", "Um Mitternacht bin ich noch wach."),
("gobernador","add","el gobernador",None,"kormányzó","governor","El gobernador firmó la nueva ley.","A kormányzó aláírta az új törvényt.","The governor signed the new law.","der Gouverneur","Der Gouverneur unterzeichnete das neue Gesetz."),
("sección",   "add","la sección",  None, "szekció / szakasz / rovat", "section", "La sección de deportes está al fondo.", "A sportrovar hátul van.", "The sports section is at the back.", "der Abschnitt / die Abteilung", "Die Sportabteilung befindet sich hinten."),
("casarme",   "skip_dup", None, None, None, None, None, None, None, None, None),  # casarse already added
("trabajos",  "add","el trabajo",  None, "munka / munkahely", "work / job", "Tiene varios trabajos a la vez.", "Egyszerre több munkája van.", "He has several jobs at once.", "die Arbeit / der Job", "Er hat mehrere Jobs gleichzeitig."),
("karen",     "skip_proper", None, None, None, None, None, None, None, None, None),
("preparados","add","preparado",   None, "felkészült / kész", "prepared / ready", "Los soldados estaban preparados.", "A katonák fel voltak készülve.", "The soldiers were prepared.", "vorbereitet / bereit", "Die Soldaten waren vorbereitet."),
("murieron",  "add","morir",       None, "meghalni", "to die", "Muchos soldados murieron en la batalla.", "Sok katona halt meg a csatában.", "Many soldiers died in the battle.", "sterben", "Viele Soldaten starben in der Schlacht."),
("oso",       "add","el oso",      None, "medve", "bear", "El oso pardo es un animal majestuoso.", "A barna medve fenséges állat.", "The brown bear is a majestic animal.", "der Bär", "Der Braunbär ist ein majestätisches Tier."),
("curiosidad","add","la curiosidad",None,"kíváncsiság","curiosity","La curiosidad impulsa el aprendizaje.","A kíváncsiság hajtja a tanulást.","Curiosity drives learning.","die Neugier","Neugier treibt das Lernen voran."),
("vd.",       "skip_abbrev", None, None, None, None, None, None, None, None, None),
("hank",      "skip_proper", None, None, None, None, None, None, None, None, None),
("impresión", "add","la impresión",None,"benyomás / lenyomat","impression","Me dio una buena impresión.","Jó benyomást keltett bennem.","He made a good impression on me.","der Eindruck","Er machte einen guten Eindruck auf mich."),
("pez",       "add","el pez",      None, "hal (állat)", "fish (animal)", "El pez nada en el río.", "A hal a folyóban úszik.", "The fish swims in the river.", "der Fisch", "Der Fisch schwimmt im Fluss."),
("pasaba",    "skip_dup", None, None, None, None, None, None, None, None, None),  # pasar already added
("escuchaste","skip_dup", None, None, None, None, None, None, None, None, None),  # escuchar
("torre",     "add","la torre",    None, "torony", "tower", "La Torre Eiffel mide 330 metros.", "Az Eiffel-torony 330 méter magas.", "The Eiffel Tower is 330 meters tall.", "der Turm", "Der Eiffelturm ist 330 Meter hoch."),
("sientas",   "skip_dup", None, None, None, None, None, None, None, None, None),  # sentarse
("mentir",    "add","mentir",      None, "hazudni", "to lie", "Está mal mentir a los amigos.", "Rossz dolog hazudni a barátoknak.", "It is wrong to lie to friends.", "lügen", "Es ist falsch, Freunde anzulügen."),
("pasillo",   "add","el pasillo",  None, "folyosó", "hallway / corridor", "El pasillo es largo y oscuro.", "A folyosó hosszú és sötét.", "The hallway is long and dark.", "der Flur / der Gang", "Der Flur ist lang und dunkel."),
("juega",     "skip_dup", None, None, None, None, None, None, None, None, None),  # jugar
("suéltame",  "skip_dup", None, None, None, None, None, None, None, None, None),  # soltar
("arresto",   "add","el arresto",  None, "letartóztatás", "arrest", "El arresto se produjo al amanecer.", "A letartóztatás hajnalban történt.", "The arrest took place at dawn.", "die Verhaftung", "Die Verhaftung fand bei Tagesanbruch statt."),
("ricos",     "add","rico",        None, "gazdag / ízletes", "rich / delicious", "Los países ricos tienen más recursos.", "A gazdag országoknak több erőforrásuk van.", "Rich countries have more resources.", "reich / lecker", "Reiche Länder haben mehr Ressourcen."),
("sencillo",  "add","sencillo",    None, "egyszerű", "simple / straightforward", "La solución es más sencilla de lo que parece.", "A megoldás egyszerűbb, mint amilyennek látszik.", "The solution is simpler than it seems.", "einfach / schlicht", "Die Lösung ist einfacher als sie aussieht."),
("ruta",      "add","la ruta",     None, "útvonal / út", "route / path", "Eligieron la ruta más corta.", "A legrövidebb útvonalat választották.", "They chose the shortest route.", "die Route / der Weg", "Sie wählten die kürzeste Route."),
("documentos","add","el documento",None,"dokumentum / irat","document","Necesito los documentos originales.","Szükségem van az eredeti iratokra.","I need the original documents.","das Dokument","Ich brauche die Originaldokumente."),
("enamorada", "add","enamorarse",  None, "belszeretni valakibe", "to fall in love", "Se enamoró de él a primera vista.", "Első látásra belszeretett.", "She fell in love with him at first sight.", "sich verlieben", "Sie verliebte sich auf den ersten Blick in ihn."),
("apuesta",   "add","la apuesta",  None, "fogadás", "bet / wager", "Hizo una apuesta y la ganó.", "Fogadást kötött, és megnyerte.", "He made a bet and won it.", "die Wette", "Er schloss eine Wette ab und gewann."),
("perdida",   "add","perdido",     None, "elveszett / eltévedt", "lost", "La mochila estaba perdida.", "A hátizsák elveszett.", "The backpack was lost.", "verloren / verloren gegangen", "Der Rucksack war verloren."),
("vinieron",  "skip_dup", None, None, None, None, None, None, None, None, None),  # venir
("ayudarnos", "skip_dup", None, None, None, None, None, None, None, None, None),  # ayudar
("presento",  "skip_dup", None, None, None, None, None, None, None, None, None),  # presentar
("hazme",     "skip_dup", None, None, None, None, None, None, None, None, None),  # hacer
("leí",       "skip_dup", None, None, None, None, None, None, None, None, None),  # leer
("arthur",    "skip_proper", None, None, None, None, None, None, None, None, None),
("virus",     "add","el virus",    None, "vírus", "virus", "El virus se propagó rápidamente.", "A vírus gyorsan terjedt.", "The virus spread quickly.", "der Virus", "Das Virus verbreitete sich schnell."),
("lárgate",   "add","largarse",    None, "meglépni / eltakarodniaz", "to get lost / to leave", "¡Lárgate de aquí ahora mismo!", "Tűnj el innen azonnal!", "Get out of here right now!", "abhauen / verschwinden", "Hau sofort hier ab!"),
("sigan",     "skip_dup", None, None, None, None, None, None, None, None, None),  # seguir already added
("compró",    "skip_dup", None, None, None, None, None, None, None, None, None),  # comprar
("servir",    "add","servir",      None, "felszolgálni / szolgálni", "to serve", "¿En qué puedo servirle?", "Miben segíthetek önnek?", "How can I serve you?", "dienen / servieren", "Womit kann ich Ihnen dienen?"),
("pongas",    "skip_dup", None, None, None, None, None, None, None, None, None),  # poner
("alarma",    "add","la alarma",   None, "riasztó / vészjelző", "alarm", "Sonó la alarma de incendios.", "Megszólalt a tűzriasztó.", "The fire alarm went off.", "der Alarm", "Der Feueralarm ertönte."),
("identidad", "add","la identidad",None,"személyazonosság / identitás","identity","Le robaron la identidad.","Ellopták a személyazonosságát.","His identity was stolen.","die Identität","Seine Identität wurde gestohlen."),
("iguales",   "add","igual",       None, "egyenlő / azonos", "equal / same", "Todos somos iguales ante la ley.", "A törvény előtt mindenki egyenlő.", "We are all equal before the law.", "gleich / gleicher", "Wir sind alle gleich vor dem Gesetz."),
("aviso",     "add","el aviso",    None, "figyelmeztetés / értesítés", "warning / notice", "Dio el aviso sin demora.", "Késlekedés nélkül adta ki a figyelmeztetést.", "He gave the warning without delay.", "die Warnung / die Benachrichtigung", "Er gab die Warnung ohne Verzögerung."),
("aprendido", "skip_dup", None, None, None, None, None, None, None, None, None),  # aprender
("caza",      "add","la caza",     None, "vadászat", "hunt / hunting", "La caza está regulada por la ley.", "A vadászatot törvény szabályozza.", "Hunting is regulated by law.", "die Jagd", "Die Jagd ist gesetzlich geregelt."),
("daba",      "skip_dup", None, None, None, None, None, None, None, None, None),  # dar already added
("muchacha",  "add","la muchacha", None, "lány / fiatal nő", "girl / young woman", "La muchacha cantaba mientras trabajaba.", "A lány énekelve dolgozott.", "The girl sang while she worked.", "das Mädchen / die junge Frau", "Das Mädchen sang während der Arbeit."),
("permanecer","add","permanecer",  None, "maradni / fennmaradni", "to remain / to stay", "Debes permanecer en silencio.", "Csendben kell maradnod.", "You must remain silent.", "bleiben / verbleiben", "Du musst still bleiben."),
("bebés",     "add","el bebé",     None, "baba / csecsemő", "baby", "Los bebés necesitan mucho sueño.", "A csecsemőknek sok alvásra van szükségük.", "Babies need a lot of sleep.", "das Baby", "Babys brauchen viel Schlaf."),
("opciones",  "add","la opción",   None, "lehetőség / opció", "option", "Tienes varias opciones.", "Több lehetőséged is van.", "You have several options.", "die Option / die Möglichkeit", "Du hast mehrere Optionen."),
("responde",  "skip_dup", None, None, None, None, None, None, None, None, None),  # responder
("vernos",    "skip_dup", None, None, None, None, None, None, None, None, None),  # ver
("julie",     "skip_proper", None, None, None, None, None, None, None, None, None),
("llamaste",  "skip_dup", None, None, None, None, None, None, None, None, None),  # llamar
("ponerse",   "skip_dup", None, None, None, None, None, None, None, None, None),  # poner
("sacó",      "skip_dup", None, None, None, None, None, None, None, None, None),  # sacar
("orgullo",   "add","el orgullo",  None, "büszkeség", "pride", "Siente orgullo por sus logros.", "Büszke az eredményeire.", "He feels pride for his achievements.", "der Stolz", "Er ist stolz auf seine Leistungen."),
("reales",    "add","real",        None, "valódi / királyi", "real / royal", "Son problemas reales.", "Ezek valódi problémák.", "These are real problems.", "real / königlich", "Das sind echte Probleme."),
("esperan",   "skip_dup", None, None, None, None, None, None, None, None, None),  # esperar
("vuelves",   "skip_dup", None, None, None, None, None, None, None, None, None),  # volver
("maggie",    "skip_proper", None, None, None, None, None, None, None, None, None),
("serlo",     "skip_dup", None, None, None, None, None, None, None, None, None),  # ser
("cuantas",   "skip_dup", None, None, None, None, None, None, None, None, None),  # cuánto already added
("enfadado",  "add","enfadado",    None, "dühös / mérges", "angry / annoyed", "Estaba enfadado con su jefe.", "Dühös volt a főnökére.", "He was angry with his boss.", "verärgert / wütend", "Er war wütend auf seinen Chef."),
("ponen",     "skip_dup", None, None, None, None, None, None, None, None, None),  # poner
("altura",    "add","la altura",   None, "magasság", "height / altitude", "La altura de la montaña supera los 3000 m.", "A hegy magassága meghaladja a 3000 métert.", "The mountain height exceeds 3000 m.", "die Höhe", "Die Höhe des Berges übersteigt 3000 m."),
("jones",     "skip_proper", None, None, None, None, None, None, None, None, None),
("archivo",   "add","el archivo",  None, "fájl / irattár", "file / archive", "Guarda el archivo en el servidor.", "Mentsd el a fájlt a szerverre.", "Save the file on the server.", "die Datei / das Archiv", "Speichere die Datei auf dem Server."),
("fred",      "skip_proper", None, None, None, None, None, None, None, None, None),
("ayudará",   "skip_dup", None, None, None, None, None, None, None, None, None),  # ayudar
("fácilmente","add","fácilmente",  None, "könnyen", "easily", "Puedes resolverlo fácilmente.", "Könnyedén megoldhatod.", "You can solve it easily.", "leicht / mühelos", "Du kannst es leicht lösen."),
("criatura",  "add","la criatura", None, "teremtmény / lény", "creature", "Es una criatura nocturna.", "Éjszakai teremtmény.", "It is a nocturnal creature.", "das Wesen / die Kreatur", "Es ist ein nachtaktives Wesen."),
("saco",      "skip_dup", None, None, None, None, None, None, None, None, None),  # sacar
("precisamente","add","precisamente",None,"pontosan / éppen","precisely / exactly","Eso es precisamente el problema.","Ez pontosan a probléma.","That is precisely the problem.","genau / eben","Das ist genau das Problem."),
("máximo",    "add","el máximo",   None, "maximum", "maximum", "Alcanzó el máximo de su carrera.", "Pályafutása csúcspontját érte el.", "He reached the peak of his career.", "das Maximum", "Er erreichte den Höhepunkt seiner Karriere."),
("viniendo",  "skip_dup", None, None, None, None, None, None, None, None, None),  # venir
("vendría",   "skip_dup", None, None, None, None, None, None, None, None, None),  # venir
("louis",     "skip_proper", None, None, None, None, None, None, None, None, None),
("ilegal",    "add","ilegal",      None, "illegális / törvénytelen", "illegal", "El tráfico de drogas es ilegal.", "A kábítószer-kereskedelem illegális.", "Drug trafficking is illegal.", "illegal / rechtswidrig", "Der Drogenhandel ist illegal."),
("refiere",   "add","referirse",   None, "hivatkozni / vonatkozni", "to refer to", "Se refiere a un problema grave.", "Komoly problémára utal.", "He refers to a serious problem.", "sich beziehen auf / meinen", "Er bezieht sich auf ein ernstes Problem."),
("llamamos",  "skip_dup", None, None, None, None, None, None, None, None, None),  # llamar
("versión",   "add","la versión",  None, "verzió / változat", "version", "Descarga la última versión.", "Töltsd le a legújabb verziót.", "Download the latest version.", "die Version", "Lade die neueste Version herunter."),
("incendio",  "add","el incendio", None, "tűz / tűzvész", "fire / blaze", "El incendio destruyó el bosque.", "A tűz elpusztította az erdőt.", "The fire destroyed the forest.", "der Brand / das Feuer", "Das Feuer zerstörte den Wald."),
("preferiría","skip_dup", None, None, None, None, None, None, None, None, None),  # preferir
("gritar",    "add","gritar",      None, "kiabálni / üvölteni", "to shout / to scream", "No hay que gritar en la biblioteca.", "A könyvtárban nem szabad kiabálni.", "You shouldn't shout in the library.", "schreien / brüllen", "In der Bibliothek sollte man nicht schreien."),
("recibió",   "skip_dup", None, None, None, None, None, None, None, None, None),  # recibir
("concierto", "add","el concierto",None,"hangverseny / koncert","concert","Fuimos al concierto de rock.","Elmentünk a rockkonzertre.","We went to the rock concert.","das Konzert","Wir gingen zum Rockkonzert."),
("casualidad","add","la casualidad",None,"véletlen","coincidence / chance","Por casualidad lo encontré en la calle.","Véletlenül találkoztam vele az utcán.","By chance I met him in the street.","der Zufall","Zufällig traf ich ihn auf der Straße."),
("excusa",    "add","la excusa",   None, "kifogás / mentség", "excuse", "No tengo ninguna excusa.", "Nincs semmi mentségem.", "I have no excuse.", "die Entschuldigung / der Vorwand", "Ich habe keine Entschuldigung."),
("rodillas",  "add","la rodilla",  None, "térd", "knee", "Le duelen las rodillas al correr.", "Fájnak a térdei futás közben.", "His knees hurt when running.", "das Knie", "Seine Knie schmerzen beim Laufen."),
("cruz",      "add","la cruz",     None, "kereszt", "cross", "Llevaba una cruz de plata al cuello.", "Ezüstkeresztet viselt a nyakán.", "She wore a silver cross around her neck.", "das Kreuz", "Sie trug ein Silberkreuz um den Hals."),
("dulces",    "add","el dulce",    None, "édesség / édes", "sweet / candy", "Los niños adoran los dulces.", "A gyerekek imádják az édességet.", "Children love sweets.", "die Süßigkeit / süß", "Kinder lieben Süßigkeiten."),
# batch3
("zorra",     "add","la zorra",    None, "róka (nőstény) / szajha (argó)", "vixen / bitch (vulgar)", "La zorra escapó al bosque.", "A nőstény róka az erdőbe szökött.", "The vixen escaped into the forest.", "die Füchsin / die Schlampe (vulgär)", "Die Füchsin floh in den Wald."),
("cómodo",    "add","cómodo",      None, "kényelmes", "comfortable", "Este sillón es muy cómodo.", "Ez a fotel nagyon kényelmes.", "This armchair is very comfortable.", "bequem / komfortabel", "Dieser Sessel ist sehr bequem."),
("cruel",     "add","cruel",       None, "kegyetlen", "cruel", "Fue un acto cruel.", "Kegyetlen tett volt.", "It was a cruel act.", "grausam", "Es war eine grausame Tat."),
("sofá",      "add","el sofá",     None, "kanapé", "sofa / couch", "Se sentó en el sofá a ver la tele.", "Leült a kanapéra tévézni.", "She sat on the sofa to watch TV.", "das Sofa", "Sie setzte sich aufs Sofa, um fernzusehen."),
("perdiste",  "skip_dup", None, None, None, None, None, None, None, None, None),  # perder
("encantadora","skip_dup",None, None, None, None, None, None, None, None, None),  # encantador already added
("salgamos",  "skip_dup", None, None, None, None, None, None, None, None, None),  # salir
("sombra",    "add","la sombra",   None, "árnyék", "shadow / shade", "Se sentó a la sombra del árbol.", "A fa árnyékában ült le.", "She sat in the shade of the tree.", "der Schatten", "Sie setzte sich in den Schatten des Baumes."),
("ganó",      "add","ganar",       None, "nyerni / keresni", "to win / to earn", "Ganó el campeonato este año.", "Idén megnyerte a bajnokságot.", "He won the championship this year.", "gewinnen / verdienen", "Er gewann die Meisterschaft in diesem Jahr."),
("encantada", "skip_dup", None, None, None, None, None, None, None, None, None),  # encantador already added
("firmar",    "add","firmar",      None, "aláírni", "to sign", "Firma aquí, por favor.", "Írja alá itt, kérem.", "Please sign here.", "unterschreiben", "Bitte unterschreiben Sie hier."),
("escritorio","add","el escritorio",None,"íróasztal / asztal (munkaállomás)","desk","Deja el informe en mi escritorio.","Tedd a jelentést az íróasztalomra.","Leave the report on my desk.","der Schreibtisch","Leg den Bericht auf meinen Schreibtisch."),
("muñeca",    "add","la muñeca",   None, "baba (játék) / csukló", "doll / wrist", "La muñeca de porcelana es antigua.", "A porcelánbaba régi.", "The porcelain doll is antique.", "die Puppe / das Handgelenk", "Die Porzellanpuppe ist antik."),
("rastro",    "add","el rastro",   None, "nyom / jel", "trace / trail", "La policía siguió el rastro.", "A rendőrség követte a nyomot.", "The police followed the trail.", "die Spur", "Die Polizei folgte der Spur."),
("gigante",   "add","gigante",     None, "óriás", "giant / enormous", "Un árbol gigante bloqueaba el camino.", "Egy óriási fa zárta el az utat.", "A giant tree blocked the path.", "riesig / gigantisch", "Ein riesiger Baum versperrte den Weg."),
("pájaro",    "add","el pájaro",   None, "madár", "bird", "El pájaro cantaba en la rama.", "A madár énekelt az ágon.", "The bird sang on the branch.", "der Vogel", "Der Vogel sang auf dem Ast."),
("ducha",     "add","la ducha",    None, "zuhany", "shower", "Me doy una ducha cada mañana.", "Minden reggel zuhanyozom.", "I take a shower every morning.", "die Dusche", "Ich dusche jeden Morgen."),
("tomamos",   "skip_dup", None, None, None, None, None, None, None, None, None),  # tomar
("déjenme",   "skip_dup", None, None, None, None, None, None, None, None, None),  # dejar already added
("condición", "add","la condición",None,"feltétel / állapot","condition","Acepto con una condición.","Elfogadom egy feltétellel.","I accept on one condition.","die Bedingung / der Zustand","Ich akzeptiere unter einer Bedingung."),
("recompensa","add","la recompensa",None,"jutalom","reward","Le dieron una recompensa por su valentía.","Bátorságáért jutalmat kapott.","He was given a reward for his bravery.","die Belohnung","Er erhielt eine Belohnung für seinen Mut."),
("doce",      "add","doce",        None, "tizenkettő", "twelve", "Hay doce meses en un año.", "Egy évben tizenkét hónap van.", "There are twelve months in a year.", "zwölf", "Ein Jahr hat zwölf Monate."),
("actor",     "add","el actor",    None, "színész", "actor", "Es un actor famoso de Hollywood.", "Ő egy híres hollywoodi színész.", "He is a famous Hollywood actor.", "der Schauspieler", "Er ist ein berühmter Hollywood-Schauspieler."),
("actitud",   "add","la actitud",  None, "hozzáállás / attitűd", "attitude", "Tiene una actitud positiva.", "Pozitív hozzáállása van.", "He has a positive attitude.", "die Einstellung / die Haltung", "Er hat eine positive Einstellung."),
("cuida",     "add","cuidar",      None, "gondozni / vigyázni", "to take care of", "Cuida bien a tus hijos.", "Gondoskodj jól a gyerekeidről.", "Take good care of your children.", "sich kümmern um / pflegen", "Kümmere dich gut um deine Kinder."),
("salsa",     "add","la salsa",    None, "szósz / salsa (tánc)", "sauce / salsa", "La salsa de tomate es imprescindible.", "A paradicsomos szósz elengedhetetlen.", "Tomato sauce is essential.", "die Soße / die Salsa", "Tomatensoße ist unverzichtbar."),
("hubieran",  "skip_dup", None, None, None, None, None, None, None, None, None),  # haber
("carlos",    "skip_proper", None, None, None, None, None, None, None, None, None),
("personaje", "add","el personaje",None,"szereplő / személy","character / personage","El personaje principal es muy complejo.","A főszereplő nagyon összetett.","The main character is very complex.","die Figur / die Persönlichkeit","Die Hauptfigur ist sehr komplex."),
("dudas",     "add","la duda",     None, "kétség / kérdés", "doubt", "Tengo dudas sobre el plan.", "Kétségeim vannak a tervet illetően.", "I have doubts about the plan.", "der Zweifel", "Ich habe Zweifel am Plan."),
("jackie",    "skip_proper", None, None, None, None, None, None, None, None, None),
("cambios",   "add","el cambio",   None, "változás / csere", "change", "Los cambios son necesarios.", "A változások szükségesek.", "Changes are necessary.", "die Veränderung", "Veränderungen sind notwendig."),
("votos",     "add","el voto",     None, "szavazat / fogadalom", "vote / vow", "Los votos se cuentan al final.", "A szavazatokat a végén számolják.", "Votes are counted at the end.", "die Stimme / das Gelübde", "Die Stimmen werden am Ende gezählt."),
("vivido",    "skip_dup", None, None, None, None, None, None, None, None, None),  # vivir already added
("perdimos",  "skip_dup", None, None, None, None, None, None, None, None, None),  # perder
("suficientes","add","suficiente", None, "elegendő / elég", "sufficient / enough", "No hay recursos suficientes.", "Nincs elegendő erőforrás.", "There aren't sufficient resources.", "genug / ausreichend", "Es gibt nicht genug Ressourcen."),
("entrega",   "add","la entrega",  None, "kézbesítés / átadás", "delivery / handover", "La entrega del paquete se retrasó.", "A csomag kézbesítése késett.", "The package delivery was delayed.", "die Lieferung / die Übergabe", "Die Paketzustellung hat sich verzögert."),
("comercial", "add","comercial",   None, "kereskedelmi / reklám", "commercial", "El sector comercial crece.", "A kereskedelmi szektor növekszik.", "The commercial sector is growing.", "kommerziell / der Werbespot", "Der Handelssektor wächst."),
("decidí",    "skip_dup", None, None, None, None, None, None, None, None, None),  # decidir already added
("tribu",     "add","la tribu",    None, "törzs", "tribe", "La tribu celebró su ritual anual.", "A törzs megünnepelte éves szertartását.", "The tribe celebrated its annual ritual.", "der Stamm", "Der Stamm feierte sein jährliches Ritual."),
("pura",      "add","puro",        None, "tiszta / merő", "pure / sheer", "El agua es pura en este río.", "A víz tiszta ebben a folyóban.", "The water is pure in this river.", "rein / pur", "Das Wasser in diesem Fluss ist rein."),
("volveremos","skip_dup", None, None, None, None, None, None, None, None, None),  # volver
("voto",      "skip_dup", None, None, None, None, None, None, None, None, None),  # voto already added via votos
("méxico",    "skip_proper", None, None, None, None, None, None, None, None, None),
("amar",      "add","amar",        None, "szeretni / szerelmesnek lenni", "to love", "Amar es dar sin esperar nada.", "Szeretni annyit tesz, mint adni, nem várva vissza semmit.", "To love is to give without expecting anything.", "lieben", "Lieben bedeutet zu geben, ohne etwas zu erwarten."),
("poderoso",  "add","poderoso",    None, "erőteljes / hatalmas", "powerful", "Es un hombre muy poderoso.", "Nagyon hatalmas ember.", "He is a very powerful man.", "mächtig / kraftvoll", "Er ist ein sehr mächtiger Mann."),
("traigo",    "skip_dup", None, None, None, None, None, None, None, None, None),  # traer
("asesinatos","add","el asesinato",None,"gyilkosság","murder","Investigan los asesinatos en serie.","A sorozatgyilkosságokat vizsgálják.","They investigate the serial murders.","der Mord","Sie untersuchen die Serienmorde."),
("fresco",    "add","fresco",      None, "friss / hűs", "fresh / cool", "Prefiero el pescado fresco.", "A friss halat részesítem előnyben.", "I prefer fresh fish.", "frisch / kühl", "Ich bevorzuge frischen Fisch."),
("privada",   "add","privado",     None, "magán / privát", "private", "Es una reunión privada.", "Ez egy magántalálkozó.", "It's a private meeting.", "privat", "Es ist eine private Besprechung."),
("seamos",    "skip_dup", None, None, None, None, None, None, None, None, None),  # ser
("guarda",    "add","guardar",     None, "megőrizni / eltárolni", "to keep / to store", "Guarda este secreto.", "Tartsd meg ezt a titkot.", "Keep this secret.", "aufbewahren / speichern", "Bewahre dieses Geheimnis."),
("orgullosa", "skip_dup", None, None, None, None, None, None, None, None, None),  # orgullo/orgulloso
("vivimos",   "skip_dup", None, None, None, None, None, None, None, None, None),  # vivir already added
("difíciles", "add","difícil",     None, "nehéz", "difficult", "Son momentos difíciles.", "Nehéz idők ezek.", "These are difficult times.", "schwierig", "Das sind schwierige Zeiten."),
("hagámoslo", "skip_dup", None, None, None, None, None, None, None, None, None),  # hacer
("jefa",      "add","la jefa",     None, "főnöknő / vezető", "boss (female)", "La jefa tomó una decisión difícil.", "A főnöknő nehéz döntést hozott.", "The boss made a difficult decision.", "die Chefin", "Die Chefin traf eine schwierige Entscheidung."),
("trató",     "skip_dup", None, None, None, None, None, None, None, None, None),  # tratar already added
("senador",   "add","el senador",  None, "szenátor", "senator", "El senador presentó el proyecto de ley.", "A szenátor benyújtotta a törvényjavaslatot.", "The senator introduced the bill.", "der Senator", "Der Senator stellte den Gesetzentwurf vor."),
("ayudando",  "skip_dup", None, None, None, None, None, None, None, None, None),  # ayudar
("campeón",   "add","el campeón",  None, "bajnok", "champion", "Es el campeón del mundo.", "Ő a világ bajnoka.", "He is the world champion.", "der Champion / der Meister", "Er ist der Weltmeister."),
("bebiendo",  "skip_dup", None, None, None, None, None, None, None, None, None),  # beber
("adorable",  "add","adorable",    None, "imádnivaló / aranyos", "adorable", "El cachorro es adorable.", "A kölyökkutya imádnivaló.", "The puppy is adorable.", "entzückend / bezaubernd", "Das Welpe ist entzückend."),
("ayudó",     "skip_dup", None, None, None, None, None, None, None, None, None),  # ayudar
("ciego",     "add","ciego",       None, "vak", "blind", "Nació ciego pero es músico.", "Vaknak született, de zenész.", "He was born blind but is a musician.", "blind", "Er wurde blind geboren, ist aber Musiker."),
("falsa",     "add","falso",       None, "hamis / téves", "false / fake", "La alarma fue una falsa alarma.", "A riasztás vaklárma volt.", "The alarm was a false alarm.", "falsch / gefälscht", "Der Alarm war ein Fehlalarm."),
("jo",        "skip_abbrev", None, None, None, None, None, None, None, None, None),  # interjection
("sara",      "skip_proper", None, None, None, None, None, None, None, None, None),
("bestia",    "add","la bestia",   None, "vadállat / szörnyeteg", "beast", "Era una bestia feroz.", "Egy vad fenevad volt.", "It was a ferocious beast.", "das Tier / das Biest", "Es war ein wildes Tier."),
("alteza",    "add","la alteza",   None, "fenség (cím)", "highness (title)", "Su Alteza llegó al palacio.", "Őfensége megérkezett a palotába.", "His Highness arrived at the palace.", "die Hoheit", "Seine Hoheit kam im Palast an."),
("deseos",    "add","el deseo",    None, "kívánság / vágy", "wish / desire", "Cumplió todos sus deseos.", "Teljesítette az összes kívánságát.", "He fulfilled all his wishes.", "der Wunsch", "Er erfüllte alle seine Wünsche."),
("episodio",  "add","el episodio", None, "epizód / eset", "episode", "El último episodio fue emocionante.", "Az utolsó epizód izgalmas volt.", "The last episode was exciting.", "die Episode", "Die letzte Episode war aufregend."),
("celda",     "add","la celda",    None, "cella / börtöncella", "cell (prison)", "El preso estaba solo en su celda.", "A fogoly egyedül volt a cellájában.", "The prisoner was alone in his cell.", "die Zelle", "Der Gefangene war allein in seiner Zelle."),
("llevarlo",  "skip_dup", None, None, None, None, None, None, None, None, None),  # llevar
("aguanta",   "add","aguantar",    None, "kibírni / elviselni", "to endure / to hold on", "Aguanta un poco más.", "Bírj ki még egy kicsit.", "Hold on a little longer.", "aushalten / durchhalten", "Halt noch ein bisschen durch."),
("vengas",    "skip_dup", None, None, None, None, None, None, None, None, None),  # venir
("jueves",    "add","el jueves",   None, "csütörtök", "Thursday", "La reunión es el jueves.", "A megbeszélés csütörtökön van.", "The meeting is on Thursday.", "der Donnerstag", "Das Treffen ist am Donnerstag."),
("montañas",  "add","la montaña",  None, "hegy", "mountain", "Las montañas están cubiertas de nieve.", "A hegyek hóval borítottak.", "The mountains are covered in snow.", "der Berg", "Die Berge sind mit Schnee bedeckt."),
("pensamientos","add","el pensamiento",None,"gondolat","thought","Comparte tus pensamientos con nosotros.","Oszd meg velünk a gondolataidat.","Share your thoughts with us.","der Gedanke","Teile deine Gedanken mit uns."),
("medianoche","add","la medianoche",None,"éjfél","midnight","El tren llega a medianoche.","A vonat éjfélkor érkezik.","The train arrives at midnight.","die Mitternacht","Der Zug kommt um Mitternacht an."),
("llevarme",  "skip_dup", None, None, None, None, None, None, None, None, None),  # llevar
("garganta",  "add","la garganta", None, "torok", "throat", "Le duele la garganta.", "Fáj a torka.", "Her throat hurts.", "die Kehle / der Hals", "Ihr tut die Kehle weh."),
("sesión",    "add","la sesión",   None, "ülés / foglalkozás", "session", "La sesión de entrenamiento duró dos horas.", "Az edzésfoglalkozás két óráig tartott.", "The training session lasted two hours.", "die Sitzung", "Die Trainingssitzung dauerte zwei Stunden."),
("pensaste",  "skip_dup", None, None, None, None, None, None, None, None, None),  # pensar already added
("diles",     "skip_dup", None, None, None, None, None, None, None, None, None),  # decir
("muera",     "skip_dup", None, None, None, None, None, None, None, None, None),  # morir already added
("coma",      "add","el coma",     None, "kóma", "coma", "El paciente salió del coma.", "A beteg felébredt a kómából.", "The patient came out of the coma.", "das Koma", "Der Patient erwachte aus dem Koma."),
("sentimos",  "skip_dup", None, None, None, None, None, None, None, None, None),  # sentir
("creas",     "skip_dup", None, None, None, None, None, None, None, None, None),  # creer
("escribe",   "skip_dup", None, None, None, None, None, None, None, None, None),  # escribir
("identificación","add","la identificación",None,"azonosítás / személyigazolvány","identification","Muestra tu identificación, por favor.","Kérlek, mutasd fel a személyigazolványodat.","Please show your ID.","der Ausweis / die Identifizierung","Zeig bitte deinen Ausweis."),
("circunstancias","add","la circunstancia",None,"körülmény","circumstance","Las circunstancias han cambiado.","A körülmények megváltoztak.","The circumstances have changed.","der Umstand","Die Umstände haben sich geändert."),
("preguntado","skip_dup", None, None, None, None, None, None, None, None, None),  # preguntar
("veneno",    "add","el veneno",   None, "méreg", "poison", "La serpiente inyectó veneno.", "A kígyó mérget fecskendezett be.", "The snake injected venom.", "das Gift", "Die Schlange injizierte Gift."),
("súper",     "add","súper",       None, "szuper / szupermarket", "super / great", "Lo hiciste súper bien.", "Szuperül csináltad.", "You did it super well.", "super / klasse", "Du hast es super gemacht."),
("vuestros",  "add","vuestro",     None, "a tietek (tb)", "yours (plural, Spain)", "¿Son vuestros estos libros?", "Ezek a könyvek a tiéitek?", "Are these books yours?", "euer / eure", "Sind diese Bücher eure?"),
("queríamos", "skip_dup", None, None, None, None, None, None, None, None, None),  # querer
("aquello",   "add","aquello",     None, "az (a dolog) / amaz", "that (thing over there)", "Aquello fue un error enorme.", "Az hatalmas hiba volt.", "That was a huge mistake.", "das da / jenes", "Das war ein riesiger Fehler."),
("preocuparse","add","preocuparse",None,"aggódni / nyugtalankodni","to worry","No te preocupes por eso.","Ne aggódj miatta.","Don't worry about that.","sich sorgen / sich kümmern","Mach dir keine Sorgen darum."),
("martes",    "add","el martes",   None, "kedd", "Tuesday", "El dentista me recibe el martes.", "A fogorvos kedden fogad.", "The dentist sees me on Tuesday.", "der Dienstag", "Der Zahnarzt empfängt mich am Dienstag."),
]

print(f"Part2 entries defined: {len(ENTRIES)}")
adds = [e for e in ENTRIES if e[1] == 'add']
print(f"  adds: {len(adds)}")
print(f"  skip_proper: {len([e for e in ENTRIES if e[1]=='skip_proper'])}")
print(f"  skip_abbrev: {len([e for e in ENTRIES if e[1]=='skip_abbrev'])}")
print(f"  skip_dup: {len([e for e in ENTRIES if e[1]=='skip_dup'])}")
