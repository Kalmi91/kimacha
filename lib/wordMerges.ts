// GENERATED FILE (the generator scripts/dedupe-words.mjs has been removed), do not edit by hand.
//
// Deleted word id -> id of the surviving (lower-level) twin. The DB migration
// carries progress over using this map, so that the duplicate cleanup does not discard
// what the learner has already learned. Only unambiguous pairs go here: if the deleted
// id is still used by another level, the pair is left out (the migration does not guess).

export const WORD_MERGES: Record<number, number> = {
  203: 1171, // el aeropuerto: A2 deleted, A1 kept
  206: 1130, // la cuenta: A2 deleted, A1 kept
  207: 1138, // la propina: A2 deleted, A1 kept
  208: 1397, // el precio: A2 deleted, A1 kept
  209: 1398, // barato: A2 deleted, A1 kept
  210: 1399, // caro: A2 deleted, A1 kept
  212: 1875, // la película: A2 deleted, A1 kept
  214: 1407, // cocinar: A2 deleted, A1 kept
  215: 1408, // limpiar: A2 deleted, A1 kept
  220: 1870, // las vacaciones: A2 deleted, A1 kept
  221: 1869, // la playa: A2 deleted, A1 kept
  222: 1872, // la montaña: A2 deleted, A1 kept
  224: 1863, // el bosque: A2 deleted, A1 kept
  225: 1836, // la flor: A2 deleted, A1 kept
  229: 1182, // el viento: A2 deleted, A1 kept
  231: 1819, // el verano: A2 deleted, A1 kept
  233: 1820, // el invierno: A2 deleted, A1 kept
  241: 1396, // pagar: A2 deleted, A1 kept
  244: 1367, // tranquilo: A2 deleted, A1 kept
  247: 1892, // abierto: A2 deleted, A1 kept
  249: 1430, // lleno: A2 deleted, A1 kept
  250: 1493, // vacío: A2 deleted, A1 kept
  304: 1856, // la empresa: B1 deleted, A1 kept
  343: 1370, // orgulloso: B1 deleted, A1 kept
  405: 1733, // el plazo: B2 deleted, B1 kept
  410: 1808, // superar: B2 deleted, B1 kept
  431: 1820, // aprovechar: B2 deleted, B1 kept
  442: 1719, // convencer: B2 deleted, B1 kept
  443: 1807, // exigir: B2 deleted, B1 kept
  444: 1722, // reconocer: B2 deleted, B1 kept
  446: 2089, // agradecer: B2 deleted, A2 kept
  448: 2713, // atreverse: B2 deleted, B1 kept
  519: 1739, // el dilema: C1 deleted, B1 kept
  548: 427, // paulatino: C1 deleted, B2 kept
  681: 1403, // el cambio: A2 deleted, A1 kept
  682: 1401, // el mercado: A2 deleted, A1 kept
  683: 1279, // la llave: A2 deleted, A1 kept
  684: 1845, // el ruido: A2 deleted, A1 kept
  686: 1099, // la escalera: A2 deleted, A1 kept
  689: 1300, // el semáforo: A2 deleted, A1 kept
  690: 1163, // el tren: A2 deleted, A1 kept
  691: 1166, // el billete: A2 deleted, A1 kept
  693: 1219, // la plaza: A2 deleted, A1 kept
  694: 1223, // la iglesia: A2 deleted, A1 kept
  695: 1221, // la farmacia: A2 deleted, A1 kept
  697: 1839, // el dolor: A2 deleted, A1 kept
  699: 1134, // el plato: A2 deleted, A1 kept
  700: 1058, // la carne: A2 deleted, A1 kept
  701: 1059, // el pescado: A2 deleted, A1 kept
  702: 1061, // la verdura: A2 deleted, A1 kept
  703: 1262, // el postre: A2 deleted, A1 kept
  1886: 39, // encontrar: A1 deleted, A0 kept
  2032: 1888, // sonar: A2 deleted, A1 kept
  2140: 1372, // levantarse: A2 deleted, A1 kept
  2189: 1357, // el bebé: A2 deleted, A1 kept
  2209: 1411, // leer: A2 deleted, A1 kept
  2310: 35, // decir: B1 deleted, A0 kept
  2315: 29, // poder: B1 deleted, A0 kept
  2318: 55, // adiós: B1 deleted, A0 kept
  2326: 1881, // usar: B1 deleted, A1 kept
  2366: 213, // la canción: B1 deleted, A2 kept
  2369: 1474, // poner: B1 deleted, A2 kept
  2371: 1147, // confiar: B1 deleted, A2 kept
  2388: 1656, // amar: B1 deleted, A2 kept
  2391: 2022, // el auto: B1 deleted, A2 kept
  2399: 1927, // andar: B1 deleted, A2 kept
  2424: 1583, // la decisión: B1 deleted, A2 kept
  2428: 2161, // parar: B1 deleted, A2 kept
  2460: 2036, // el asesino: B1 deleted, A2 kept
  2470: 2122, // mentir: B1 deleted, A2 kept
  2473: 1411, // leer: B1 deleted, A1 kept
  2475: 2216, // servir: B1 deleted, A2 kept
  2478: 2017, // igual: B1 deleted, A2 kept
  2503: 1673, // perder: B1 deleted, A2 kept
  2509: 2054, // el asesinato: B1 deleted, A2 kept
  2572: 2191, // llorar: B1 deleted, A2 kept
  2636: 2167, // luchar: B1 deleted, A2 kept
  2674: 1903, // tonto: B1 deleted, A2 kept
  2688: 2046, // callarse: B1 deleted, A2 kept
  2694: 1893, // ocurrir: B1 deleted, A2 kept
  2720: 2067, // echar: B1 deleted, A2 kept
  2722: 1887, // pasar: B1 deleted, A1 kept
  2728: 1347, // el tío: B1 deleted, A1 kept
  2842: 2270, // comprender: B1 deleted, A2 kept
  2860: 1884, // empezar: B1 deleted, A1 kept
  2861: 2107, // actuar: B1 deleted, A2 kept
  2864: 2088, // recibir: B1 deleted, A2 kept
  2888: 2252, // detener: B1 deleted, A2 kept
  2890: 1971, // soler: B1 deleted, A2 kept
  2904: 2111, // romper: B1 deleted, A2 kept
  2908: 2169, // averiguar: B1 deleted, A2 kept
  2932: 2120, // merecer: B1 deleted, A2 kept

  // es A0-A1:
  3912: 1522, // la venda: A1 deleted, A1 kept (el vendaje / la venda is one card, synonym)

  // es A2:
  3754: 709, // suerte: A2 duplicate (without article), "la suerte" kept
  3462: 2045, // diferentes: A2 regular plural, diferente kept
  1948: 1893, // suceder: A2 synonym, ocurrir kept (ocurrir / suceder)
  3621: 3453, // santa: A2 regular feminine, santo kept
  1958: 2021, // listos: A2 regular plural, listo kept
  1964: 3730, // prisión: A2 synonym, cárcel kept (la cárcel / la prisión)
  3659: 3473, // bienvenida: A2 regular feminine, bienvenido kept

  // es B1:
  3799: 759, // completamente: B1 synonym, totalmente kept (totalmente / completamente)
  3847: 3809, // la delito: B1 duplicate with a wrong-gender article, el delito kept
  2793: 2513, // el trozo: B1 synonym, el pedazo kept (el pedazo / el trozo)
  2398: 2539, // el celular: B1 regional duplicate, el móvil kept (the MX form is in the note)

  // es B2-C2:
  7341: 3399, // la placa solar: B2 synonym, el panel solar kept (el panel solar / la placa solar)
  3247: 3226, // semejante: B2 synonym (more elevated), similar kept (similar / semejante)
  530: 3925, // rebatir: C1 synonym, refutar kept (refutar / rebatir)
  // el/la -> el, the hidden twins surfaced:
  3804: 3601, // el testigo: B1 deleted, A2 kept
  2584: 1854, // el jefe: B1 deleted, A1 kept

  // es A1: regular plural, the singular
  // twin is kept; here the singular form lived at a HIGHER level (B2), so the
  // lower-level plural card was turned into a singular one, and the
  // higher-level twin was deleted (per the WORD_MERGES convention the
  // lower level is kept).
  3054: 1078, // el zapato: B2 deleted, A1 kept (los zapatos -> el zapato)

  // es A2: regular plural, the singular twin is kept
  3460: 3691, // el cielo: A2 plural deleted, A2 kept
  3498: 3722, // la carta: A2 plural deleted, A2 kept
  3525: 2085, // el animal: A2 plural deleted, A2 kept
  3540: 1836, // la flor: A2 plural deleted, A1 kept
  3560: 1278, // la luz: A2 plural deleted, A1 kept
  3574: 1114, // la pierna: A2 plural deleted, A1 kept
  3586: 3676, // el plan: A2 plural deleted, A2 kept
  3591: 41, // el nombre: A2 plural deleted, A0 kept
  3595: 1077, // el pantalón: A2 plural deleted, A1 kept
  3604: 3652, // el soldado: A2 plural deleted, A2 kept
  3611: 2314, // el sentimiento: A2 plural deleted, B1 kept
  3615: 1279, // la llave: A2 plural deleted, A1 kept
  3616: 1382, // el perro: A2 plural deleted, A1 kept
  3620: 1168, // el metro: A2 plural deleted, A1 kept
  3623: 1600, // el cliente: A2 plural deleted, A1 kept
  3627: 2175, // la dama: A2 plural deleted, A2 kept
  3639: 1115, // el brazo: A2 plural deleted, A1 kept
  3646: 2041, // el asunto: A2 plural deleted, A2 kept
  3662: 226, // la estrella: A2 plural deleted, A2 kept
  3688: 1314, // la semana: A2 plural deleted, A1 kept
  3692: 1859, // la pregunta: A2 plural deleted, A1 kept
  3699: 1855, // la noticia: A2 plural deleted, A1 kept
  3706: 3018, // el dólar: A2 plural deleted, B2 kept
  1901: 2171, // el caballero: A2 plural deleted, A2 kept
  1912: 2056, // la foto: A2 plural deleted, A2 kept
  1934: 2052, // el pie: A2 plural deleted, A2 kept
  1940: 1979, // el tipo: A2 plural deleted, A2 kept
  1993: 3008, // el chico: A2 plural deleted, B2 kept
  2033: 2174, // el millón: A2 plural deleted, A2 kept
  2078: 3012, // el detalle: A2 plural deleted, B2 kept
  2081: 2011, // el punto: A2 plural deleted, A2 kept
  2121: 2959, // el rayo: A2 plural deleted, B1 kept
  2128: 3717, // la relación: A2 plural deleted, A2 kept
  2135: 3766, // la razón: A2 plural deleted, A2 kept
  2152: 2034, // el modo: A2 plural deleted, A2 kept
  2163: 3421, // la orden: A2 plural deleted, A2 kept
  2178: 1977, // el momento: A2 plural deleted, A2 kept
  2239: 2024, // el número: A2 plural deleted, A2 kept

  // es A2: level inversion, the higher-level twin is deleted
  2408: 3466, // la regla: B1 deleted, A2 kept (las reglas -> la regla) [regla is also in A2 game content]

  // es B1: regular plural, the singular twin is kept
  2292: 1385, // el pez: B1 plural deleted, A1 kept
  2313: 2337, // la habilidad: B1 plural deleted, B1 kept
  2316: 3630, // la operación: B1 plural deleted, A2 kept
  2329: 1575, // la habitación: B1 plural deleted, A1 kept
  2330: 3872, // la galleta: B1 plural deleted, A1 kept
  2348: 2246, // el ladrón: B1 plural deleted, A2 kept
  2358: 3085, // el rumor: B1 plural deleted, B2 kept
  2447: 2179, // la posibilidad: B1 plural deleted, A2 kept
  2449: 2280, // el registro: B1 plural deleted, A2 kept
  2455: 1943, // la señal: B1 plural deleted, A2 kept
  2457: 2173, // la imagen: B1 plural deleted, A2 kept
  2482: 3543, // la opción: B1 plural deleted, A2 kept
  2502: 2507, // el voto: B1 plural deleted, B1 kept
  2546: 2497, // la condición: B1 plural deleted, B1 kept
  2551: 3465, // la acción: B1 plural deleted, A2 kept
  2554: 2484, // el archivo: B1 plural deleted, B1 kept
  2594: 2346, // el pensamiento: B1 plural deleted, B1 kept
  2638: 2230, // el periódico: B1 plural deleted, A2 kept
  2655: 2158, // el fondo: B1 plural deleted, A2 kept
  2666: 2939, // el empleado: B1 plural deleted, B1 kept
  2669: 2708, // el prisionero: B1 plural deleted, B1 kept
  2672: 1941, // el crimen: B1 plural deleted, A2 kept
  2679: 2945, // el adulto: B1 plural deleted, B1 kept
  2687: 7168, // el subtítulo: B1 plural deleted, B2 kept
  2702: 1164, // el avión: B1 plural deleted, A1 kept
  2711: 2808, // la emoción: B1 plural deleted, B1 kept
  2735: 2125, // el efecto: B1 plural deleted, A2 kept
  2756: 3150, // el diamante: B1 plural deleted, B2 kept
  2757: 2203, // la unidad: B1 plural deleted, A2 kept
  2773: 2040, // el grupo: B1 plural deleted, A2 kept
  2789: 3634, // la elección: B1 plural deleted, A2 kept
  2845: 2552, // el siglo: B1 plural deleted, B1 kept
  2854: 2074, // el monstruo: B1 plural deleted, A2 kept
  2871: 3726, // la reunión: B1 plural deleted, A2 kept
  2873: 3703, // la voz: B1 plural deleted, A2 kept
  2879: 2263, // el cadáver: B1 plural deleted, A2 kept
  2891: 2786, // el producto: B1 plural deleted, B1 kept
  2917: 2020, // la oportunidad: B1 plural deleted, A2 kept
  2924: 2578, // el socio: B1 plural deleted, B1 kept
  2927: 2268, // el francés: B1 plural deleted, A2 kept
  2954: 2658, // el cigarrillo: B1 plural deleted, B1 kept
  2978: 2649, // la autoridad: B1 plural deleted, B1 kept
  2985: 2608, // el jugador: B1 plural deleted, B1 kept
  2997: 2332, // el objeto: B1 plural deleted, B1 kept
  2999: 3141, // el término: B1 plural deleted, B2 kept

  // es B1: level inversion, the higher-level twin is deleted
  6578: 2633, // el impuesto: C1 deleted, B1 kept (los impuestos -> el impuesto) [impuestos is also in a B1 sentence]

  // es B2: regular plural, the singular twin is kept
  3010: 213, // la canción: B2 plural deleted, A2 kept
  3011: 3729, // la decisión: B2 plural deleted, A2 kept
  3035: 2101, // la intención: B2 plural deleted, A2 kept
  3058: 3350, // la célula: B2 plural deleted, B2 kept
  3075: 1857, // el examen: B2 plural deleted, A1 kept
  3185: 3638, // la conversación: B2 plural deleted, A2 kept
  3186: 2378, // la lección: B2 plural deleted, B1 kept
};
