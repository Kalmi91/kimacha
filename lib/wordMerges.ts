// GENERÁLT FÁJL, ne szerkeszd kézzel: node scripts/dedupe-words.mjs --write
//
// Törölt szó-id -> a megmaradt (alacsonyabb szintű) iker id-je. A DB-migráció
// ezen a térképen viszi át a haladást, hogy a duplikátum-takarítás ne dobja el,
// amit a tanuló már megtanult. Csak egyértelmű párok kerülnek ide: ha a törölt
// id-t egy másik szint még használja, a pár kimarad (a migráció nem találgat).

export const WORD_MERGES: Record<number, number> = {
  203: 1171, // el aeropuerto: A2 törölve, marad A1
  206: 1130, // la cuenta: A2 törölve, marad A1
  207: 1138, // la propina: A2 törölve, marad A1
  208: 1397, // el precio: A2 törölve, marad A1
  209: 1398, // barato: A2 törölve, marad A1
  210: 1399, // caro: A2 törölve, marad A1
  212: 1875, // la película: A2 törölve, marad A1
  214: 1407, // cocinar: A2 törölve, marad A1
  215: 1408, // limpiar: A2 törölve, marad A1
  220: 1870, // las vacaciones: A2 törölve, marad A1
  221: 1869, // la playa: A2 törölve, marad A1
  222: 1872, // la montaña: A2 törölve, marad A1
  224: 1863, // el bosque: A2 törölve, marad A1
  225: 1836, // la flor: A2 törölve, marad A1
  229: 1182, // el viento: A2 törölve, marad A1
  231: 1819, // el verano: A2 törölve, marad A1
  233: 1820, // el invierno: A2 törölve, marad A1
  241: 1396, // pagar: A2 törölve, marad A1
  244: 1367, // tranquilo: A2 törölve, marad A1
  247: 1892, // abierto: A2 törölve, marad A1
  249: 1430, // lleno: A2 törölve, marad A1
  250: 1493, // vacío: A2 törölve, marad A1
  304: 1856, // la empresa: B1 törölve, marad A1
  343: 1370, // orgulloso: B1 törölve, marad A1
  405: 1733, // el plazo: B2 törölve, marad B1
  410: 1808, // superar: B2 törölve, marad B1
  431: 1820, // aprovechar: B2 törölve, marad B1
  442: 1719, // convencer: B2 törölve, marad B1
  443: 1807, // exigir: B2 törölve, marad B1
  444: 1722, // reconocer: B2 törölve, marad B1
  446: 2089, // agradecer: B2 törölve, marad A2
  448: 2713, // atreverse: B2 törölve, marad B1
  519: 1739, // el dilema: C1 törölve, marad B1
  548: 427, // paulatino: C1 törölve, marad B2
  681: 1403, // el cambio: A2 törölve, marad A1
  682: 1401, // el mercado: A2 törölve, marad A1
  683: 1279, // la llave: A2 törölve, marad A1
  684: 1845, // el ruido: A2 törölve, marad A1
  686: 1099, // la escalera: A2 törölve, marad A1
  689: 1300, // el semáforo: A2 törölve, marad A1
  690: 1163, // el tren: A2 törölve, marad A1
  691: 1166, // el billete: A2 törölve, marad A1
  693: 1219, // la plaza: A2 törölve, marad A1
  694: 1223, // la iglesia: A2 törölve, marad A1
  695: 1221, // la farmacia: A2 törölve, marad A1
  697: 1839, // el dolor: A2 törölve, marad A1
  699: 1134, // el plato: A2 törölve, marad A1
  700: 1058, // la carne: A2 törölve, marad A1
  701: 1059, // el pescado: A2 törölve, marad A1
  702: 1061, // la verdura: A2 törölve, marad A1
  703: 1262, // el postre: A2 törölve, marad A1
  1886: 39, // encontrar: A1 törölve, marad A0
  2032: 1888, // sonar: A2 törölve, marad A1
  2140: 1372, // levantarse: A2 törölve, marad A1
  2189: 1357, // el bebé: A2 törölve, marad A1
  2209: 1411, // leer: A2 törölve, marad A1
  2310: 35, // decir: B1 törölve, marad A0
  2315: 29, // poder: B1 törölve, marad A0
  2318: 55, // adiós: B1 törölve, marad A0
  2326: 1881, // usar: B1 törölve, marad A1
  2366: 213, // la canción: B1 törölve, marad A2
  2369: 1474, // poner: B1 törölve, marad A2
  2371: 1147, // confiar: B1 törölve, marad A2
  2388: 1656, // amar: B1 törölve, marad A2
  2391: 2022, // el auto: B1 törölve, marad A2
  2399: 1927, // andar: B1 törölve, marad A2
  2424: 1583, // la decisión: B1 törölve, marad A2
  2428: 2161, // parar: B1 törölve, marad A2
  2460: 2036, // el asesino: B1 törölve, marad A2
  2470: 2122, // mentir: B1 törölve, marad A2
  2473: 1411, // leer: B1 törölve, marad A1
  2475: 2216, // servir: B1 törölve, marad A2
  2478: 2017, // igual: B1 törölve, marad A2
  2503: 1673, // perder: B1 törölve, marad A2
  2509: 2054, // el asesinato: B1 törölve, marad A2
  2572: 2191, // llorar: B1 törölve, marad A2
  2636: 2167, // luchar: B1 törölve, marad A2
  2674: 1903, // tonto: B1 törölve, marad A2
  2688: 2046, // callarse: B1 törölve, marad A2
  2694: 1893, // ocurrir: B1 törölve, marad A2
  2720: 2067, // echar: B1 törölve, marad A2
  2722: 1887, // pasar: B1 törölve, marad A1
  2728: 1347, // el tío: B1 törölve, marad A1
  2842: 2270, // comprender: B1 törölve, marad A2
  2860: 1884, // empezar: B1 törölve, marad A1
  2861: 2107, // actuar: B1 törölve, marad A2
  2864: 2088, // recibir: B1 törölve, marad A2
  2888: 2252, // detener: B1 törölve, marad A2
  2890: 1971, // soler: B1 törölve, marad A2
  2904: 2111, // romper: B1 törölve, marad A2
  2908: 2169, // averiguar: B1 törölve, marad A2
  2932: 2120, // merecer: B1 törölve, marad A2

  // PROMPT-POLICY 3/7 (es A0-A1):
  3912: 1522, // la venda: A1 törölve, marad A1 (el vendaje / la venda egy kártya, szinoníma)

  // PROMPT-POLICY 3/7 (es A2):
  3754: 709, // suerte: A2 duplikátum (névelő nélkül), marad "la suerte"
  3462: 2045, // diferentes: A2 szabályos többes, marad diferente
  1948: 1893, // suceder: A2 szinonima, marad ocurrir (ocurrir / suceder)
  3621: 3453, // santa: A2 szabályos nőnem, marad santo
  1958: 2021, // listos: A2 szabályos többes, marad listo
  1964: 3730, // prisión: A2 szinonima, marad cárcel (la cárcel / la prisión)
  3659: 3473, // bienvenida: A2 szabályos nőnem, marad bienvenido

  // PROMPT-POLICY 3/7 (es B1):
  3799: 759, // completamente: B1 szinonima, marad totalmente (totalmente / completamente)
  3847: 3809, // la delito: B1 duplikátum hibás nemű cikkel, marad el delito
  2793: 2513, // el trozo: B1 szinonima, marad el pedazo (el pedazo / el trozo)
  2398: 2539, // el celular: B1 regionális duplikátum, marad el móvil (MX-alak a jegyzetben)

  // PROMPT-POLICY 3/7 (es B2-C2):
  7341: 3399, // la placa solar: B2 szinonima, marad el panel solar (el panel solar / la placa solar)
  3247: 3226, // semejante: B2 szinonima (választékosabb), marad similar (similar / semejante)
  530: 3925, // rebatir: C1 szinonima, marad refutar (refutar / rebatir)
  // PROMPT-POLICY 5 / FB285 (el/la -> el, a rejtett ikrek előkerültek):
  3804: 3601, // el testigo: B1 törölve, marad A2
  2584: 1854, // el jefe: B1 törölve, marad A1
};
