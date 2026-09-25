// GENERÁLT FÁJL, ne szerkeszd kézzel: node scripts/pcic-dedup.mjs --write
//
// PLAN-fb0924 7b. lépés (FB384, D3+D4): törölt (magasabb szintű/szinten-belüli
// duplikátum) PCIC-item-id -> a megmaradó (legalacsonyabb szintű) item-id. A DB-
// migráció (lib/db/migrations.ts applyPcicDedup) ezen a térképen viszi át a
// meglévő pcic_cards SRS-haladást; ha MINDKÉT oldalon van haladás, az erősebb
// (több sikeres ismétlés, aztán nagyobb interval) nyer, a gyengébb sor törlődik.

export const PCIC_DEDUP_MOVES: Record<string, string> = {
  'a2-1ab1b3e3': 'a1-1ab1b3e3', // tener: A2 -> A1
  'a2-1b94c09a': 'a1-1b94c09a', // haber: A2 -> A1
  'a2-605d3374': 'a1-605d3374', // ser: A2 -> A1
  'b1-e3795368': 'a1-cc04dcdc', // encontrar (algo): B1 -> A1
  'a2-363da8b7': 'a1-363da8b7', // precio: A2 -> A1
  'b2-5e11eb4f': 'a1-5e11eb4f', // largo: B2 -> A1
  'b2-2be975bf': 'a1-a523e566', // corto (metraje): B2 -> A1
  'b2-ee24bfdc': 'a1-ee24bfdc', // alto: B2 -> A1
  'a1-1388b778': 'a1-dcb8c894', // metro: A1 -> A1
  'a2-9b641269': 'a1-7a5e88d9', // pasar (por): A2 -> A1
  'b2-c4cc3529': 'a1-68d3e031', // estrecho: B2 -> A1
  'b2-0b950c55': 'a1-3d61f0ce', // ancho: B2 -> A1
  'a1-34bbe760': 'a1-88fc207c', // cerca: A1 -> A1
  'a1-96b5d8f2': 'a1-144962e3', // lejos: A1 -> A1
  'a1-058471a8': 'a1-050bc4fe', // a la derecha: A1 -> A1
  'b1-050bc4fe': 'a1-050bc4fe', // a la derecha (de): B1 -> A1
  'a1-e1ffea86': 'a1-1c3792cb', // a la izquierda: A1 -> A1
  'b1-1c3792cb': 'a1-1c3792cb', // a la izquierda (de): B1 -> A1
  'b1-0aab1f04': 'a1-0aab1f04', // al final (de): B1 -> A1
  'b1-74aa37b1': 'a1-0aab1f04', // al final: B1 -> A1
  'a2-ed7ad1f6': 'a1-ed7ad1f6', // entre: A2 -> A1
  'a2-8f9f97eb': 'a1-8f9f97eb', // calle: A2 -> A1
  'b1-851c2e6d': 'a1-34f76036', // caminar: B1 -> A1
  'a2-cef4b5e9': 'a1-cef4b5e9', // antes: A2 -> A1
  'b1-14fdf15f': 'a1-4dfc27c1', // llevar: B1 -> A1
  'b2-14fdf15f': 'a1-4dfc27c1', // llevar: B2 -> A1
  'a2-a72d6a82': 'a1-48765024', // delante (de): A2 -> A1
  'a2-ae85e826': 'a1-1637f2cf', // detrás (de): A2 -> A1
  'a1-341a5930': 'a1-285fbe53', // fin de semana: A1 -> A1
  'a2-637e9229': 'a1-637e9229', // cambiar: A2 -> A1
  'a2-959d918a': 'a1-959d918a', // gafas: A2 -> A1
  'a2-98a793c7': 'a1-98a793c7', // claro: A2 -> A1
  'b1-98a793c7': 'a1-98a793c7', // claro: B1 -> A1
  'b2-c0db1ada': 'a1-c0db1ada', // oscuro: B2 -> A1
  'a2-5e0b8aa1': 'a1-5e0b8aa1', // ver: A2 -> A1
  'b1-2fb779d3': 'a1-5e0b8aa1', // ver (algo): B1 -> A1
  'a2-08571a9e': 'a1-08571a9e', // escuchar: A2 -> A1
  'a2-3cf34940': 'a1-3cf34940', // naranja: A2 -> A1
  'a2-da6dfa2b': 'a1-da6dfa2b', // viejo: A2 -> A1
  'a2-a9df7a76': 'a1-a9df7a76', // entrada: A2 -> A1
  'b1-a9df7a76': 'a1-a9df7a76', // entrada: B1 -> A1
  'a2-7ad19951': 'a1-0b38ae75', // salida: A2 -> A1
  'b2-13c4f05a': 'a1-13c4f05a', // cerrar: B2 -> A1
  'a2-28e5793a': 'a1-28e5793a', // bueno: A2 -> A1
  'a2-bf7cdc72': 'a1-bf7cdc72', // malo: A2 -> A1
  'a1-d4e2f608': 'a1-5a32ead2', // bien: A1 -> A1
  'b1-5f51efbe': 'a1-5f51efbe', // regular: B1 -> A1
  'b1-93cf094f': 'a1-3e178482', // cambio: B1 -> A1
  'b1-7af0f1c6': 'a1-e8d19826', // fuerte: B1 -> A1
  'b1-1824d6bc': 'a1-7da0ef23', // piel: B1 -> A1
  'b2-1824d6bc': 'a1-7da0ef23', // piel: B2 -> A1
  'b1-f02ef2ac': 'a1-0f0b5b56', // ser moreno (de piel): B1 -> A1
  'b1-6efb2f76': 'a1-48d4cd11', // pintar: B1 -> A1
  'b1-bd17811d': 'a1-a8be1b78', // antiguo: B1 -> A1
  'b1-2e1b710d': 'a1-2e1b710d', // levantarse: B1 -> A1
  'a2-33aa91b9': 'a1-a1d7da7c', // inteligente: A2 -> A1
  'b1-d0f16530': 'a1-d0f16530', // trabajador: B1 -> A1
  'a2-76e69820': 'a1-ee6093af', // serio: A2 -> A1
  'b1-5695924a': 'a1-5695924a', // dirección: B1 -> A1
  'b2-5695924a': 'a1-5695924a', // dirección: B2 -> A1
  'b1-dae2f72e': 'a1-dae2f72e', // paseo: B1 -> A1
  'a1-da84060c': 'a1-90d94ae3', // el piso: A1 -> A1
  'b2-b1b3592d': 'a1-a5cd9d69', // poder: B2 -> A1
  'b1-08572461': 'a1-3d099f1f', // móvil: B1 -> A1
  'b2-abf1aa4a': 'a1-7ac58255', // mano: B2 -> A1
  'b1-287c5312': 'a1-287c5312', // edad: B1 -> A1
  'a2-18ad3550': 'a1-18ad3550', // joven: A2 -> A1
  'b1-d636d880': 'a1-0ee3e0a9', // separado (de): B1 -> A1
  'b1-0ee3e0a9': 'a1-0ee3e0a9', // separado: B1 -> A1
  'b2-3b660a83': 'a1-3b660a83', // familia: B2 -> A1
  'a1-946fa7e5': 'a1-67874488', // compañero (de juego): A1 -> A1
  'a2-98462fdf': 'a1-98462fdf', // vino blanco: A2 -> A1
  'a2-57219a77': 'a1-57219a77', // vino tinto: A2 -> A1
  'a1-101f0e64': 'a1-266ffb6d', // cuenta: A1 -> A1
  'b1-686bf5da': 'a1-686bf5da', // clase: B1 -> A1
  'a2-235acfdf': 'a1-235acfdf', // director: A2 -> A1
  'b1-5347c609': 'a1-5347c609', // actividad: B1 -> A1
  'a2-0524ae33': 'a1-0524ae33', // pregunta: A2 -> A1
  'b1-42bd1643': 'a1-42bd1643', // entender: B1 -> A1
  'a2-4e747478': 'a1-15725a66', // comprender: A2 -> A1
  'b1-6d611149': 'a1-6d611149', // practicar: B1 -> A1
  'a2-cb030c5e': 'a1-cb030c5e', // papel: A2 -> A1
  'a1-a4adaa62': 'a1-5d26b8f2', // trabajar: A1 -> A1
  'a2-da41abc0': 'a1-da41abc0', // fax: A2 -> A1
  'a2-43e97870': 'a1-43e97870', // correr: A2 -> A1
  'a2-aa153cb1': 'a1-aa153cb1', // hacer deporte: A2 -> A1
  'a2-94113f9f': 'a1-94113f9f', // hacer ejercicio: A2 -> A1
  'b2-94113f9f': 'a1-94113f9f', // hacer ejercicio: B2 -> A1
  'b1-dc3c29a6': 'a1-ada4eb2a', // todavía (no): B1 -> A1
  'a2-127a0261': 'a1-127a0261', // hacer gimnasia: A2 -> A1
  'b2-127a0261': 'a1-127a0261', // hacer gimnasia: B2 -> A1
  'a1-6316b04a': 'a1-bf6e4067', // televisión (TV): A1 -> A1
  'b1-639c48ee': 'a1-639c48ee', // sobre: B1 -> A1
  'a2-60439c2e': 'a1-60439c2e', // quiosco: A2 -> A1
  'b1-eb786248': 'a1-941ccad0', // guión: B1 -> A1
  'a2-c44f7ac4': 'a1-f4c4ee6e', // punto: A2 -> A1
  'a2-ff70aa47': 'a1-c08f8437', // estudio: A2 -> A1
  'b2-53af8c2c': 'a1-ca4f31ae', // duro: B2 -> A1
  'a2-152b0c98': 'a1-152b0c98', // jardín: A2 -> A1
  'a2-6c6e13da': 'a1-6c6e13da', // cocina: A2 -> A1
  'b1-6c6e13da': 'a1-6c6e13da', // cocina: B1 -> A1
  'b2-9e7db28a': 'a1-9e7db28a', // salón: B2 -> A1
  'a2-976df5d6': 'a1-976df5d6', // ducha: A2 -> A1
  'a2-a61906a1': 'a1-a61906a1', // DVD: A2 -> A1
  'a1-c1048c64': 'a1-a4f56575', // tarjeta: A1 -> A1
  'a2-4f28f744': 'a1-4f28f744', // billete: A2 -> A1
  'b1-0735353d': 'a1-0735353d', // estar malo: B1 -> A1
  'b2-0735353d': 'a1-0735353d', // estar malo: B2 -> A1
  'a2-5e3a391a': 'a1-5e3a391a', // bañarse: A2 -> A1
  'b1-d7d88964': 'a1-d7d88964', // plano: B1 -> A1
  'b2-d7d88964': 'a1-d7d88964', // plano: B2 -> A1
  'a2-701e7d7e': 'a1-701e7d7e', // publicidad: A2 -> A1
  'a2-157a7200': 'a1-157a7200', // carretera: A2 -> A1
  'b1-24c11764': 'a1-4f47cb40', // entrevista: B1 -> A1
  'b1-98736edd': 'a1-98736edd', // aparcamiento: B1 -> A1
  'a2-5cfbb084': 'a1-5cfbb084', // presidente: A2 -> A1
  'a2-3282a9f5': 'a1-3282a9f5', // exposición: A2 -> A1
  'b2-3282a9f5': 'a1-3282a9f5', // exposición: B2 -> A1
  'b1-e65d16c3': 'a1-8602a05e', // pasillo: B1 -> A1
  'a2-affe4c6c': 'a1-affe4c6c', // edificio: A2 -> A1
  'a2-b4b82088': 'a1-b4b82088', // monumento: A2 -> A1
  'a2-6c351bdc': 'a1-6c351bdc', // catedral: A2 -> A1
  'a2-f163153f': 'a1-f163153f', // Iglesia: A2 -> A1
  'b1-1ce45b47': 'a1-1ce45b47', // cristiano: B1 -> A1
  'b2-fbb93bb9': 'a1-fbb93bb9', // sol: B2 -> A1
  'a2-a34acec5': 'a1-a34acec5', // centro comercial: A2 -> A1
  'a2-a1f9819c': 'a1-a1f9819c', // colegio: A2 -> A1
  'a2-2ce33323': 'a1-2ce33323', // barrio: A2 -> A1
  'a2-59c21812': 'a1-59c21812', // azúcar: A2 -> A1
  'b1-a30b3970': 'a1-a30b3970', // gracias: B1 -> A1
  'b2-e7d715d8': 'a1-72cd55ac', // hueso: B2 -> A1
  'b1-a12f41f5': 'a1-c25345c1', // buzón (de correos): B1 -> A1
  'a1-cdd20898': 'a1-6fcb40ad', // entrenar: A1 -> A1
  'b1-7ecfc34b': 'a2-7ecfc34b', // igual: B1 -> A2
  'b2-7ecfc34b': 'a2-7ecfc34b', // igual: B2 -> A2
  'b2-c3bc985f': 'a2-eafb9d5f', // (servicio de) seguridad: B2 -> A2
  'b2-8ad06853': 'a2-eafb9d5f', // seguridad (ciudadana): B2 -> A2
  'b1-cf732fea': 'a2-cf732fea', // estar sentado: B1 -> A2
  'b1-a4b3d4fc': 'a2-a4b3d4fc', // distancia: B1 -> A2
  'b2-5a537e20': 'a2-d515331b', // total: B2 -> A2
  'b1-82e86540': 'a2-564c63e9', // contar (la historia de): B1 -> A2
  'b1-3acd56d5': 'a2-d1df2f5f', // grupo (musical): B1 -> A2
  'b1-7f44657f': 'a2-7f44657f', // girar: B1 -> A2
  'b2-e55f1382': 'a2-7f44657f', // girar (un planeta): B2 -> A2
  'b1-91494565': 'a2-91494565', // hace un momento: B1 -> A2
  'b1-6a42348f': 'a2-e92fc4e2', // ya (no): B1 -> A2
  'b2-e92fc4e2': 'a2-e92fc4e2', // ya: B2 -> A2
  'b2-6e1e6776': 'a2-83097082', // espacio: B2 -> A2
  'b1-927c75cc': 'a2-927c75cc', // estación (del año): B1 -> A2
  'b2-fbff2020': 'a2-fbff2020', // toda la mañana: B2 -> A2
  'b2-feb62f38': 'a2-feb62f38', // todo el día: B2 -> A2
  'b1-80e7adc1': 'a2-80e7adc1', // cuadrado: B1 -> A2
  'a2-fa768f5e': 'a2-dfa5ab80', // caer(se): A2 -> A2
  'a2-56b62493': 'a2-6aadcb2f', // parar: A2 -> A2
  'b1-e6a04b67': 'a2-e6a04b67', // mayor: B1 -> A2
  'a2-4c1fb51a': 'a2-3712246f', // (des)orden: A2 -> A2
  'b1-a8f63ebb': 'a2-957fb763', // (el) primero: B1 -> A2
  'b1-d16c8b5e': 'a2-d16c8b5e', // útil: B1 -> A2
  'b2-ca066736': 'a2-24271fc5', // santo: B2 -> A2
  'b2-e0bea26f': 'a2-e0bea26f', // oído: B2 -> A2
  'b1-c722afa1': 'a2-c722afa1', // crecer: B1 -> A2
  'b2-c722afa1': 'a2-c722afa1', // crecer: B2 -> A2
  'b1-85d51065': 'a2-85d51065', // prefijo: B1 -> A2
  'b1-ec5a6ac0': 'a2-ec5a6ac0', // extensión: B1 -> A2
  'b2-ec5a6ac0': 'a2-ec5a6ac0', // extensión: B2 -> A2
  'b2-daa24f33': 'a2-b0aea6e6', // futuro: B2 -> A2
  'b1-6de7fbda': 'a2-1753d010', // socio: B1 -> A2
  'b2-4a5cb5ab': 'a2-bd9e7f16', // principio: B2 -> A2
  'b1-7c712919': 'a2-7c712919', // receta: B1 -> A2
  'b1-55ebd3c1': 'a2-a017d361', // línea (ocupada): B1 -> A2
  'a2-e7d92c1f': 'a2-1ba658f4', // programa: A2 -> A2
  'b1-e7d92c1f': 'a2-1ba658f4', // programa: B1 -> A2
  'b1-c1933634': 'a2-decfe095', // aprobar: B1 -> A2
  'b1-b6e60039': 'a2-5e9dd91b', // suspender: B1 -> A2
  'b1-64c2b8d9': 'a2-64c2b8d9', // historia: B1 -> A2
  'b1-47207a68': 'a2-47207a68', // derecho: B1 -> A2
  'b2-53405b4b': 'a2-47207a68', // (estar) derecho: B2 -> A2
  'b1-f9d0eba6': 'a2-f9d0eba6', // adivinar: B1 -> A2
  'b1-d4235bc0': 'a2-d4235bc0', // hoja: B1 -> A2
  'b2-00698e87': 'a2-00698e87', // regla: B2 -> A2
  'b1-3802bbe7': 'a2-3802bbe7', // funcionario: B1 -> A2
  'b1-f889e854': 'a2-a5ccc35c', // comercial: B1 -> A2
  'b1-d7e4635f': 'a2-d7e4635f', // Ropa de trabajo: B1 -> A2
  'b2-d7e4635f': 'a2-d7e4635f', // Ropa de trabajo: B2 -> A2
  'b2-c3c36d0e': 'a2-c3c36d0e', // quedar: B2 -> A2
  'b1-03bd8995': 'a2-03bd8995', // tomar una copa: B1 -> A2
  'a2-7f70a3ce': 'a2-fe0feb3c', // (un) musical: A2 -> A2
  'b1-55b16311': 'a2-55b16311', // montar en bicicleta: B1 -> A2
  'b1-5505b787': 'a2-5505b787', // hacer senderismo: B1 -> A2
  'b1-d22aed21': 'a2-d22aed21', // enviar: B1 -> A2
  'b1-8876f906': 'a2-8876f906', // dejar un mensaje: B1 -> A2
  'b2-e08ebf74': 'a2-91c7992b', // nota (musical): B2 -> A2
  'b1-a279db67': 'a2-68bb75d2', // virus: B1 -> A2
  'b1-3ed65aec': 'a2-3ed65aec', // propietario: B1 -> A2
  'b2-d714d845': 'a2-21f542d3', // victoria: B2 -> A2
  'b1-52b6f359': 'a2-52b6f359', // hacer la compra: B1 -> A2
  'b2-569b1c7e': 'a2-309a93d9', // especial: B2 -> A2
  'b2-76625061': 'a2-0a73baf2', // idea: B2 -> A2
  'a2-985b3b2d': 'a2-13c9bd54', // botas (de montaña): A2 -> A2
  'b1-13c9bd54': 'a2-13c9bd54', // botas: B1 -> A2
  'b1-a0ab4edf': 'a2-a0ab4edf', // pagar en efectivo: B1 -> A2
  'b1-f39ea4a8': 'a2-f39ea4a8', // urgencias: B1 -> A2
  'a2-238dcada': 'a2-43e092fb', // paciente: A2 -> A2
  'b1-5e8daa07': 'a2-5e8daa07', // montar en moto: B1 -> A2
  'b1-82e7c1fa': 'a2-ba743803', // cheque (de viaje): B1 -> A2
  'b1-e0300c7d': 'a2-ba743803', // cheque: B1 -> A2
  'b1-f9f011a5': 'a2-f9f011a5', // empleado: B1 -> A2
  'b1-99c93466': 'a2-99c93466', // cordero: B1 -> A2
  'b2-9811c01d': 'a2-c93e5c3c', // portátil: B2 -> A2
  'b1-1a907bfd': 'a2-359dd51a', // educación: B1 -> A2
  'b2-3c0071dc': 'a2-3c0071dc', // ejército: B2 -> A2
  'b1-5949d2e9': 'a2-5949d2e9', // cuento: B1 -> A2
  'a2-0d07f0eb': 'a2-fc3a47fb', // cámara: A2 -> A2
  'b2-37b3214f': 'a2-c918b647', // diario: B2 -> A2
  'b1-b54cfda8': 'a2-b54cfda8', // cielo: B1 -> A2
  'b1-cfa582c0': 'a2-cfa582c0', // interior: B1 -> A2
  'b2-af4d702a': 'a2-421558bc', // recordar: B2 -> A2
  'b2-29630133': 'a2-7f856203', // olvidar: B2 -> A2
  'b2-4900b120': 'a2-56cb77b8', // señal (de tráfico): B2 -> A2
  'b1-1babd673': 'b1-49a6d530', // aparecer: B1 -> B1
  'b1-ace9bd59': 'b1-b51c6310', // (in)material: B1 -> B1
  'b2-377dc534': 'b1-377dc534', // dividir: B2 -> B1
  'b1-a0492ea5': 'b1-94bd9970', // asegurar: B1 -> B1
  'b2-51bc100b': 'b1-29c9fbfd', // calentar: B2 -> B1
  'b1-01fea684': 'b1-28d9e3a7', // congelar(se): B1 -> B1
  'b1-2f137e76': 'b1-bd0f7746', // al principio: B1 -> B1
  'b2-3ce95f31': 'b1-d52d75e1', // a continuación (de): B2 -> B1
  'b2-1e29c190': 'b1-1e29c190', // aniversario: B2 -> B1
  'b2-04dcaa43': 'b1-04dcaa43', // día festivo: B2 -> B1
  'b2-bdb8cb52': 'b1-bdb8cb52', // día laborable: B2 -> B1
  'b2-88b7ff90': 'b1-88b7ff90', // presente: B2 -> B1
  'b2-96c982a7': 'b1-d8890d8d', // (el) anterior: B2 -> B1
  'b2-61967e4c': 'b1-61967e4c', // montar un negocio: B2 -> B1
  'b2-c6fa106c': 'b1-a80b3ee8', // cercano (a): B2 -> B1
  'b2-5190b193': 'b1-1e07b9ee', // (estar) recto: B2 -> B1
  'b2-2ef63117': 'b1-2ef63117', // aluminio: B2 -> B1
  'b1-70b1b0c1': 'b1-6079e6cf', // organización: B1 -> B1
  'b2-ca2961bc': 'b1-ca2961bc', // dar igual: B2 -> B1
  'b2-086720f7': 'b1-086720f7', // expresión: B2 -> B1
  'b2-18f79971': 'b1-18f79971', // redacción: B2 -> B1
  'b2-468e31e0': 'b1-468e31e0', // callado: B2 -> B1
  'b2-ce2dcbde': 'b1-ce2dcbde', // postura: B2 -> B1
  'b2-afec8d9e': 'b1-afec8d9e', // estar deprimido: B2 -> B1
  'b2-a8bac81b': 'b1-a8bac81b', // cansarse: B2 -> B1
  'b2-2307a1ca': 'b1-2307a1ca', // recién nacido: B2 -> B1
  'b2-a2c88df8': 'b1-a2c88df8', // anciano: B2 -> B1
  'b2-0f65a52e': 'b1-0f65a52e', // separación: B2 -> B1
  'b2-66fae76b': 'b1-ca59ff32', // insistir (en): B2 -> B1
  'b2-c0f4eb09': 'b1-c0f4eb09', // fiesta de disfraces: B2 -> B1
  'b2-493fe980': 'b1-493fe980', // producto natural: B2 -> B1
  'b2-9b7f2330': 'b1-0e3d5738', // sabor (des)agradable: B2 -> B1
  'b2-5c462734': 'b1-5c462734', // soso: B2 -> B1
  'b2-dc1320de': 'b1-2b51c979', // (número de) matrícula: B2 -> B1
  'b2-7d8414fd': 'b1-7d8414fd', // equivocarse: B2 -> B1
  'b2-61d54209': 'b1-61d54209', // hacer una presentación: B2 -> B1
  'b2-d961e8aa': 'b1-d961e8aa', // demanda: B2 -> B1
  'b2-de64699e': 'b1-93f009cf', // firmar un contrato (de alquiler): B2 -> B1
  'b2-f85a02d4': 'b1-f85a02d4', // poner una película: B2 -> B1
  'b2-c248c235': 'b1-c248c235', // comentario: B2 -> B1
  'b2-9a34b25e': 'b1-f76d1e3d', // informar(se): B2 -> B1
  'b2-f76d1e3d': 'b1-f76d1e3d', // informar: B2 -> B1
  'b1-5d801ef4': 'b1-ede5c5f0', // comunicarse con alguien por correo: B1 -> B1
  'b1-34af5447': 'b1-36e96341', // justo: B1 -> B1
  'b1-3cde4d27': 'b1-f125a436', // economía: B1 -> B1
  'b2-26fee417': 'b1-26fee417', // debate: B2 -> B1
  'b2-e7c93042': 'b1-e7c93042', // florero: B2 -> B1
  'b2-8a28a9f0': 'b1-8a28a9f0', // salida de emergencia: B2 -> B1
  'b2-f2b946b7': 'b1-f2b946b7', // garantía: B2 -> B1
  'b2-4ef4b2bc': 'b1-4ef4b2bc', // estar de oferta: B2 -> B1
  'b2-90e3eee8': 'b1-90e3eee8', // tener garantía: B2 -> B1
  'b2-205bf8ca': 'b1-205bf8ca', // estar caducado: B2 -> B1
  'b2-0c94594c': 'b1-0c94594c', // ponerse malo: B2 -> B1
  'b2-d03542b9': 'b1-d03542b9', // estar de baja: B2 -> B1
  'b2-1c183ff2': 'b1-1c183ff2', // dar(se) un golpe: B2 -> B1
  'b2-27a13d0a': 'b1-27a13d0a', // estar agotado: B2 -> B1
  'b2-fdc75ba3': 'b1-fdc75ba3', // termómetro: B2 -> B1
  'b2-6287b8d8': 'b1-6287b8d8', // hacer un crucero: B2 -> B1
  'b2-647a698a': 'b1-647a698a', // conserje: B2 -> B1
  'b2-37caec07': 'b1-37caec07', // vía: B2 -> B1
  'b2-47a5d765': 'b1-47a5d765', // fila: B2 -> B1
  'b2-4b49a06d': 'b1-4b49a06d', // hacer escala: B2 -> B1
  'b2-5d8e4b67': 'b1-5d8e4b67', // policía de tráfico: B2 -> B1
  'b2-0d3e9377': 'b1-0d3e9377', // hipoteca: B2 -> B1
  'b2-592bd52a': 'b1-592bd52a', // comercio: B2 -> B1
  'b2-63746892': 'b1-63746892', // producción: B2 -> B1
  'b2-3098cc7e': 'b1-3098cc7e', // construcción: B2 -> B1
  'b2-a28af733': 'b1-f5c44c2b', // materia (prima): B2 -> B1
  'b2-325f0c41': 'b1-325f0c41', // físico: B2 -> B1
  'b2-73672bba': 'b1-73672bba', // químico: B2 -> B1
  'b2-bf4d96d5': 'b1-bf4d96d5', // historiador: B2 -> B1
  'b1-2d2f971f': 'b1-2d3e9a4b', // ciudadano(s): B1 -> B1
  'b2-87008906': 'b1-58b01ddb', // comunidad (de vecinos): B2 -> B1
  'b2-34fe5d0a': 'b1-34fe5d0a', // Historia Contemporánea: B2 -> B1
  'b2-430a9940': 'b1-430a9940', // congreso: B2 -> B1
  'b2-afa13919': 'b1-afa13919', // ley: B2 -> B1
  'b2-dfe2db74': 'b1-dfe2db74', // general: B2 -> B1
  'b2-da5f51a1': 'b1-da5f51a1', // universal: B2 -> B1
  'b2-75a31fd0': 'b1-75a31fd0', // vista: B2 -> B1
  'b2-888b4cb3': 'b1-888b4cb3', // huerta: B2 -> B1
  'b2-60dd3ee8': 'b1-60dd3ee8', // parque natural: B2 -> B1
  'b2-fd002ada': 'b1-fd002ada', // raíz: B2 -> B1
  'b2-ad5ce72c': 'b1-ad5ce72c', // contenedor de papel: B2 -> B1
  'b2-e4cf1d0f': 'b1-e4cf1d0f', // contenedor de vidrio: B2 -> B1
  'b2-fd67333b': 'b1-fd67333b', // recursos naturales: B2 -> B1
  'b1-bd7f4e2e': 'b1-ae7cb2ac', // (des)empleo: B1 -> B1
  'b2-a413d2d8': 'b2-ba600bf7', // helar: B2 -> B2
  'b2-b5daf6eb': 'b2-ee75ed6c', // (des)colocado: B2 -> B2
  'b2-df08f5d4': 'b2-bb7a52f8', // doblado: B2 -> B2
  'b2-49520d21': 'b2-41dc1eb4', // lejano: B2 -> B2
  'b2-13da3ced': 'b2-97b19f7b', // alejado: B2 -> B2
  'b2-545f67ac': 'b2-664f2086', // aislado: B2 -> B2
  'b2-6c739193': 'b2-9650f06d', // por delante: B2 -> B2
  'b2-c4ac90c0': 'b2-ea118c13', // por detrás: B2 -> B2
  'b2-20df41c0': 'b2-398ec7a8', // por el principio: B2 -> B2
  'b2-44fe0602': 'b2-5333d3fd', // por el final: B2 -> B2
  'b2-ca1d15cd': 'b2-7d4024a5', // por arriba: B2 -> B2
  'b2-047c851c': 'b2-c170d049', // por abajo: B2 -> B2
  'b2-82766bc8': 'b2-54568480', // estabilidad: B2 -> B2
  'b2-53ebbdc0': 'b2-cce9aae3', // estar (pasado) de moda: B2 -> B2
  'b2-b9e1a24c': 'b2-64cc155f', // aún: B2 -> B2
  'b2-912d12ed': 'b2-da3b4c76', // (im)puntualidad: B2 -> B2
  'b2-d0ea5642': 'b2-7fac8c08', // ángulo (recto): B2 -> B2
  'b2-c5295542': 'b2-a0979246', // invertir (en): B2 -> B2
  'b2-81c31c85': 'b2-876c09dc', // tener facilidad(es) para: B2 -> B2
  'b2-26dec75c': 'b2-41cfb9d0', // tener facilidad(es) con: B2 -> B2
  'b2-681d2ea1': 'b2-6c387e68', // reflexionar: B2 -> B2
  'b2-369ddfed': 'b2-9644293a', // discreto: B2 -> B2
  'b2-aee493f3': 'b2-afcb740d', // sensibilidad: B2 -> B2
  'b2-c7f560ae': 'b2-0e4b2b12', // redactor: B2 -> B2
  'b2-e2b8a3b4': 'b2-94575acf', // hacer una transferencia: B2 -> B2
  'b2-7194d174': 'b2-ea5871f7', // pinchar: B2 -> B2
  'b2-f29d692d': 'b2-cad89b0b', // fórmula (matemática): B2 -> B2
};
