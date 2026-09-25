# PCIC szint-igazítás (PLAN-fb0924 7a. lépés, FB396, D3)

Generálva: node scripts/pcic-level-fit.mjs --write

Szabály: egy PCIC `word` tétel új szintje = min(PCIC-szint, a szó szintje az app saját, gyakoriság-alapú szókorpuszában `data/words/a0.json..b1.json`), A0 -> A1 padlóval, csak lefelé mozog. A normalizálás kisbetűs, zárójel nélküli, szótári névelő nélküli, "/" mentén szétbontott alakokat vet össze.

**Összesen mozgatva: 751. Kihagyva (célszinten már van azonos szó, 7b dolga): 101.**
Törölt `headword` hivatkozás: 132 (a hivatkozott szó másik szintre került; a mező futásidőben nem használt, data/pcic.ts nem másolja PcicItem-be, ezért törlés a helyes lépés, nem átírás - pcic-check.mjs a headwordöt szinten belül ellenőrzi).

## Mozgatva

| régi id | es | régi szint → új szint | korpusz-forrás szint |
|---|---|---|---|
| `a2-0120d4c0` → `a1-61f0b4f7` | garganta | A2 → A1 | A1 |
| `a2-026b6a67` → `a1-25d2e1ae` | araña | A2 → A1 | A1 |
| `a2-03d09fa5` → `a1-8a93ada2` | abrigo | A2 → A1 | A1 |
| `a2-06cb36d4` → `a1-815e65e5` | presentar(se) | A2 → A1 | A1 |
| `a2-0b950c55` → `a1-3d61f0ce` | ancho | A2 → A1 | A1 |
| `a2-0bc2569d` → `a1-e97416d6` | artista | A2 → A1 | A1 |
| `a2-0bcfdca8` → `a1-46e12f1b` | morir | A2 → A1 | A0 |
| `a2-11f56b41` → `a1-8b0212fe` | plátano | A2 → A1 | A1 |
| `a2-13f20098` → `a1-34c1a2ee` | tomate | A2 → A1 | A1 |
| `a2-14fdf15f` → `a1-4dfc27c1` | llevar | A2 → A1 | A1 |
| `a2-1583579c` → `a1-3c37bbc5` | impresora | A2 → A1 | A1 |
| `a2-1673a3e2` → `a1-50338aef` | atún | A2 → A1 | A1 |
| `a2-16cc0464` → `a1-316a2120` | microondas | A2 → A1 | A1 |
| `a2-1824d6bc` → `a1-7da0ef23` | piel | A2 → A1 | A1 |
| `a2-19a07f4d` → `a1-2aae8185` | músico | A2 → A1 | A1 |
| `a2-19f10e40` → `a1-d9d6d82e` | pobre | A2 → A1 | A1 |
| `a2-1a43ea05` → `a1-b758d015` | niebla | A2 → A1 | A1 |
| `a2-1d087007` → `a1-dea77ad5` | toalla | A2 → A1 | A1 |
| `a2-1de0bf78` → `a1-68ea6a5d` | afeitarse | A2 → A1 | A1 |
| `a2-1fe3afaf` → `a1-35156ef9` | gimnasio | A2 → A1 | A1 |
| `a2-20e72262` → `a1-014e6ff5` | cuadro | A2 → A1 | A1 |
| `a2-24c11764` → `a1-4f47cb40` | entrevista | A2 → A1 | A1 |
| `a2-2a28caae` → `a1-b1ed7e82` | quitarse | A2 → A1 | A1 |
| `a2-2affaef5` → `a1-90bd1fa9` | rico | A2 → A1 | A1 |
| `a2-2f0ea218` → `a1-123176eb` | desierto | A2 → A1 | A1 |
| `a2-33ee7796` → `a1-5f6784c9` | periodista | A2 → A1 | A1 |
| `a2-36323e54` → `a1-b21e4f4f` | ponerse | A2 → A1 | A1 |
| `a2-388db047` → `a1-56b3c400` | arquitecto | A2 → A1 | A1 |
| `a2-3b327361` → `a1-c5a26e11` | pierna | A2 → A1 | A1 |
| `a2-3cd526fd` → `a1-45633ea7` | redondo | A2 → A1 | A1 |
| `a2-3e0b9f96` → `a1-e1b61b36` | visitar | A2 → A1 | A1 |
| `a2-4436a76d` → `a1-632b543e` | guitarra | A2 → A1 | A1 |
| `a2-446106f2` → `a1-9e9dab5a` | doler | A2 → A1 | A1 |
| `a2-44f7a54b` → `a1-96e9d2f7` | hacer | A2 → A1 | A0 |
| `a2-455c1186` → `a1-94c05a76` | piloto | A2 → A1 | A1 |
| `a2-46139b0b` → `a1-e734f7ca` | pasta | A2 → A1 | A1 |
| `a2-46c89ef7` → `a1-a44098e0` | tormenta | A2 → A1 | A1 |
| `a2-4a210e76` → `a1-190ac84f` | aperitivo | A2 → A1 | A1 |
| `a2-4bf35f37` → `a1-9c520587` | costa | A2 → A1 | A1 |
| `a2-4d51521f` → `a1-81ad7342` | lavadora | A2 → A1 | A1 |
| `a2-4eb06ea5` → `a1-069a1256` | espalda | A2 → A1 | A1 |
| `a2-54df8ee3` → `a1-212befaa` | bañador | A2 → A1 | A1 |
| `a2-5730b67a` → `a1-b9cffaa6` | zanahoria | A2 → A1 | A1 |
| `a2-582646ce` → `a1-dcedbb95` | lavaplatos | A2 → A1 | A1 |
| `a2-591646a6` → `a1-c5411812` | violín | A2 → A1 | A1 |
| `a2-5956a2b2` → `a1-0bdf905a` | mundo | A2 → A1 | A0 |
| `a2-5a64faf7` → `a1-6abf00cc` | Medicina | A2 → A1 | A1 |
| `a2-5b45e85c` → `a1-fac69828` | paraguas | A2 → A1 | A1 |
| `a2-5bb308ac` → `a1-c99b38d7` | bebé | A2 → A1 | A1 |
| `a2-5bfddc0e` → `a1-ed6ed808` | yogur | A2 → A1 | A1 |
| `a2-5c07d1e4` → `a1-ff7738de` | piano | A2 → A1 | A1 |
| `a2-5d036cc6` → `a1-0b4339be` | mecánico | A2 → A1 | A1 |
| `a2-5efc86ca` → `a1-0cd24184` | rosa | A2 → A1 | A1 |
| `a2-5f775e20` → `a1-030ff0b9` | servilleta | A2 → A1 | A1 |
| `a2-60e11db3` → `a1-f7266e78` | acostarse | A2 → A1 | A1 |
| `a2-6139bdc2` → `a1-e0a05cb8` | perro | A2 → A1 | A1 |
| `a2-62b912d0` → `a1-5d728ed0` | caballo | A2 → A1 | A1 |
| `a2-63604515` → `a1-c68429a4` | devolver | A2 → A1 | A1 |
| `a2-63b963ad` → `a1-6933dd26` | ajo | A2 → A1 | A1 |
| `a2-641ea71f` → `a1-abd32814` | bosque | A2 → A1 | A1 |
| `a2-6abb8e64` → `a1-bbc1c659` | talla | A2 → A1 | A1 |
| `a2-6cc76bdd` → `a1-ade46dd4` | manzana | A2 → A1 | A1 |
| `a2-6dd0fe80` → `a1-1d1fe5dc` | color | A2 → A1 | A1 |
| `a2-6efb2f76` → `a1-48d4cd11` | pintar | A2 → A1 | A1 |
| `a2-719e9ce2` → `a1-9d57eb35` | tranquilo | A2 → A1 | A1 |
| `a2-7af0f1c6` → `a1-e8d19826` | fuerte | A2 → A1 | A0 |
| `a2-81919f80` → `a1-47fe531a` | nevera | A2 → A1 | A1 |
| `a2-81a0de18` → `a1-0a0fda53` | panadero | A2 → A1 | A1 |
| `a2-827c7065` → `a1-b709bc1e` | lechuga | A2 → A1 | A1 |
| `a2-82e3d621` → `a1-a5d5a55e` | carnicero | A2 → A1 | A1 |
| `a2-83a51b1c` → `a1-ca50ee69` | mantequilla | A2 → A1 | A1 |
| `a2-8470d358` → `a1-a510e8eb` | aburrido | A2 → A1 | A1 |
| `a2-851c2e6d` → `a1-34f76036` | caminar | A2 → A1 | A1 |
| `a2-866d5ebc` → `a1-db0794a9` | cebolla | A2 → A1 | A1 |
| `a2-86bf22a8` → `a1-99ac74cc` | novela | A2 → A1 | A1 |
| `a2-8830c20d` → `a1-358b4e77` | cocinero | A2 → A1 | A1 |
| `a2-891c5fee` → `a1-f03fb6a7` | chocolate | A2 → A1 | A1 |
| `a2-8b9b43e9` → `a1-fea5414d` | dedo | A2 → A1 | A1 |
| `a2-8c1a851e` → `a1-7aecab2e` | bufanda | A2 → A1 | A1 |
| `a2-8e5550d4` → `a1-2fa0f1d1` | decir | A2 → A1 | A0 |
| `a2-8e5fc65e` → `a1-d7ed0c3f` | queso | A2 → A1 | A1 |
| `a2-8f39c63d` → `a1-bd9160d3` | gato | A2 → A1 | A1 |
| `a2-92924574` → `a1-b2b59405` | estómago | A2 → A1 | A1 |
| `a2-9398c1c2` → `a1-19a55654` | dibujo | A2 → A1 | A1 |
| `a2-93cf094f` → `a1-3e178482` | cambio | A2 → A1 | A1 |
| `a2-945ba919` → `a1-a97eb6df` | techo | A2 → A1 | A1 |
| `a2-95c08757` → `a1-3e4fa0ef` | cara | A2 → A1 | A1 |
| `a2-96ad9f82` → `a1-f9b8fd82` | pimienta | A2 → A1 | A1 |
| `a2-98d58c0a` → `a1-b4fb38ca` | ambulancia | A2 → A1 | A1 |
| `a2-9a6028b4` → `a1-e317a0f7` | vaso | A2 → A1 | A1 |
| `a2-9ae25fca` → `a1-4346dad8` | limpiar | A2 → A1 | A1 |
| `a2-9bca387a` → `a1-ee134e7f` | reservar | A2 → A1 | A1 |
| `a2-9d243af8` → `a1-742d356c` | nervioso | A2 → A1 | A1 |
| `a2-9e7abfb6` → `a1-1e4f82d0` | sombrero | A2 → A1 | A1 |
| `a2-a02f4c78` → `a1-5994a67f` | mochila | A2 → A1 | A1 |
| `a2-a2242f0e` → `a1-03b4cbc6` | suelo | A2 → A1 | A1 |
| `a2-a3fcfe3a` → `a1-fcab251a` | nada | A2 → A1 | A0 |
| `a2-abf1aa4a` → `a1-7ac58255` | mano | A2 → A1 | A0 |
| `a2-b11c02e7` → `a1-22d9417f` | necesitar | A2 → A1 | A0 |
| `a2-b16f5946` → `a1-0801e0eb` | lluvia | A2 → A1 | A1 |
| `a2-b1825946` → `a1-28ef7a90` | limpio | A2 → A1 | A1 |
| `a2-b1b3592d` → `a1-a5cd9d69` | poder | A2 → A1 | A0 |
| `a2-b3fb18df` → `a1-e8d119ab` | pasear | A2 → A1 | A1 |
| `a2-b4c8a8fe` → `a1-f8ea2d84` | pez | A2 → A1 | A1 |
| `a2-b70d2de7` → `a1-43045d57` | mirar | A2 → A1 | A1 |
| `a2-b817e909` → `a1-a3756d32` | champú | A2 → A1 | A1 |
| `a2-b8ca3c1f` → `a1-2cc2117f` | Ayuntamiento | A2 → A1 | A1 |
| `a2-ba03ef3e` → `a1-01df1a72` | cabeza | A2 → A1 | A0 |
| `a2-ba476f1a` → `a1-1637f2cf` | detrás | A2 → A1 | A1 |
| `a2-bb2e73ca` → `a1-67cd89a7` | gustar | A2 → A1 | A0 |
| `a2-bcd2bfb9` → `a1-1cd26c17` | abierto | A2 → A1 | A1 |
| `a2-bd17811d` → `a1-a8be1b78` | antiguo | A2 → A1 | A1 |
| `a2-bd6b2a27` → `a1-1c22a0a7` | excursión | A2 → A1 | A1 |
| `a2-be949382` → `a1-fc4a648f` | patata | A2 → A1 | A1 |
| `a2-c09f7a54` → `a1-14527318` | aceite | A2 → A1 | A1 |
| `a2-c0b3f2cd` → `a1-1ce1d746` | vaca | A2 → A1 | A1 |
| `a2-c307b635` → `a1-c68037f0` | luz | A2 → A1 | A1 |
| `a2-c434e7d5` → `a1-add39126` | científico | A2 → A1 | A1 |
| `a2-c4cc3529` → `a1-68d3e031` | estrecho | A2 → A1 | A1 |
| `a2-c522d41a` → `a1-9e3ba066` | cerdo | A2 → A1 | A1 |
| `a2-c8cc05a1` → `a1-9376b5cc` | nieve | A2 → A1 | A1 |
| `a2-c9b73ec5` → `a1-9e1c6187` | tapa | A2 → A1 | A1 |
| `a2-c9e8e5e2` → `a1-7f3732e0` | calcetines | A2 → A1 | A1 |
| `a2-caf8dae1` → `a1-5abbec36` | sal | A2 → A1 | A1 |
| `a2-ce49d44f` → `a1-0f19b527` | ruido | A2 → A1 | A1 |
| `a2-ce9bd87a` → `a1-ece4eb02` | pared | A2 → A1 | A1 |
| `a2-cf857be6` → `a1-9d3d3425` | sentarse | A2 → A1 | A1 |
| `a2-d235851b` → `a1-1b6e2481` | escritor | A2 → A1 | A1 |
| `a2-d2f68f12` → `a1-894bb48c` | brazo | A2 → A1 | A1 |
| `a2-d4a4de4f` → `a1-d6bc9169` | plato | A2 → A1 | A1 |
| `a2-d632138a` → `a1-12f46ad6` | cocinar | A2 → A1 | A1 |
| `a2-d87a9b68` → `a1-7ffeba2b` | piscina | A2 → A1 | A1 |
| `a2-d94019fd` → `a1-bd609edc` | cliente | A2 → A1 | A1 |
| `a2-da8425c4` → `a1-8693c8ba` | importante | A2 → A1 | A0 |
| `a2-dab7ac36` → `a1-9abb82ff` | pájaro | A2 → A1 | A1 |
| `a2-db18b047` → `a1-a98d9f9d` | sucio | A2 → A1 | A1 |
| `a2-dcba4edc` → `a1-61a60aca` | pijama | A2 → A1 | A1 |
| `a2-dd42ef0e` → `a1-48765024` | delante | A2 → A1 | A1 |
| `a2-e033aff4` → `a1-9fc14a67` | amable | A2 → A1 | A1 |
| `a2-e65d16c3` → `a1-8602a05e` | pasillo | A2 → A1 | A1 |
| `a2-e99a94e0` → `a1-24db525f` | traer | A2 → A1 | A1 |
| `a2-ee13e9f7` → `a1-15a47314` | peinarse | A2 → A1 | A1 |
| `a2-f1f1147f` → `a1-871b4d75` | moneda | A2 → A1 | A1 |
| `a2-f2b09da9` → `a1-febce3ef` | taza | A2 → A1 | A1 |
| `a2-f5ee40a8` → `a1-b17cf0cf` | dibujar | A2 → A1 | A1 |
| `a2-f63797cf` → `a1-dc822faa` | lavarse | A2 → A1 | A1 |
| `a2-fa9db510` → `a1-871984f9` | arroz | A2 → A1 | A1 |
| `a2-fc922d21` → `a1-65f15fb9` | corbata | A2 → A1 | A1 |
| `a2-fe9cb8f1` → `a1-abbc263b` | pintor | A2 → A1 | A1 |
| `a2-ff1d1179` → `a1-13b3bd1e` | jugar | A2 → A1 | A1 |
| `b1-00358ad2` → `a1-e5dc5655` | (des)ordenar | B1 → A1 | A1 |
| `b1-00787666` → `a2-9de2f9b1` | palabra | B1 → A2 | A2 |
| `b1-0337adf9` → `a2-958229c8` | perdido | B1 → A2 | A2 |
| `b1-069cf24c` → `a2-6973b866` | laboratorio | B1 → A2 | A2 |
| `b1-06c4ddd5` → `a1-3cc72781` | cinturón | B1 → A1 | A1 |
| `b1-080def27` → `a2-0e6a8914` | desastre | B1 → A2 | A2 |
| `b1-093f4e63` → `a1-7a5e88d9` | pasar | B1 → A1 | A1 |
| `b1-0b2d106d` → `a1-3a54cef2` | espejo | B1 → A1 | A1 |
| `b1-0b38ae75` → `a2-7ad19951` | salida | B1 → A2 | A2 |
| `b1-0b8bc0c4` → `a1-ebf94480` | lado | B1 → A1 | A1 |
| `b1-0cb9e93d` → `a1-6cd12a56` | temperatura | B1 → A1 | A1 |
| `b1-0e6ab81c` → `a2-308859a8` | necesidad | B1 → A2 | A2 |
| `b1-0f7d0d08` → `a2-d94c5c4c` | simple | B1 → A2 | A2 |
| `b1-10c12ec8` → `a2-fb1160a0` | ocupado | B1 → A2 | A2 |
| `b1-1149d092` → `a1-3cf20991` | equipaje | B1 → A1 | A1 |
| `b1-11977b10` → `a1-cc04dcdc` | encontrar | B1 → A1 | A0 |
| `b1-11e60b0e` → `a1-445010c5` | natural | B1 → A1 | A1 |
| `b1-11e6ab9f` → `a2-15265e18` | luego | B1 → A2 | A2 |
| `b1-11f9578d` → `a1-66c0fda0` | error | B1 → A1 | A1 |
| `b1-120b5916` → `a2-ae274fc4` | ayudar | B1 → A2 | A2 |
| `b1-15725a66` → `a2-4e747478` | comprender | B1 → A2 | A2 |
| `b1-15ce05ec` → `a1-7cdfe51c` | manta | B1 → A1 | A1 |
| `b1-1707e920` → `a2-8a1725f1` | militar | B1 → A2 | A2 |
| `b1-18cbff75` → `a1-333e233e` | mantel | B1 → A1 | A1 |
| `b1-18d44db7` → `a2-b6b61483` | soldado | B1 → A2 | A2 |
| `b1-18d65cde` → `a1-a56cf7b8` | helicóptero | B1 → A1 | A1 |
| `b1-1a823e72` → `a2-fa768f5e` | caer(se) | B1 → A2 | A2 |
| `b1-1c580fe5` → `a2-cb043dcd` | acabar | B1 → A2 | A2 |
| `b1-1d8452f4` → `a1-8895d079` | pecho | B1 → A1 | A1 |
| `b1-1e7a0267` → `a1-6a47a30d` | origen | B1 → A1 | A1 |
| `b1-1f016007` → `a2-ccebc246` | doctor | B1 → A2 | A2 |
| `b1-1f19332c` → `a1-75ac7d03` | secar(se) | B1 → A1 | A1 |
| `b1-1f53341f` → `a2-17d1cda1` | escapar(se) | B1 → A2 | A2 |
| `b1-1f7f1c7a` → `a1-2e98b98e` | moto | B1 → A1 | A1 |
| `b1-203addd5` → `a1-75069f68` | picante | B1 → A1 | A1 |
| `b1-207965ec` → `a1-331b9782` | análisis | B1 → A1 | A1 |
| `b1-21a15ef2` → `a1-b3e6d752` | gazpacho | B1 → A1 | A1 |
| `b1-22015a1b` → `a1-63b6985f` | alfombra | B1 → A1 | A1 |
| `b1-22b35e66` → `a1-c25345c1` | buzón | B1 → A1 | A1 |
| `b1-23887e36` → `a2-d6c71307` | comenzar | B1 → A2 | A2 |
| `b1-249c841b` → `a1-b65ce6d1` | codo | B1 → A1 | A1 |
| `b1-24fe072e` → `a2-2786a212` | universo | B1 → A2 | A2 |
| `b1-25d9cc8c` → `a2-608dcd2d` | escenario | B1 → A2 | A2 |
| `b1-26a75351` → `a2-cb66d324` | estupendo | B1 → A2 | A2 |
| `b1-27f0b2a7` → `a1-516f1de1` | videojuego | B1 → A1 | A1 |
| `b1-29630133` → `a2-7f856203` | olvidar | B1 → A2 | A2 |
| `b1-29e35acc` → `a1-1da74cce` | dulce | B1 → A1 | A1 |
| `b1-2ad43eea` → `a2-f7aaadab` | robo | B1 → A2 | A2 |
| `b1-2aeede80` → `a2-5d3d31c5` | control | B1 → A2 | A2 |
| `b1-2d83f9e5` → `a1-cebb2657` | ratón | B1 → A1 | A1 |
| `b1-2e146f63` → `a2-957fb763` | primero | B1 → A2 | A2 |
| `b1-2f1076fb` → `a2-d5341c5a` | cuidar | B1 → A2 | A2 |
| `b1-303ef781` → `a1-0465e225` | camión | B1 → A1 | A1 |
| `b1-31bc3e42` → `a2-1ed23ad1` | espectáculo | B1 → A2 | A2 |
| `b1-321555f1` → `a2-ef4a0a42` | dueño | B1 → A2 | A2 |
| `b1-3390f4da` → `a1-b03daa70` | planchar | B1 → A1 | A1 |
| `b1-3470724a` → `a1-6e1d89e4` | tenedor | B1 → A1 | A1 |
| `b1-3498034b` → `a1-b181cf23` | noticia | B1 → A1 | A1 |
| `b1-3772957d` → `a1-95786eda` | saltar | B1 → A1 | A1 |
| `b1-37b3214f` → `a2-c918b647` | diario | B1 → A2 | A2 |
| `b1-39b97647` → `a1-11ddeeda` | ayuda | B1 → A1 | A0 |
| `b1-3c8654a3` → `a2-f7727fe0` | solamente | B1 → A2 | A2 |
| `b1-3cdb5693` → `a1-cd44cdfa` | llegada | B1 → A1 | A1 |
| `b1-3d355f39` → `a1-0abf1fe3` | serpiente | B1 → A1 | A1 |
| `b1-3d5e46e1` → `a1-f832b56a` | basura | B1 → A1 | A1 |
| `b1-3eee384d` → `a2-293e9ab5` | explicar | B1 → A2 | A2 |
| `b1-3fb16a76` → `a2-6aadcb2f` | parar(se) | B1 → A2 | A2 |
| `b1-41284f91` → `a1-062ab8ec` | cartero | B1 → A1 | A1 |
| `b1-41745109` → `a1-dec7b7a8` | usar | B1 → A1 | A1 |
| `b1-41b82a96` → `a1-5cdbdd2f` | barrer | B1 → A1 | A1 |
| `b1-42df54f3` → `a2-cb0817b4` | deprisa | B1 → A2 | A2 |
| `b1-42f51a59` → `a2-564c63e9` | contar | B1 → A2 | A2 |
| `b1-430732c2` → `a2-71887137` | aceptar | B1 → A2 | A2 |
| `b1-43cb48d6` → `a1-99e5e8f0` | hielo | B1 → A1 | A1 |
| `b1-45099a2a` → `a2-61a4301f` | vuelta | B1 → A2 | A2 |
| `b1-459b3b15` → `a1-2d577932` | parada | B1 → A1 | A1 |
| `b1-46404fd5` → `a1-9bfda88c` | lleno | B1 → A1 | A1 |
| `b1-47a3d3f1` → `a1-4651d7c5` | granizo | B1 → A1 | A1 |
| `b1-48102d35` → `a1-8939b408` | calabacín | B1 → A1 | A1 |
| `b1-48ad01da` → `a1-6883c631` | piña | B1 → A1 | A1 |
| `b1-490276ca` → `a1-7fb31aff` | contrato | B1 → A1 | A1 |
| `b1-497cc59c` → `a2-aa9a98fb` | boda | B1 → A2 | A2 |
| `b1-49f25741` → `a1-106ff312` | solo | B1 → A1 | A0 |
| `b1-4a5cb5ab` → `a2-bd9e7f16` | principio | B1 → A2 | A2 |
| `b1-4bdbea91` → `a1-af5644e5` | visado | B1 → A1 | A1 |
| `b1-4c2b2db0` → `a1-f59f5f02` | camino | B1 → A1 | A1 |
| `b1-4d7d5fa7` → `a2-44d028a6` | fantástico | B1 → A2 | A2 |
| `b1-4d9727e7` → `a2-43e092fb` | (im)paciente | B1 → A2 | A2 |
| `b1-4e68e95b` → `a1-dadd6eac` | lago | B1 → A1 | A1 |
| `b1-5106325b` → `a1-9f0f88ca` | autopista | B1 → A1 | A1 |
| `b1-51390396` → `a1-c208d601` | conejo | B1 → A1 | A1 |
| `b1-52b96724` → `a1-71c6bea6` | tobillo | B1 → A1 | A1 |
| `b1-52efcb6c` → `a2-72d905b8` | alcohol | B1 → A2 | A2 |
| `b1-53af8c2c` → `a1-ca4f31ae` | duro | B1 → A1 | A1 |
| `b1-54126538` → `a2-d917a8a0` | compañía | B1 → A2 | A2 |
| `b1-5480e9c0` → `a1-9c6e0aa3` | elefante | B1 → A1 | A1 |
| `b1-54f131df` → `a1-930c4f3e` | león | B1 → A1 | A1 |
| `b1-569b1c7e` → `a2-309a93d9` | especial | B1 → A2 | A2 |
| `b1-56ec734b` → `a2-dfe33fb0` | ganar | B1 → A2 | A2 |
| `b1-57a27a29` → `a2-900c1ba5` | público | B1 → A2 | A2 |
| `b1-5a537e20` → `a2-d515331b` | total | B1 → A2 | A2 |
| `b1-5b462bab` → `a2-933fdc79` | entrenador | B1 → A2 | A2 |
| `b1-5dc592f5` → `a2-a7b263e1` | existir | B1 → A2 | A2 |
| `b1-5ff5c512` → `a1-05783293` | equipo | B1 → A1 | A1 |
| `b1-60645847` → `a2-7a95a748` | raro | B1 → A2 | A2 |
| `b1-612063a1` → `a1-b1f63130` | asiento | B1 → A1 | A1 |
| `b1-612a3698` → `a2-d1df2f5f` | grupo | B1 → A2 | A2 |
| `b1-659799a2` → `a1-10dc8d3c` | vinagre | B1 → A1 | A1 |
| `b1-659ab92f` → `a2-7ccfae8d` | oler | B1 → A2 | A2 |
| `b1-67653425` → `a1-fb56de8d` | enfermo | B1 → A1 | A1 |
| `b1-69d14b3d` → `a1-01296445` | gastar | B1 → A1 | A1 |
| `b1-69f93912` → `a1-27ef1386` | oferta | B1 → A1 | A1 |
| `b1-6d706fb1` → `a1-9b51a72d` | sueldo | B1 → A1 | A1 |
| `b1-6e1e6776` → `a2-83097082` | espacio | B1 → A2 | A2 |
| `b1-6e45d6b0` → `a1-31d37105` | muñeca | B1 → A1 | A1 |
| `b1-7066fdec` → `a1-b4e6bfee` | pulsera | B1 → A1 | A1 |
| `b1-76625061` → `a2-0a73baf2` | idea | B1 → A2 | A2 |
| `b1-771d4026` → `a2-238dcada` | paciente | B1 → A2 | A2 |
| `b1-7b029a9e` → `a1-5331a22a` | cuchillo | B1 → A1 | A1 |
| `b1-7b30da9d` → `a1-891e6c6d` | cuchara | B1 → A1 | A1 |
| `b1-7d45eb69` → `a2-495b3d64` | carrera | B1 → A2 | A2 |
| `b1-7e4231b4` → `a2-6056f7c1` | privado | B1 → A2 | A2 |
| `b1-7e9a55de` → `a1-f1674404` | casco | B1 → A1 | A1 |
| `b1-7f759497` → `a1-57f64cc9` | cuero | B1 → A1 | A1 |
| `b1-8095ccd0` → `a2-239afabd` | matar | B1 → A2 | A2 |
| `b1-80c34c3a` → `a2-8786bd9f` | forma | B1 → A2 | A2 |
| `b1-8192bda7` → `a1-00599d03` | (in)seguro | B1 → A1 | A0 |
| `b1-8868234f` → `a2-3712246f` | orden | B1 → A2 | A2 |
| `b1-889107e6` → `a2-dea57a53` | prensa | B1 → A2 | A2 |
| `b1-896d35d6` → `a2-e4ad205c` | silencio | B1 → A2 | A2 |
| `b1-89c7d698` → `a2-edf648d8` | libre | B1 → A2 | A2 |
| `b1-89cd4529` → `a2-59c26d05` | energía | B1 → A2 | A2 |
| `b1-8d410ded` → `a1-998cc079` | hierba | B1 → A1 | A1 |
| `b1-8dc50a71` → `a2-4c1fb51a` | (des)orden | B1 → A2 | A2 |
| `b1-90dd8f26` → `a2-31a03ae5` | zona | B1 → A2 | A2 |
| `b1-91374757` → `a1-c13abb2c` | pesado | B1 → A1 | A1 |
| `b1-91bf80e8` → `a1-3b15ef43` | paisaje | B1 → A1 | A1 |
| `b1-9295c976` → `a1-ee089b4a` | puntual | B1 → A1 | A1 |
| `b1-93797cba` → `a1-5c6dbd0f` | húmedo | B1 → A1 | A1 |
| `b1-93bc32e3` → `a1-b677c661` | herida | B1 → A1 | A1 |
| `b1-9435ae34` → `a1-2f3cbb86` | pantalla | B1 → A1 | A1 |
| `b1-982b70a3` → `a2-7cf75d66` | inmediatamente | B1 → A2 | A2 |
| `b1-99178ced` → `a1-e726b02b` | irse | B1 → A1 | A1 |
| `b1-9c1d9676` → `a2-56b62493` | parar | B1 → A2 | A2 |
| `b1-a16f3c8f` → `a1-d26be047` | cepillo | B1 → A1 | A1 |
| `b1-a1d7da7c` → `a2-33aa91b9` | inteligente | B1 → A2 | A2 |
| `b1-a3f5f244` → `a2-a15d0625` | conversación | B1 → A2 | A2 |
| `b1-a8953360` → `a1-367dc2d8` | imprimir | B1 → A1 | A1 |
| `b1-a923f42f` → `a2-91c7992b` | nota | B1 → A2 | A2 |
| `b1-a9bda7be` → `a2-6a847d23` | probar | B1 → A2 | A2 |
| `b1-a9caaa7a` → `a2-941e7a3e` | romper(se) | B1 → A2 | A2 |
| `b1-aac7b1f7` → `a1-7928683b` | cintura | B1 → A1 | A1 |
| `b1-acc5f481` → `a1-30679ef7` | ligero | B1 → A1 | A1 |
| `b1-ad5869d2` → `a1-587dd55b` | pensar | B1 → A1 | A0 |
| `b1-ad661a0f` → `a1-3d82f3c5` | pelota | B1 → A1 | A1 |
| `b1-af4d702a` → `a2-421558bc` | recordar | B1 → A2 | A2 |
| `b1-af8f99dd` → `a2-a7fd2487` | enorme | B1 → A2 | A2 |
| `b1-b009ee42` → `a2-55aebda1` | anoche | B1 → A2 | A2 |
| `b1-b05f8bb9` → `a2-96014c20` | sueño | B1 → A2 | A2 |
| `b1-b198acf2` → `a2-5f1b9a88` | oro | B1 → A2 | A2 |
| `b1-b4a45398` → `a1-c43ff257` | pastilla | B1 → A1 | A1 |
| `b1-b4bf50d7` → `a2-61c989b8` | intentar | B1 → A2 | A2 |
| `b1-b8374f8d` → `a1-8317e735` | descuento | B1 → A1 | A1 |
| `b1-b8bf7a39` → `a2-85ef986c` | crear | B1 → A2 | A2 |
| `b1-bab4abbe` → `a2-1e83ffd5` | profundo | B1 → A2 | A2 |
| `b1-bb68a72a` → `a1-f6a68172` | barriga | B1 → A1 | A1 |
| `b1-bb890a4c` → `a2-0ff90301` | perder | B1 → A2 | A2 |
| `b1-bcabd18b` → `a2-6bc28a8d` | preparado | B1 → A2 | A2 |
| `b1-bcb29f7e` → `a2-7fe078de` | bomba | B1 → A2 | A2 |
| `b1-bcebd602` → `a2-1c43624d` | muerte | B1 → A2 | A2 |
| `b1-bda39488` → `a2-654ab8f0` | colega | B1 → A2 | A2 |
| `b1-bdeecd9e` → `a2-87a6d3ab` | perfecto | B1 → A2 | A2 |
| `b1-be6a629c` → `a1-222c80c0` | dentista | B1 → A1 | A1 |
| `b1-be71a96b` → `a2-2035327c` | asesino | B1 → A2 | A2 |
| `b1-bed97175` → `a2-a79c492b` | plan | B1 → A2 | A2 |
| `b1-bf230549` → `a2-d189f492` | precioso | B1 → A2 | A2 |
| `b1-c08f8437` → `a2-ff70aa47` | estudio | B1 → A2 | A2 |
| `b1-c0f54053` → `a1-3b4f0218` | vacío | B1 → A1 | A1 |
| `b1-c190847e` → `a2-8c17b1d8` | suponer | B1 → A2 | A2 |
| `b1-c1d6feff` → `a2-e534eafd` | menor | B1 → A2 | A2 |
| `b1-c303fda0` → `a1-c6a1efb1` | vida | B1 → A1 | A0 |
| `b1-c557c8fc` → `a1-dbf269af` | tigre | B1 → A1 | A1 |
| `b1-c7039f85` → `a2-920c7dc7` | tierra | B1 → A2 | A2 |
| `b1-c706cfdb` → `a1-fb887c6c` | agencia | B1 → A1 | A1 |
| `b1-c79c3857` → `a1-10e2e9ef` | rodilla | B1 → A1 | A1 |
| `b1-c7d7bcac` → `a2-14b0b220` | últimamente | B1 → A2 | A2 |
| `b1-c9a8a758` → `a2-5761dae0` | velocidad | B1 → A2 | A2 |
| `b1-c9c64e07` → `a2-c6626ff0` | real | B1 → A2 | A2 |
| `b1-ca066736` → `a2-24271fc5` | santo | B1 → A2 | A2 |
| `b1-ca40b952` → `a1-64bf54bd` | cuello | B1 → A1 | A1 |
| `b1-ca4a283e` → `a2-f23d2969` | correcto | B1 → A2 | A2 |
| `b1-cb839052` → `a2-3009cef4` | voz | B1 → A2 | A2 |
| `b1-cbf61ffd` → `a1-1fabf1c8` | lana | B1 → A1 | A1 |
| `b1-cf5c0fd4` → `a2-11495080` | sonido | B1 → A2 | A2 |
| `b1-d0f7404e` → `a1-fb264dbe` | salado | B1 → A1 | A1 |
| `b1-d296b93c` → `a1-bb784d62` | músculo | B1 → A1 | A1 |
| `b1-d394e3ce` → `a2-ae6d2620` | robar | B1 → A2 | A2 |
| `b1-d594c2cc` → `a1-3d29208e` | final | B1 → A1 | A1 |
| `b1-d6276d32` → `a1-c6931950` | mojado | B1 → A1 | A1 |
| `b1-d67232de` → `a1-fa176ec9` | oveja | B1 → A1 | A1 |
| `b1-d683c820` → `a1-eb9444e1` | nata | B1 → A1 | A1 |
| `b1-d714d845` → `a2-21f542d3` | victoria | B1 → A2 | A2 |
| `b1-d73ef924` → `a2-c8a59cb0` | original | B1 → A2 | A2 |
| `b1-d826b8df` → `a1-c9761711` | blando | B1 → A1 | A1 |
| `b1-d899f3b9` → `a1-dd9b8472` | segundo | B1 → A1 | A1 |
| `b1-d9ff65bc` → `a2-e4a5d1c8` | piedra | B1 → A2 | A2 |
| `b1-da0d1569` → `a2-7a0f705d` | capitán | B1 → A2 | A2 |
| `b1-da0d5259` → `a2-f58379a2` | tamaño | B1 → A2 | A2 |
| `b1-da14a04e` → `a1-872972dc` | recepción | B1 → A1 | A1 |
| `b1-daa24f33` → `a2-b0aea6e6` | futuro | B1 → A2 | A2 |
| `b1-db6553d3` → `a1-7968bb9f` | regar | B1 → A1 | A1 |
| `b1-db78ff0a` → `a2-e763a9e7` | tipo | B1 → A2 | A2 |
| `b1-dc82ab67` → `a1-afeb7937` | conducir | B1 → A1 | A1 |
| `b1-dcbe4dd3` → `a1-5ce5eed1` | corazón | B1 → A1 | A0 |
| `b1-de4b622e` → `a2-dec13604` | sitio | B1 → A2 | A2 |
| `b1-de7d2472` → `a2-abace1b4` | extraño | B1 → A2 | A2 |
| `b1-de7f6b3e` → `a1-101f0e64` | cuenta | B1 → A1 | A1 |
| `b1-dee0473f` → `a1-13201024` | anillo | B1 → A1 | A1 |
| `b1-dfb6723f` → `a2-b297794b` | llorar | B1 → A2 | A2 |
| `b1-dfde79ff` → `a1-e4277ada` | amargo | B1 → A1 | A1 |
| `b1-e0ea7149` → `a1-ada4eb2a` | todavía | B1 → A1 | A0 |
| `b1-e24aeac5` → `a1-a86a8462` | funcionar | B1 → A1 | A1 |
| `b1-e440de87` → `a2-867f8365` | ladrón | B1 → A2 | A2 |
| `b1-e49037b1` → `a2-6be9e453` | único | B1 → A2 | A2 |
| `b1-e7d715d8` → `a1-72cd55ac` | hueso | B1 → A1 | A1 |
| `b1-e9933e8a` → `a2-9ed01e8d` | club | B1 → A2 | A2 |
| `b1-ecdd4db4` → `a1-70aeb307` | gallina | B1 → A1 | A1 |
| `b1-eced8cc0` → `a2-c2f65d0e` | interés | B1 → A2 | A2 |
| `b1-ed071b59` → `a1-34bb3ad5` | horno | B1 → A1 | A1 |
| `b1-ede74040` → `a1-8d781ea8` | tocar | B1 → A1 | A1 |
| `b1-f0deaf8b` → `a2-41e9f846` | pistola | B1 → A2 | A2 |
| `b1-f4c4ee6e` → `a2-c44f7ac4` | punto | B1 → A2 | A2 |
| `b1-f56fe68c` → `a1-964f71eb` | amor | B1 → A1 | A0 |
| `b1-f6388066` → `a2-a017d361` | línea | B1 → A2 | A2 |
| `b1-f6d1beca` → `a1-33d24f10` | folleto | B1 → A1 | A1 |
| `b1-fa70fc6c` → `a2-74ba42cc` | nacional | B1 → A2 | A2 |
| `b1-fd536211` → `a2-aaa3fac8` | continuar | B1 → A2 | A2 |
| `b1-fd5b826b` → `a1-d13e42ee` | marisco | B1 → A1 | A1 |
| `b1-fd6b66b5` → `a1-34b92c38` | semáforo | B1 → A1 | A1 |
| `b1-ff180518` → `a1-5709aa7c` | cereza | B1 → A1 | A1 |
| `b1-ffd51f44` → `a2-f2f69ba7` | realidad | B1 → A2 | A2 |
| `b1-ffdfe913` → `a2-eafb9d5f` | seguridad | B1 → A2 | A2 |
| `b2-003d6b2e` → `a1-452504a4` | seta | B2 → A1 | A1 |
| `b2-00bba60f` → `b1-a2ed6a37` | ritmo | B2 → B1 | B1 |
| `b2-01726dc3` → `a2-ab209067` | espíritu | B2 → A2 | A2 |
| `b2-02ad9985` → `b1-7204c16d` | fácilmente | B2 → B1 | B1 |
| `b2-02e770e5` → `b1-c7d4485c` | propuesta | B2 → B1 | B1 |
| `b2-035fa923` → `a2-1b5505b3` | listo | B2 → A2 | A2 |
| `b2-03ac1742` → `a2-1962c546` | justicia | B2 → A2 | A2 |
| `b2-04fd22fa` → `a2-9d40445c` | periódico | B2 → A2 | A2 |
| `b2-052decdf` → `a1-520edc75` | avergonzado | B2 → A1 | A1 |
| `b2-05559969` → `b1-ba24b5c9` | coincidencia | B2 → B1 | B1 |
| `b2-060e5a62` → `a2-4c514148` | genial | B2 → A2 | A2 |
| `b2-078453c8` → `b1-3d6856ec` | curiosidad | B2 → B1 | B1 |
| `b2-0835ef56` → `b1-47dd997c` | sorprender(se) | B2 → B1 | B1 |
| `b2-086bff70` → `a2-9bb4143d` | excelente | B2 → A2 | A2 |
| `b2-08ea836a` → `b1-f0fcd7a9` | cura | B2 → B1 | B1 |
| `b2-091b66c4` → `b1-d06de317` | instalar(se) | B2 → B1 | B1 |
| `b2-0a1a86c1` → `b1-c3d24df0` | acuerdo | B2 → B1 | B1 |
| `b2-0d106019` → `b1-e107994c` | delicioso | B2 → B1 | B1 |
| `b2-0e23a26c` → `b1-1c61cded` | ciego | B2 → B1 | B1 |
| `b2-0e80e551` → `b1-a8c62a0f` | instante | B2 → B1 | B1 |
| `b2-0eb2a409` → `b1-6a0c9965` | dominar | B2 → B1 | B1 |
| `b2-0eda2fd3` → `a1-54aa09ac` | cubo | B2 → A1 | A1 |
| `b2-1225c440` → `a2-1f3fed94` | adentro | B2 → A2 | A2 |
| `b2-12332fe6` → `a1-17a43cf2` | detergente | B2 → A1 | A1 |
| `b2-1283f777` → `a2-3c9108a0` | enseguida | B2 → A2 | A2 |
| `b2-1313fbe5` → `b1-94860c38` | apropiado | B2 → B1 | B1 |
| `b2-138ba1e9` → `b1-ae7cb2ac` | empleo | B2 → B1 | B1 |
| `b2-14e80fa6` → `b1-fb26e145` | (in)capaz | B2 → B1 | B1 |
| `b2-1579ce58` → `b1-87ee38f9` | tumba | B2 → B1 | B1 |
| `b2-16293852` → `b1-70cedf4c` | dato | B2 → B1 | B1 |
| `b2-1634e6d7` → `a1-491d07b1` | timbre | B2 → A1 | A1 |
| `b2-165bf550` → `a2-4cfc7903` | puesto | B2 → A2 | A2 |
| `b2-16aeb5a1` → `b1-5e0eec5b` | sorprendente | B2 → B1 | B1 |
| `b2-1753d010` → `b1-6de7fbda` | socio | B2 → B1 | B1 |
| `b2-18828214` → `b1-e55396ed` | juventud | B2 → B1 | B1 |
| `b2-18ac8b80` → `b1-1a9bbe23` | violación | B2 → B1 | B1 |
| `b2-1932ad89` → `a2-88b8c46f` | fondo | B2 → A2 | A2 |
| `b2-1f09d023` → `b1-b388be32` | pensamiento | B2 → B1 | B1 |
| `b2-1f0b7e29` → `b1-4a158acd` | tripulación | B2 → B1 | B1 |
| `b2-1f4861cd` → `b1-9b6c5f4e` | competencia | B2 → B1 | B1 |
| `b2-1f4dd6f4` → `b1-f4dad559` | abandonar | B2 → B1 | B1 |
| `b2-1fcbe512` → `b1-558be383` | mental | B2 → B1 | B1 |
| `b2-213c4abf` → `b1-b2594b89` | paraíso | B2 → B1 | B1 |
| `b2-21de1dbc` → `b1-4cc24b77` | cadena | B2 → B1 | B1 |
| `b2-21f81843` → `b1-6185557e` | plazo | B2 → B1 | B1 |
| `b2-233b992e` → `b1-4d55f0d1` | dirigir | B2 → B1 | B1 |
| `b2-233ec5bd` → `a2-d87b5185` | central | B2 → A2 | A2 |
| `b2-23af90bc` → `a2-14319797` | hecho | B2 → A2 | A2 |
| `b2-252756ab` → `a1-7b776458` | arcoíris | B2 → A1 | A1 |
| `b2-26310610` → `a1-6e2585e7` | itinerario | B2 → A1 | A1 |
| `b2-266737cc` → `b1-59636648` | anteriormente | B2 → B1 | B1 |
| `b2-27ba65f6` → `a1-c8c760e3` | sorprendido | B2 → A1 | A1 |
| `b2-2808ef5c` → `b1-99120b66` | etapa | B2 → B1 | B1 |
| `b2-284fc46b` → `a2-b65b8d6d` | enemigo | B2 → A2 | A2 |
| `b2-29cc9b61` → `a2-d424ffaf` | maravilloso | B2 → A2 | A2 |
| `b2-2b6efdc8` → `a1-fdfe72b3` | suegro | B2 → A1 | A1 |
| `b2-2c70f6ea` → `b1-ca59ff32` | insistir | B2 → B1 | B1 |
| `b2-2cb0fad2` → `b1-79118219` | encantador | B2 → B1 | B1 |
| `b2-2d66b7e0` → `a1-70d90762` | urgencia | B2 → A1 | A1 |
| `b2-2db28826` → `a2-2ca5d4f7` | lograr | B2 → A2 | A2 |
| `b2-2ebb7e4c` → `b1-2d2f971f` | ciudadano(s) | B2 → B1 | B1 |
| `b2-2f14a2dd` → `b1-5197605e` | amenaza | B2 → B1 | B1 |
| `b2-2f758280` → `b1-a33294b6` | batería | B2 → B1 | B1 |
| `b2-2f93c922` → `a2-95641e26` | teoría | B2 → A2 | A2 |
| `b2-30d968cc` → `a2-f4b33a5f` | perfectamente | B2 → A2 | A2 |
| `b2-311010dd` → `a2-6a970f0c` | hogar | B2 → A2 | A2 |
| `b2-31308263` → `b1-d94febfd` | (ir)responsabilidad | B2 → B1 | B1 |
| `b2-31a4cd41` → `b1-d92a65ae` | alarma | B2 → B1 | B1 |
| `b2-34a51105` → `a2-31983920` | situación | B2 → A2 | A2 |
| `b2-3500a5d3` → `a2-3811f34e` | luchar | B2 → A2 | A2 |
| `b2-359dd51a` → `b1-1a907bfd` | educación | B2 → B1 | B1 |
| `b2-35a34c22` → `a2-dba838de` | principal | B2 → A2 | A2 |
| `b2-36476980` → `a1-5847506b` | comisión | B2 → A1 | A1 |
| `b2-364ad717` → `b1-d134f046` | cirugía | B2 → B1 | B1 |
| `b2-3650ed8d` → `a2-e65ec40b` | batalla | B2 → A2 | A2 |
| `b2-3acb4032` → `b1-50e1de1b` | cañón | B2 → B1 | B1 |
| `b2-3c66f544` → `b1-8a04378c` | comisario | B2 → B1 | B1 |
| `b2-3d099f1f` → `b1-08572461` | móvil | B2 → B1 | B1 |
| `b2-3d8fe533` → `b1-5284f4e5` | sesión | B2 → B1 | B1 |
| `b2-41062fea` → `a1-4ee5ffe8` | yerno | B2 → A1 | A1 |
| `b2-41d38f59` → `b1-ae5b5d55` | personalidad | B2 → B1 | B1 |
| `b2-422e1c98` → `a2-ffdc7f9e` | investigación | B2 → A2 | A2 |
| `b2-42d9d262` → `b1-5f720ad9` | temporal | B2 → B1 | B1 |
| `b2-437bfd9f` → `b1-35693d81` | asqueroso | B2 → B1 | B1 |
| `b2-43ae9baf` → `b1-433c1d87` | generalmente | B2 → B1 | B1 |
| `b2-447c64ec` → `b1-dda525d1` | curioso | B2 → B1 | B1 |
| `b2-47901b46` → `a2-b804be86` | movimiento | B2 → A2 | A2 |
| `b2-479350a6` → `b1-d129740e` | orgullo | B2 → B1 | B1 |
| `b2-48f2c0e0` → `b1-152669a6` | petición | B2 → B1 | B1 |
| `b2-49520ffd` → `a1-5dbdee16` | uña | B2 → A1 | A1 |
| `b2-4a823f39` → `a2-59270696` | sentido | B2 → A2 | A2 |
| `b2-4b748bfd` → `a1-be38e737` | linterna | B2 → A1 | A1 |
| `b2-4be7865a` → `a2-e92f2fed` | sobrevivir | B2 → A2 | A2 |
| `b2-4d2096d7` → `a2-b934561b` | inútil | B2 → A2 | A2 |
| `b2-4d4acbc7` → `b1-a80b3ee8` | cercano | B2 → B1 | B1 |
| `b2-4e1825a6` → `b1-697e3313` | reducir | B2 → B1 | B1 |
| `b2-50f46198` → `b1-bfe80a2e` | actual | B2 → B1 | B1 |
| `b2-519cdbaa` → `b1-136eac41` | demostrar | B2 → B1 | B1 |
| `b2-520217cb` → `b1-b28b3d34` | aspecto | B2 → B1 | B1 |
| `b2-52ee4dde` → `b1-16c617dc` | huella | B2 → B1 | B1 |
| `b2-5337d554` → `a2-dfa5ab80` | caer | B2 → A2 | A2 |
| `b2-54cf1edf` → `a2-ecf96715` | amar | B2 → A2 | A2 |
| `b2-551a21b3` → `b1-a97c20db` | tribu | B2 → B1 | B1 |
| `b2-558726f6` → `a2-15c632cf` | pedido | B2 → A2 | A2 |
| `b2-55e5b6b1` → `b1-615ebf86` | asistente | B2 → B1 | B1 |
| `b2-56378ed7` → `b1-6b079194` | límite | B2 → B1 | B1 |
| `b2-563da593` → `b1-c73f156a` | pecado | B2 → B1 | B1 |
| `b2-56ff0595` → `b1-1482dd6b` | acusado | B2 → B1 | B1 |
| `b2-5773d14f` → `b1-d7ef90ed` | capacidad | B2 → B1 | B1 |
| `b2-580d2ddc` → `b1-ec828134` | rutina | B2 → B1 | B1 |
| `b2-581827bd` → `a1-5e894abe` | escoba | B2 → A1 | A1 |
| `b2-583f44dd` → `a1-f8e180c7` | ruta | B2 → A1 | A1 |
| `b2-5884eebb` → `b1-2a11edfb` | limpieza | B2 → B1 | B1 |
| `b2-598d02a2` → `b1-9e265b3d` | emoción | B2 → B1 | B1 |
| `b2-59bf039c` → `a2-ce8325fa` | cerebro | B2 → A2 | A2 |
| `b2-5cad2f58` → `b1-20bf72ec` | amanecer | B2 → B1 | B1 |
| `b2-5dbd6d99` → `a2-0611d0eb` | ocurrir | B2 → A2 | A2 |
| `b2-5e1973bd` → `a2-010dcc61` | actuar | B2 → A2 | A2 |
| `b2-5e9dab9a` → `b1-abe814e5` | entregar | B2 → B1 | B1 |
| `b2-5e9dd91b` → `b1-b6e60039` | suspender | B2 → B1 | B1 |
| `b2-5ec1eaa1` → `a1-3fe7cd36` | mentira | B2 → A1 | A0 |
| `b2-5f5ea380` → `a2-17571a3a` | alma | B2 → A2 | A2 |
| `b2-5f71dd88` → `b1-e058aa71` | atacar | B2 → B1 | B1 |
| `b2-603edf39` → `b1-94bd9970` | asegurar(se) | B2 → B1 | B1 |
| `b2-6096e62d` → `b1-55ed8e13` | versión | B2 → B1 | B1 |
| `b2-6127e8d9` → `a2-9cd76f2c` | belleza | B2 → A2 | A2 |
| `b2-6309f68c` → `a2-4b1a6de3` | partir | B2 → A2 | A2 |
| `b2-631d2273` → `b1-1babd673` | aparecer | B2 → B1 | B1 |
| `b2-652f97cb` → `a2-f62e3d37` | afuera | B2 → A2 | A2 |
| `b2-666a52b7` → `a1-3b2f42f6` | ración | B2 → A1 | A1 |
| `b2-66b1de81` → `a2-b5dcb9f5` | testigo | B2 → A2 | A2 |
| `b2-66fcf467` → `b1-4c3c48e6` | producto | B2 → B1 | B1 |
| `b2-68bb75d2` → `b1-a279db67` | virus | B2 → B1 | B1 |
| `b2-68caafb2` → `a1-007766b2` | mono | B2 → A1 | A1 |
| `b2-69700fec` → `b1-d8636d94` | aparentemente | B2 → B1 | B1 |
| `b2-69e67f81` → `a2-115f6f5e` | disparar | B2 → A2 | A2 |
| `b2-6a1479bf` → `b1-f450de63` | tensión | B2 → B1 | B1 |
| `b2-6a28500e` → `a2-96ff1625` | proceso | B2 → A2 | A2 |
| `b2-6b27eba9` → `a1-41a18c24` | contento | B2 → A1 | A1 |
| `b2-6d0df2b2` → `b1-75ce430b` | prohibir | B2 → B1 | B1 |
| `b2-6d2de84d` → `a1-ad259f6d` | bombilla | B2 → A1 | A1 |
| `b2-6d56da42` → `b1-86515ac3` | inteligencia | B2 → B1 | B1 |
| `b2-6d81b789` → `a2-a8a22062` | acabado | B2 → A2 | A2 |
| `b2-6dcdad71` → `b1-730b5701` | publicar | B2 → B1 | B1 |
| `b2-6de6758b` → `a2-429aace0` | suceder | B2 → A2 | A2 |
| `b2-6e17796d` → `b1-ab2866f7` | almacén | B2 → B1 | B1 |
| `b2-6e98a3cf` → `a2-a4d9d510` | banda | B2 → A2 | A2 |
| `b2-7007385b` → `a2-08f41771` | profesional | B2 → A2 | A2 |
| `b2-70f569c8` → `a1-cd79ec38` | recibo | B2 → A1 | A1 |
| `b2-711383a5` → `b1-43d17389` | prueba | B2 → B1 | B1 |
| `b2-7333237b` → `a2-db8d645f` | memoria | B2 → A2 | A2 |
| `b2-73e4ece8` → `a1-1552e2a6` | dorado | B2 → A1 | A1 |
| `b2-7457dc85` → `b1-31bbb661` | disfrutar | B2 → B1 | B1 |
| `b2-74be5040` → `b1-2e6c0c17` | discurso | B2 → B1 | B1 |
| `b2-75663299` → `b1-702ad08b` | ceremonia | B2 → B1 | B1 |
| `b2-75c62016` → `b1-8ed71d10` | actuación | B2 → B1 | B1 |
| `b2-762ba43a` → `a1-d770e1b7` | verdad | B2 → A1 | A0 |
| `b2-76a81440` → `b1-bc30dbed` | presión | B2 → B1 | B1 |
| `b2-76c5f6fa` → `a1-d4bfb15f` | barra | B2 → A1 | A1 |
| `b2-77422103` → `a2-e8ec894c` | tribunal | B2 → A2 | A2 |
| `b2-77c65c6d` → `a1-964fdf6a` | caluroso | B2 → A1 | A1 |
| `b2-77fbab3d` → `a2-d917d8f3` | víctima | B2 → A2 | A2 |
| `b2-781060c4` → `a2-04972e9b` | recuerdo | B2 → A2 | A2 |
| `b2-7b7e741b` → `a2-9d07db72` | fiscal | B2 → A2 | A2 |
| `b2-7c2e99ad` → `a2-4c0927f9` | especialmente | B2 → A2 | A2 |
| `b2-7e44b2f4` → `a2-ba95f331` | oscuridad | B2 → A2 | A2 |
| `b2-7e667091` → `a2-9f9f65a7` | ganado | B2 → A2 | A2 |
| `b2-7f1ba0c1` → `a1-86dc145c` | preocupado | B2 → A1 | A1 |
| `b2-809cc231` → `a2-e9322d55` | acto | B2 → A2 | A2 |
| `b2-816f2ad5` → `b1-a0c1600d` | nuevamente | B2 → B1 | B1 |
| `b2-81863380` → `b1-30590977` | cifra | B2 → B1 | B1 |
| `b2-81be1238` → `b1-a6e79da8` | recientemente | B2 → B1 | B1 |
| `b2-8295c405` → `a1-eef931ac` | ceja | B2 → A1 | A1 |
| `b2-83d8fafd` → `a2-431d6699` | grave | B2 → A2 | A2 |
| `b2-8481a791` → `a2-834e0e4c` | comienzo | B2 → A2 | A2 |
| `b2-8491ac08` → `b1-bd7f4e2e` | (des)empleo | B2 → B1 | B1 |
| `b2-85681d25` → `a1-f9b613cc` | comedor | B2 → A1 | A1 |
| `b2-860b4828` → `b1-2c473504` | comunicación | B2 → B1 | B1 |
| `b2-86f1ef44` → `a2-51f9ae77` | claramente | B2 → A2 | A2 |
| `b2-882b1763` → `a1-9fb4e04e` | cobrar | B2 → A1 | A1 |
| `b2-88779f31` → `b1-34af5447` | justo | B2 → B1 | B1 |
| `b2-89a9133e` → `b1-afa5fb98` | continuación | B2 → B1 | B1 |
| `b2-89aa637c` → `b1-428e5f09` | investigar | B2 → B1 | B1 |
| `b2-8a130f05` → `b1-76618a94` | destino | B2 → B1 | B1 |
| `b2-8abdb50a` → `b1-47038d1a` | alegría | B2 → B1 | B1 |
| `b2-8ae69eed` → `a1-e9779c6d` | bolsa | B2 → A1 | A1 |
| `b2-8c4a6b36` → `b1-e9bc84da` | particular | B2 → B1 | B1 |
| `b2-8c7f32ce` → `b1-1f62b564` | Cáncer | B2 → B1 | B1 |
| `b2-8cc009da` → `b1-890417c7` | revolución | B2 → B1 | B1 |
| `b2-8cf63495` → `b1-17c9af7c` | (in)experto | B2 → B1 | B1 |
| `b2-8def62a8` → `b1-0bdf3aa7` | infancia | B2 → B1 | B1 |
| `b2-8eca84b7` → `b1-9300f3ec` | noble | B2 → B1 | B1 |
| `b2-8ed93442` → `b1-e4af2063` | ingreso | B2 → B1 | B1 |
| `b2-8f3a2aa5` → `a1-cdd20898` | entrenar | B2 → A1 | A1 |
| `b2-8f9ba869` → `b1-3034b361` | sentencia | B2 → B1 | B1 |
| `b2-9275709d` → `b1-5258cf0b` | presencia | B2 → B1 | B1 |
| `b2-92ae7a7d` → `a2-15ea3073` | escena | B2 → A2 | A2 |
| `b2-939bb46a` → `a2-28fb5a8a` | local | B2 → A2 | A2 |
| `b2-941ccad0` → `b1-eb786248` | guión | B2 → B1 | B1 |
| `b2-94ce5512` → `b1-5d6f026f` | (ir)responsable | B2 → B1 | B1 |
| `b2-96266571` → `b1-6120fcf8` | bravo | B2 → B1 | B1 |
| `b2-96e2f290` → `a1-6fcb40ad` | entrenar(se) | B2 → A1 | A1 |
| `b2-97300402` → `b1-80bb090d` | fama | B2 → B1 | B1 |
| `b2-97912524` → `b1-b51c6310` | material | B2 → B1 | B1 |
| `b2-97b0032f` → `a1-7ad2db31` | cuñado | B2 → A1 | A1 |
| `b2-988a9a8a` → `b1-ace9bd59` | (in)material | B2 → B1 | B1 |
| `b2-9aa00812` → `b1-99299998` | oxígeno | B2 → B1 | B1 |
| `b2-9bea91b2` → `b1-a4655468` | confesar | B2 → B1 | B1 |
| `b2-9d02e53d` → `a1-32bc6b73` | albergue | B2 → A1 | A1 |
| `b2-9df43a03` → `a2-378aaf21` | pista | B2 → A2 | A2 |
| `b2-9e475120` → `a2-70281afc` | manejar | B2 → A2 | A2 |
| `b2-9e5b68b8` → `b1-8bd00036` | coartada | B2 → B1 | B1 |
| `b2-9f2824a0` → `a1-68bb4b17` | ahorrar | B2 → A1 | A1 |
| `b2-9f3058a2` → `b1-b3af7b05` | presentación | B2 → B1 | B1 |
| `b2-a1f6882e` → `b1-065533ed` | fijarse | B2 → B1 | B1 |
| `b2-a23ce690` → `a2-8eef800e` | lamentar | B2 → A2 | A2 |
| `b2-a44e766a` → `a1-393a4ded` | factura | B2 → A1 | A1 |
| `b2-a4bf995b` → `b1-e47978f1` | maquillaje | B2 → B1 | B1 |
| `b2-a4f31fa2` → `b1-ab667ebf` | quitar | B2 → B1 | B1 |
| `b2-a5ccc35c` → `b1-f889e854` | comercial | B2 → B1 | B1 |
| `b2-a5da6d9c` → `a1-b6843745` | tiempo | B2 → A1 | A0 |
| `b2-a64254c3` → `a2-09a52210` | miembro | B2 → A2 | A2 |
| `b2-a7bb8348` → `b1-cae8363c` | colina | B2 → B1 | B1 |
| `b2-a9d6a6c8` → `b1-b1b63858` | casualidad | B2 → B1 | B1 |
| `b2-aa446a49` → `a1-f88c4538` | radiografía | B2 → A1 | A1 |
| `b2-aca39511` → `b1-f8d4d8dd` | escondido | B2 → B1 | B1 |
| `b2-ae0b8878` → `a2-e371906d` | sospechoso | B2 → A2 | A2 |
| `b2-ae18cad6` → `b1-47eed820` | gigante | B2 → B1 | B1 |
| `b2-ae3f484c` → `b1-23ff9e3d` | mínimo | B2 → B1 | B1 |
| `b2-ae45bdca` → `a2-57470dc0` | poner | B2 → A2 | A2 |
| `b2-ae9318ca` → `a1-f6db8dee` | mejilla | B2 → A1 | A1 |
| `b2-aef2b96d` → `b1-b9a637b5` | senador | B2 → B1 | B1 |
| `b2-afdce805` → `b1-ff9fc9d1` | gasto | B2 → B1 | B1 |
| `b2-b1056fa0` → `b1-ab5d1305` | completamente | B2 → B1 | B1 |
| `b2-b23358d8` → `b1-281cc2d1` | faltar | B2 → B1 | B1 |
| `b2-b3bb81fe` → `b1-6a093db7` | disponible | B2 → B1 | B1 |
| `b2-b71f1e8f` → `b1-9c92dd0f` | absurdo | B2 → B1 | B1 |
| `b2-b75d71d7` → `a2-56cb77b8` | señal | B2 → A2 | A2 |
| `b2-b7c450d6` → `b1-2f1513f3` | lanzar | B2 → B1 | B1 |
| `b2-b82b88c3` → `a1-57caa278` | acera | B2 → A1 | A1 |
| `b2-b9081c99` → `a1-59e40b27` | feliz | B2 → A1 | A0 |
| `b2-b9083bda` → `b1-82633eae` | lágrima | B2 → B1 | B1 |
| `b2-b91182a3` → `a2-361caaa4` | informe | B2 → A2 | A2 |
| `b2-ba743803` → `b1-e0300c7d` | cheque | B2 → B1 | B1 |
| `b2-ba9b0994` → `b1-7d8db347` | totalmente | B2 → B1 | B1 |
| `b2-ba9f178b` → `b1-a989d1f2` | apostar | B2 → B1 | B1 |
| `b2-baaa441e` → `a1-68df8c65` | fuente | B2 → A1 | A1 |
| `b2-baefa231` → `a2-cb496d1b` | temporada | B2 → A2 | A2 |
| `b2-bb1e8f36` → `a2-92a2230e` | falta | B2 → A2 | A2 |
| `b2-bd836f37` → `b1-f4673fef` | fase | B2 → B1 | B1 |
| `b2-bd9773b6` → `b1-88d5a358` | delito | B2 → B1 | B1 |
| `b2-bd9e27e0` → `b1-9334e5da` | fantasía | B2 → B1 | B1 |
| `b2-bda5c5d5` → `b1-49c8601e` | adorar | B2 → B1 | B1 |
| `b2-be08e92b` → `b1-90f7043a` | considerar | B2 → B1 | B1 |
| `b2-bfaa64b1` → `a1-d4cc8d97` | colorido | B2 → A1 | A1 |
| `b2-c0cb1938` → `a1-2c2b18a0` | granja | B2 → A1 | A1 |
| `b2-c14d77ce` → `b1-d2e9e00b` | huir | B2 → B1 | B1 |
| `b2-c3618662` → `b1-394f1ccd` | (in)suficiente | B2 → B1 | B1 |
| `b2-c380dab8` → `b1-9cd27c2b` | altura | B2 → B1 | B1 |
| `b2-c3b1be26` → `a2-ea621ab9` | área | B2 → A2 | A2 |
| `b2-c4a5a58c` → `b1-d44d424b` | grabación | B2 → B1 | B1 |
| `b2-c51d526f` → `b1-fb7149c8` | resistente | B2 → B1 | B1 |
| `b2-c52885f2` → `a1-0399472f` | maquillarse | B2 → A1 | A1 |
| `b2-c5edf78a` → `b1-a31c434c` | tanque | B2 → B1 | B1 |
| `b2-c69344a7` → `a2-dbee57ef` | acceso | B2 → A2 | A2 |
| `b2-c7241913` → `a1-d6c27d2e` | fresco | B2 → A1 | A1 |
| `b2-c7784b59` → `a1-8f2a7dd9` | plateado | B2 → A1 | A1 |
| `b2-c7bfafda` → `a2-513ee1c4` | absolutamente | B2 → A2 | A2 |
| `b2-c7ebed29` → `a2-d23e6af2` | espada | B2 → A2 | A2 |
| `b2-c94a30ab` → `a2-fc565937` | trasero | B2 → A2 | A2 |
| `b2-cb030491` → `b1-7e7d9dd0` | meta | B2 → B1 | B1 |
| `b2-cb2a5123` → `b1-56dfd00e` | generación | B2 → B1 | B1 |
| `b2-cc5ba5f8` → `b1-62589569` | atractivo | B2 → B1 | B1 |
| `b2-ccf1340e` → `a2-6855102e` | ridículo | B2 → A2 | A2 |
| `b2-ccf8956b` → `b1-758a3fec` | terrible | B2 → B1 | B1 |
| `b2-cd939c37` → `a2-b9b0a42d` | acción | B2 → A2 | A2 |
| `b2-cedb0fb0` → `a2-c16e9103` | realmente | B2 → A2 | A2 |
| `b2-cf1721eb` → `b1-e828e2f5` | vigilancia | B2 → B1 | B1 |
| `b2-cfa3e482` → `a2-15fbc8ec` | época | B2 → A2 | A2 |
| `b2-d02937d8` → `b1-a9c21989` | básicamente | B2 → B1 | B1 |
| `b2-d0c6d41d` → `b1-5c44cd83` | culpable | B2 → B1 | B1 |
| `b2-d1342a89` → `a1-ab0460f3` | venda | B2 → A1 | A1 |
| `b2-d1baf9ea` → `a1-be26091c` | escritorio | B2 → A1 | A1 |
| `b2-d35dbc10` → `a1-2600f1c6` | helado | B2 → A1 | A1 |
| `b2-d39ff8e6` → `a2-87a48f02` | bala | B2 → A2 | A2 |
| `b2-d5a401e6` → `a2-41e4bd61` | uso | B2 → A2 | A2 |
| `b2-d5c84b68` → `a2-87063aff` | posición | B2 → A2 | A2 |
| `b2-d66149f7` → `b1-953ddba3` | civil | B2 → B1 | B1 |
| `b2-d7c0f6e8` → `a2-d5eabf93` | exacto | B2 → A2 | A2 |
| `b2-d8148f1f` → `b1-82ba7433` | resistencia | B2 → B1 | B1 |
| `b2-d863b2e3` → `b1-d8890d8d` | anterior | B2 → B1 | B1 |
| `b2-d9e23296` → `b1-67d796c9` | experiencia | B2 → B1 | B1 |
| `b2-da92ec1b` → `a2-73d51d26` | maestro | B2 → A2 | A2 |
| `b2-da9f8d7c` → `b1-27152a1e` | aguantar | B2 → B1 | B1 |
| `b2-dab9c187` → `a2-d86ed4bb` | modelo | B2 → A2 | A2 |
| `b2-dad55fb3` → `b1-ed025d1d` | juicio | B2 → B1 | B1 |
| `b2-db69db5f` → `a2-80353f29` | personal | B2 → A2 | A2 |
| `b2-dbe4368e` → `a2-0d07f0eb` | cámara | B2 → A2 | A2 |
| `b2-dcff95ac` → `a2-b2855e59` | criminal | B2 → A2 | A2 |
| `b2-dd330016` → `a2-12587fbf` | servicio | B2 → A2 | A2 |
| `b2-decfe095` → `b1-c1933634` | aprobar | B2 → B1 | B1 |
| `b2-e02b1c88` → `a2-08c2ac4c` | efecto | B2 → A2 | A2 |
| `b2-e043fe54` → `b1-7d8b7b9c` | sombra | B2 → B1 | B1 |
| `b2-e0d6ae5c` → `b1-3883b0d0` | cargo | B2 → B1 | B1 |
| `b2-e1734d86` → `b1-273058fe` | conocimiento | B2 → B1 | B1 |
| `b2-e2b4cc30` → `a1-315ee16a` | perdón | B2 → A1 | A0 |
| `b2-e34b608d` → `b1-36e96341` | (in)justo | B2 → B1 | B1 |
| `b2-e3f1928c` → `a1-8e345a86` | doblar | B2 → A1 | A1 |
| `b2-e439700a` → `a2-55518e7f` | frente | B2 → A2 | A2 |
| `b2-e4a850fb` → `b1-58d5fc66` | tragedia | B2 → B1 | B1 |
| `b2-e5c66851` → `a1-180521d3` | trueno | B2 → A1 | A1 |
| `b2-e6189e35` → `a2-3f4c206a` | evidencia | B2 → A2 | A2 |
| `b2-e6361fb5` → `b1-0a8cfb54` | superficie | B2 → B1 | B1 |
| `b2-e64d7263` → `a1-a728aed2` | cruce | B2 → A1 | A1 |
| `b2-e675830f` → `b1-49c86354` | cobarde | B2 → B1 | B1 |
| `b2-e7363c55` → `b1-329da27b` | tono | B2 → B1 | B1 |
| `b2-e876a8ee` → `b1-ce4a3929` | aviso | B2 → B1 | B1 |
| `b2-e97ba6ae` → `b1-d6da7d20` | cable | B2 → B1 | B1 |
| `b2-ea2fe518` → `a2-86fe9f13` | inocente | B2 → A2 | A2 |
| `b2-eaf928a1` → `b1-cce5bf94` | artículo | B2 → B1 | B1 |
| `b2-eb792060` → `b1-cdb7ad90` | norma | B2 → B1 | B1 |
| `b2-eb8a28ef` → `a2-554a13e9` | cierto | B2 → A2 | A2 |
| `b2-ec9cb74e` → `b1-1eb238cf` | máximo | B2 → B1 | B1 |
| `b2-ecbd4ed2` → `a2-c65af424` | protección | B2 → A2 | A2 |
| `b2-ed4b248c` → `a2-df040d44` | felicidad | B2 → A2 | A2 |
| `b2-edb520f1` → `a2-7b61d329` | odio | B2 → A2 | A2 |
| `b2-ee39a747` → `b1-9c591715` | sugerir | B2 → B1 | B1 |
| `b2-ee4c8788` → `b1-777643ec` | mejorar | B2 → B1 | B1 |
| `b2-ee6093af` → `a2-76e69820` | serio | B2 → A2 | A2 |
| `b2-efb46242` → `b1-a0492ea5` | asegurar | B2 → B1 | B1 |
| `b2-f0237c3c` → `a2-48b45518` | detener(se) | B2 → A2 | A2 |
| `b2-f10cda81` → `a2-cb724cec` | común | B2 → A2 | A2 |
| `b2-f1143089` → `b1-60c6006c` | festival | B2 → B1 | B1 |
| `b2-f123eea1` → `a2-646b41ec` | cadáver | B2 → A2 | A2 |
| `b2-f12742d4` → `a2-79256df3` | propiedad | B2 → A2 | A2 |
| `b2-f1e6dd09` → `a2-6168fc7c` | líder | B2 → A2 | A2 |
| `b2-f30e033a` → `a1-73f2960f` | contratar | B2 → A1 | A1 |
| `b2-f31b172c` → `a2-1c7a283e` | muestra | B2 → A2 | A2 |
| `b2-f3e047a6` → `b1-d0a41b16` | perfil | B2 → B1 | B1 |
| `b2-f46b3ae6` → `b1-f4ac6da0` | tratamiento | B2 → B1 | B1 |
| `b2-f4f60ea1` → `b1-4acdc71d` | influencia | B2 → B1 | B1 |
| `b2-f56c1bb0` → `a2-fc6b616b` | cabo | B2 → A2 | A2 |
| `b2-f5e4abd4` → `a2-4e2fdf2c` | razón | B2 → A2 | A2 |
| `b2-f5f0626f` → `a2-fbf92ca8` | asunto | B2 → A2 | A2 |
| `b2-f646e678` → `b1-8293c8f3` | vecindario | B2 → B1 | B1 |
| `b2-f6edc128` → `b1-e4e05fc3` | secuestro | B2 → B1 | B1 |
| `b2-f79da09c` → `b1-7e895eb7` | habilidad | B2 → B1 | B1 |
| `b2-f7e86b53` → `a2-743c847d` | especie | B2 → A2 | A2 |
| `b2-f8112c75` → `b1-b7125552` | aumento | B2 → B1 | B1 |
| `b2-f8343bd9` → `a1-a488e64e` | préstamo | B2 → A1 | A1 |
| `b2-fa937776` → `b1-bbaaf6b7` | objetivo | B2 → B1 | B1 |
| `b2-fb6dffae` → `a1-f5e0c0b9` | madrugar | B2 → A1 | A1 |
| `b2-fbf9928f` → `a2-f69eb1b3` | tontería | B2 → A2 | A2 |
| `b2-fd5cf991` → `a2-8fbbe125` | recoger | B2 → A2 | A2 |
| `b2-fd5e4edc` → `a2-a049610a` | escrito | B2 → A2 | A2 |
| `b2-fda0484c` → `b1-810d3526` | magnífico | B2 → B1 | B1 |
| `b2-feaabc9e` → `a2-ff02b36c` | asesinato | B2 → A2 | A2 |
| `b2-fecaf641` → `b1-116b13fc` | liga | B2 → B1 | B1 |
| `b2-ff6aa343` → `a2-adf4b94e` | cuidado | B2 → A2 | A2 |

## Kihagyva (célszinten már van azonos `es`, 7b dönt)

| id | es | szint → jelölt cél | korpusz-forrás szint |
|---|---|---|---|
| `a2-0524ae33` | pregunta | A2 → A1 | A1 |
| `a2-152b0c98` | jardín | A2 → A1 | A1 |
| `a2-157a7200` | carretera | A2 → A1 | A1 |
| `a2-18ad3550` | joven | A2 → A1 | A1 |
| `a2-1ab1b3e3` | tener | A2 → A1 | A0 |
| `a2-28e5793a` | bueno | A2 → A1 | A0 |
| `a2-2ce33323` | barrio | A2 → A1 | A1 |
| `a2-3282a9f5` | exposición | A2 → A1 | A1 |
| `a2-363da8b7` | precio | A2 → A1 | A1 |
| `a2-3cf34940` | naranja | A2 → A1 | A1 |
| `a2-43e97870` | correr | A2 → A1 | A1 |
| `a2-4f28f744` | billete | A2 → A1 | A1 |
| `a2-59c21812` | azúcar | A2 → A1 | A1 |
| `a2-5e0b8aa1` | ver | A2 → A1 | A0 |
| `a2-60439c2e` | quiosco | A2 → A1 | A1 |
| `a2-6c351bdc` | catedral | A2 → A1 | A1 |
| `a2-6c6e13da` | cocina | A2 → A1 | A1 |
| `a2-8f9f97eb` | calle | A2 → A1 | A1 |
| `a2-959d918a` | gafas | A2 → A1 | A1 |
| `a2-976df5d6` | ducha | A2 → A1 | A1 |
| `a2-98a793c7` | claro | A2 → A1 | A1 |
| `a2-a1f9819c` | colegio | A2 → A1 | A1 |
| `a2-affe4c6c` | edificio | A2 → A1 | A1 |
| `a2-b4b82088` | monumento | A2 → A1 | A1 |
| `a2-bf7cdc72` | malo | A2 → A1 | A0 |
| `a2-cef4b5e9` | antes | A2 → A1 | A0 |
| `a2-da6dfa2b` | viejo | A2 → A1 | A1 |
| `a2-ed7ad1f6` | entre | A2 → A1 | A0 |
| `a2-f163153f` | Iglesia | A2 → A1 | A1 |
| `b1-14fdf15f` | llevar | B1 → A1 | A1 |
| `b1-1824d6bc` | piel | B1 → A1 | A1 |
| `b1-24c11764` | entrevista | B1 → A1 | A1 |
| `b1-287c5312` | edad | B1 → A1 | A1 |
| `b1-2e1b710d` | levantarse | B1 → A1 | A1 |
| `b1-42bd1643` | entender | B1 → A1 | A0 |
| `b1-471987db` | importar | B1 → A2 | A2 |
| `b1-47207a68` | derecho | B1 → A2 | A2 |
| `b1-5695924a` | dirección | B1 → A1 | A1 |
| `b1-639c48ee` | sobre | B1 → A1 | A1 |
| `b1-64c2b8d9` | historia | B1 → A2 | A2 |
| `b1-686bf5da` | clase | B1 → A1 | A1 |
| `b1-6c6e13da` | cocina | B1 → A1 | A1 |
| `b1-6efb2f76` | pintar | B1 → A1 | A1 |
| `b1-7af0f1c6` | fuerte | B1 → A1 | A0 |
| `b1-7c712919` | receta | B1 → A2 | A2 |
| `b1-7ecfc34b` | igual | B1 → A2 | A2 |
| `b1-851c2e6d` | caminar | B1 → A1 | A1 |
| `b1-93cf094f` | cambio | B1 → A1 | A1 |
| `b1-98a793c7` | claro | B1 → A1 | A1 |
| `b1-a30b3970` | gracias | B1 → A1 | A0 |
| `b1-a4b3d4fc` | distancia | B1 → A2 | A2 |
| `b1-a9df7a76` | entrada | B1 → A2 | A2 |
| `b1-b54cfda8` | cielo | B1 → A2 | A2 |
| `b1-bd17811d` | antiguo | B1 → A1 | A1 |
| `b1-cfa582c0` | interior | B1 → A2 | A2 |
| `b1-d22aed21` | enviar | B1 → A2 | A2 |
| `b1-e65d16c3` | pasillo | B1 → A1 | A1 |
| `b1-e7d92c1f` | programa | B1 → A2 | A2 |
| `b2-00698e87` | regla | B2 → A2 | A2 |
| `b2-086720f7` | expresión | B2 → B1 | B1 |
| `b2-0b950c55` | ancho | B2 → A1 | A1 |
| `b2-14fdf15f` | llevar | B2 → A1 | A1 |
| `b2-1824d6bc` | piel | B2 → A1 | A1 |
| `b2-1e29c190` | aniversario | B2 → B1 | B1 |
| `b2-29630133` | olvidar | B2 → A2 | A2 |
| `b2-3098cc7e` | construcción | B2 → B1 | B1 |
| `b2-3282a9f5` | exposición | B2 → A1 | A1 |
| `b2-37b3214f` | diario | B2 → A2 | A2 |
| `b2-37caec07` | vía | B2 → B1 | B1 |
| `b2-3b660a83` | familia | B2 → A1 | A1 |
| `b2-3c0071dc` | ejército | B2 → A2 | A2 |
| `b2-47a5d765` | fila | B2 → B1 | B1 |
| `b2-4a5cb5ab` | principio | B2 → A2 | A2 |
| `b2-53af8c2c` | duro | B2 → A1 | A1 |
| `b2-5695924a` | dirección | B2 → A1 | A1 |
| `b2-569b1c7e` | especial | B2 → A2 | A2 |
| `b2-5a537e20` | total | B2 → A2 | A2 |
| `b2-5e11eb4f` | largo | B2 → A1 | A1 |
| `b2-63746892` | producción | B2 → B1 | B1 |
| `b2-6e1e6776` | espacio | B2 → A2 | A2 |
| `b2-76625061` | idea | B2 → A2 | A2 |
| `b2-7ecfc34b` | igual | B2 → A2 | A2 |
| `b2-9e7db28a` | salón | B2 → A1 | A1 |
| `b2-abf1aa4a` | mano | B2 → A1 | A0 |
| `b2-af4d702a` | recordar | B2 → A2 | A2 |
| `b2-afa13919` | ley | B2 → B1 | B1 |
| `b2-b1b3592d` | poder | B2 → A1 | A0 |
| `b2-c0db1ada` | oscuro | B2 → A1 | A1 |
| `b2-c3c36d0e` | quedar | B2 → A2 | A2 |
| `b2-c4cc3529` | estrecho | B2 → A1 | A1 |
| `b2-c722afa1` | crecer | B2 → B1 | B1 |
| `b2-ca066736` | santo | B2 → A2 | A2 |
| `b2-d714d845` | victoria | B2 → A2 | A2 |
| `b2-d961e8aa` | demanda | B2 → B1 | B1 |
| `b2-daa24f33` | futuro | B2 → A2 | A2 |
| `b2-dfe2db74` | general | B2 → B1 | B1 |
| `b2-e0bea26f` | oído | B2 → A2 | A2 |
| `b2-e7d715d8` | hueso | B2 → A1 | A1 |
| `b2-ee24bfdc` | alto | B2 → A1 | A1 |
| `b2-f2b946b7` | garantía | B2 → B1 | B1 |
| `b2-fbb93bb9` | sol | B2 → A1 | A1 |

## 7b. lépés: szintek közti/szinten belüli duplikátumok (FB384, D3+D4)

Generálva: node scripts/pcic-dedup.mjs --write

**304 duplikátum-csoport** (normalizált `es` szerint, word/phrase kind): a legalacsonyabb szintű tétel marad, a többi törlődik, a haladás átkerül rá (erősebb nyer: több sikeres ismétlés, aztán nagyobb interval - lib/db/migrations.ts applyPcicDedup). **219** csoportnál a jelentés lényegében egyezik (sima törlés), **85** csoportnál a jelentés érdemben eltér, ezért a megmaradó kártya jelentés-listát kapott (`data/pcic/senses.json`).

### Jelentésben eltérő csoportok (senses.json)

| normalizált es | megtartva | törölt jelentések |
|---|---|---|
| largo | A1 `a1-5e11eb4f` "largo" = "long" | B2 `b2-5e11eb4f` "largo" = "length" |
| alto | A1 `a1-ee24bfdc` "alto" = "tall" | B2 `b2-ee24bfdc` "alto" = "height" |
| metro | A1 `a1-dcb8c894` "metro(s)" = "meter(s)" | A1 `a1-1388b778` "metro" = "subway" |
| pasar | A1 `a1-7a5e88d9` "pasar" = "to happen" | A2 `a2-9b641269` "pasar (por)" = "to go through" |
| estrecho | A1 `a1-68d3e031` "estrecho" = "narrow" | B2 `b2-c4cc3529` "estrecho" = "strait" |
| ancho | A1 `a1-3d61f0ce` "ancho" = "wide" | B2 `b2-0b950c55` "ancho" = "width" |
| cerca | A1 `a1-88fc207c` "cerca (de)" = "near" | A1 `a1-34bbe760` "cerca" = "nearby" |
| llevar | A1 `a1-4dfc27c1` "llevar" = "to carry" | B1 `b1-14fdf15f` "llevar" = "to wear"; B2 `b2-14fdf15f` "llevar" = "to take (time)" |
| delante | A1 `a1-48765024` "delante" = "ahead" | A2 `a2-a72d6a82` "delante (de)" = "in front (of)" |
| cambiar | A1 `a1-637e9229` "cambiar" = "to change" | A2 `a2-637e9229` "cambiar" = "to exchange" |
| claro | A1 `a1-98a793c7` "claro" = "light (in color)" | A2 `a2-98a793c7` "claro" = "of course"; B1 `b1-98a793c7` "claro" = "clear" |
| oscuro | A1 `a1-c0db1ada` "oscuro" = "dark" | B2 `b2-c0db1ada` "oscuro" = "unclear" |
| entrada | A1 `a1-a9df7a76` "entrada" = "entrance" | A2 `a2-a9df7a76` "entrada" = "ticket"; B1 `b1-a9df7a76` "entrada" = "entrance" |
| regular | A1 `a1-5f51efbe` "regular" = "so-so" | B1 `b1-5f51efbe` "regular" = "regular" |
| fuerte | A1 `a1-e8d19826` "fuerte" = "strong" | B1 `b1-7af0f1c6` "fuerte" = "loud" |
| piel | A1 `a1-7da0ef23` "piel" = "leather" | B1 `b1-1824d6bc` "piel" = "skin"; B2 `b2-1824d6bc` "piel" = "skin" |
| trabajador | A1 `a1-d0f16530` "trabajador" = "hardworking" | B1 `b1-d0f16530` "trabajador" = "worker" |
| dirección | A1 `a1-5695924a` "dirección" = "address" | B1 `b1-5695924a` "dirección" = "direction"; B2 `b2-5695924a` "dirección" = "board of directors" |
| paseo | A1 `a1-dae2f72e` "paseo" = "boulevard" | B1 `b1-dae2f72e` "paseo" = "walk" |
| piso | A1 `a1-90d94ae3` "piso" = "floor" | A1 `a1-da84060c` "el piso" = "the apartment" |
| poder | A1 `a1-a5cd9d69` "poder" = "to be able to" | B2 `b2-b1b3592d` "poder" = "power" |
| móvil | A1 `a1-3d099f1f` "móvil" = "cell phone (contact)" | B1 `b1-08572461` "móvil" = "mobile" |
| mano | A1 `a1-7ac58255` "mano" = "hand" | B2 `b2-abf1aa4a` "mano" = "coat" |
| separado | A1 `a1-0ee3e0a9` "separado" = "separated" | B1 `b1-d636d880` "separado (de)" = "separate (from)"; B1 `b1-0ee3e0a9` "separado" = "separated" |
| compañero | A1 `a1-67874488` "compañero" = "colleague" | A1 `a1-946fa7e5` "compañero (de juego)" = "playmate" |
| cuenta | A1 `a1-266ffb6d` "la cuenta" = "the bill" | A1 `a1-101f0e64` "cuenta" = "account" |
| clase | A1 `a1-686bf5da` "clase" = "class" | B1 `b1-686bf5da` "clase" = "kind" |
| director | A1 `a1-235acfdf` "director" = "principal" | A2 `a2-235acfdf` "director" = "director" |
| sobre | A1 `a1-639c48ee` "sobre" = "envelope" | B1 `b1-639c48ee` "sobre" = "around" |
| guión | A1 `a1-941ccad0` "guión" = "hyphen" | B1 `b1-eb786248` "guión" = "script" |
| punto | A1 `a1-f4c4ee6e` "punto" = "dot" | A2 `a2-c44f7ac4` "punto" = "point" |
| estudio | A1 `a1-c08f8437` "estudio" = "studio apartment" | A2 `a2-ff70aa47` "estudio" = "study" |
| cocina | A1 `a1-6c6e13da` "cocina" = "kitchen" | A2 `a2-6c6e13da` "cocina" = "stove"; B1 `b1-6c6e13da` "cocina" = "cooking" |
| salón | A1 `a1-9e7db28a` "salón" = "living room" | B2 `b2-9e7db28a` "salón" = "dining hall" |
| estar malo | A1 `a1-0735353d` "estar malo" = "to be unwell" | B1 `b1-0735353d` "estar malo" = "to be off, spoiled (food)"; B2 `b2-0735353d` "estar malo" = "to have gone bad" |
| bañarse | A1 `a1-5e3a391a` "bañarse" = "to bathe" | A2 `a2-5e3a391a` "bañarse" = "to swim" |
| plano | A1 `a1-d7d88964` "plano" = "map (city)" | B1 `b1-d7d88964` "plano" = "flat"; B2 `b2-d7d88964` "plano" = "plane" |
| exposición | A1 `a1-3282a9f5` "exposición" = "exhibition" | A2 `a2-3282a9f5` "exposición" = "exhibition"; B2 `b2-3282a9f5` "exposición" = "talk" |
| pasillo | A1 `a1-8602a05e` "pasillo" = "hallway" | B1 `b1-e65d16c3` "pasillo" = "aisle" |
| sol | A1 `a1-fbb93bb9` "sol" = "sun" | B2 `b2-fbb93bb9` "sol" = "G" |
| igual | A2 `a2-7ecfc34b` "igual" = "same" | B1 `b1-7ecfc34b` "igual" = "equal"; B2 `b2-7ecfc34b` "igual" = "maybe" |
| seguridad | A2 `a2-eafb9d5f` "seguridad" = "certainty" | B2 `b2-c3bc985f` "(servicio de) seguridad" = "security service"; B2 `b2-8ad06853` "seguridad (ciudadana)" = "public safety" |
| contar | A2 `a2-564c63e9` "contar" = "to count" | B1 `b1-82e86540` "contar (la historia de)" = "to tell (the story of)" |
| girar | A2 `a2-7f44657f` "girar" = "to turn" | B1 `b1-7f44657f` "girar" = "to turn"; B2 `b2-e55f1382` "girar (un planeta)" = "to rotate (a planet)" |
| mayor | A2 `a2-e6a04b67` "mayor" = "older" | B1 `b1-e6a04b67` "mayor" = "bigger, greater" |
| extensión | A2 `a2-ec5a6ac0` "extensión" = "extension" | B1 `b1-ec5a6ac0` "extensión" = "extension"; B2 `b2-ec5a6ac0` "extensión" = "extent" |
| socio | A2 `a2-1753d010` "socio" = "business partner" | B1 `b1-6de7fbda` "socio" = "member" |
| principio | A2 `a2-bd9e7f16` "principio" = "beginning" | B2 `b2-4a5cb5ab` "principio" = "principle" |
| programa | A2 `a2-1ba658f4` "programa (del curso)" = "(course) syllabus" | A2 `a2-e7d92c1f` "programa" = "program"; B1 `b1-e7d92c1f` "programa" = "program, software" |
| suspender | A2 `a2-5e9dd91b` "suspender" = "to fail" | B1 `b1-b6e60039` "suspender" = "to cancel" |
| derecho | A2 `a2-47207a68` "Derecho" = "Law" | B1 `b1-47207a68` "derecho" = "right"; B2 `b2-53405b4b` "(estar) derecho" = "to be standing upright" |
| hoja | A2 `a2-d4235bc0` "hoja" = "sheet (of paper)" | B1 `b1-d4235bc0` "hoja" = "leaf" |
| regla | A2 `a2-00698e87` "regla" = "ruler" | B2 `b2-00698e87` "regla" = "rule" |
| comercial | A2 `a2-a5ccc35c` "comercial" = "sales rep" | B1 `b1-f889e854` "comercial" = "commercial" |
| quedar | A2 `a2-c3c36d0e` "quedar" = "to meet up" | B2 `b2-c3c36d0e` "quedar" = "to be left" |
| nota | A2 `a2-91c7992b` "nota" = "grade" | B2 `b2-e08ebf74` "nota (musical)" = "musical note" |
| portátil | A2 `a2-c93e5c3c` "(ordenador) portátil" = "laptop" | B2 `b2-9811c01d` "portátil" = "portable" |
| diario | A2 `a2-c918b647` "diario" = "diary" | B2 `b2-37b3214f` "diario" = "daily" |
| cielo | A2 `a2-b54cfda8` "cielo" = "sky" | B1 `b1-b54cfda8` "cielo" = "heaven" |
| interior | A2 `a2-cfa582c0` "interior" = "inland" | B1 `b1-cfa582c0` "interior" = "interior" |
| aparecer | B1 `b1-49a6d530` "(des)aparecer" = "to appear/disappear" | B1 `b1-1babd673` "aparecer" = "to appear" |
| material | B1 `b1-b51c6310` "material" = "material" | B1 `b1-ace9bd59` "(in)material" = "immaterial" |
| asegurar | B1 `b1-94bd9970` "asegurar(se)" = "to make sure" | B1 `b1-a0492ea5` "asegurar" = "to assure" |
| congelar | B1 `b1-28d9e3a7` "(des)congelar" = "to freeze/defrost" | B1 `b1-01fea684` "congelar(se)" = "to freeze" |
| a continuación | B1 `b1-d52d75e1` "a continuación" = "next" | B2 `b2-3ce95f31` "a continuación (de)" = "right after" |
| anterior | B1 `b1-d8890d8d` "anterior" = "front" | B2 `b2-96c982a7` "(el) anterior" = "the previous one" |
| cercano | B1 `b1-a80b3ee8` "cercano" = "nearby" | B2 `b2-c6fa106c` "cercano (a)" = "close (to)" |
| redacción | B1 `b1-18f79971` "redacción" = "essay, composition (writing)" | B2 `b2-18f79971` "redacción" = "newsroom" |
| soso | B1 `b1-5c462734` "soso" = "bland" | B2 `b2-5c462734` "soso" = "tasteless" |
| matrícula | B1 `b1-2b51c979` "matrícula" = "enrollment" | B2 `b2-dc1320de` "(número de) matrícula" = "license plate (number)" |
| economía | B1 `b1-f125a436` "(sección de) economía" = "business section" | B1 `b1-3cde4d27` "economía" = "economy" |
| ponerse malo | B1 `b1-0c94594c` "ponerse malo" = "to get sick" | B2 `b2-0c94594c` "ponerse malo" = "to go off" |
| dar un golpe | B1 `b1-1c183ff2` "dar(se) un golpe" = "to bump/hit oneself" | B2 `b2-1c183ff2` "dar(se) un golpe" = "to crash into something" |
| conserje | B1 `b1-647a698a` "conserje" = "concierge" | B2 `b2-647a698a` "conserje" = "caretaker" |
| vía | B1 `b1-37caec07` "vía" = "track" | B2 `b2-37caec07` "vía" = "way" |
| comercio | B1 `b1-592bd52a` "comercio" = "trade" | B2 `b2-592bd52a` "comercio" = "commerce" |
| materia | B1 `b1-f5c44c2b` "materia" = "matter" | B2 `b2-a28af733` "materia (prima)" = "raw material" |
| comunidad | B1 `b1-58b01ddb` "comunidad" = "community" | B2 `b2-87008906` "comunidad (de vecinos)" = "residents' association" |
| congreso | B1 `b1-430a9940` "congreso" = "congress" | B2 `b2-430a9940` "congreso" = "conference" |
| vista | B1 `b1-75a31fd0` "vista" = "view" | B2 `b2-75a31fd0` "vista" = "eyesight" |
| parque natural | B1 `b1-60dd3ee8` "parque natural" = "natural park" | B2 `b2-60dd3ee8` "parque natural" = "nature reserve" |
| empleo | B1 `b1-ae7cb2ac` "empleo" = "job" | B1 `b1-bd7f4e2e` "(des)empleo" = "(un)employment" |
| lejano | B2 `b2-41dc1eb4` "lejano (a)" = "far (from)" | B2 `b2-49520d21` "lejano" = "distant" |
| por abajo | B2 `b2-c170d049` "por abajo (de)" = "underneath" | B2 `b2-047c851c` "por abajo" = "from the bottom" |
| pinchar | B2 `b2-ea5871f7` "pinchar(se) (una rueda)" = "to get a flat tire" | B2 `b2-7194d174` "pinchar" = "to click" |

### Szinonima-csoportok (219, sima törlés, nincs senses.json)

| normalizált es | megtartva | törölt |
|---|---|---|
| tener | A1 `a1-1ab1b3e3` "tener" | A2 `a2-1ab1b3e3` "tener" |
| haber | A1 `a1-1b94c09a` "haber" | A2 `a2-1b94c09a` "haber" |
| ser | A1 `a1-605d3374` "ser" | A2 `a2-605d3374` "ser" |
| encontrar | A1 `a1-cc04dcdc` "encontrar" | B1 `b1-e3795368` "encontrar (algo)" |
| precio | A1 `a1-363da8b7` "precio" | A2 `a2-363da8b7` "precio" |
| corto | A1 `a1-a523e566` "corto" | B2 `b2-2be975bf` "corto (metraje)" |
| lejos | A1 `a1-144962e3` "lejos (de)" | A1 `a1-96b5d8f2` "lejos" |
| a la derecha | A1 `a1-050bc4fe` "a la derecha (de)" | A1 `a1-058471a8` "a la derecha"; B1 `b1-050bc4fe` "a la derecha (de)" |
| a la izquierda | A1 `a1-1c3792cb` "a la izquierda (de)" | A1 `a1-e1ffea86` "a la izquierda"; B1 `b1-1c3792cb` "a la izquierda (de)" |
| al final | A1 `a1-0aab1f04` "al final (de)" | B1 `b1-0aab1f04` "al final (de)"; B1 `b1-74aa37b1` "al final" |
| entre | A1 `a1-ed7ad1f6` "entre" | A2 `a2-ed7ad1f6` "entre" |
| calle | A1 `a1-8f9f97eb` "calle" | A2 `a2-8f9f97eb` "calle" |
| caminar | A1 `a1-34f76036` "caminar" | B1 `b1-851c2e6d` "caminar" |
| antes | A1 `a1-cef4b5e9` "antes" | A2 `a2-cef4b5e9` "antes" |
| detrás | A1 `a1-1637f2cf` "detrás" | A2 `a2-ae85e826` "detrás (de)" |
| fin de semana | A1 `a1-285fbe53` "el fin de semana" | A1 `a1-341a5930` "fin de semana" |
| gafas | A1 `a1-959d918a` "gafas" | A2 `a2-959d918a` "gafas" |
| ver | A1 `a1-5e0b8aa1` "ver" | A2 `a2-5e0b8aa1` "ver"; B1 `b1-2fb779d3` "ver (algo)" |
| escuchar | A1 `a1-08571a9e` "escuchar" | A2 `a2-08571a9e` "escuchar" |
| naranja | A1 `a1-3cf34940` "naranja" | A2 `a2-3cf34940` "naranja" |
| viejo | A1 `a1-da6dfa2b` "viejo" | A2 `a2-da6dfa2b` "viejo" |
| salida | A1 `a1-0b38ae75` "salida" | A2 `a2-7ad19951` "salida" |
| cerrar | A1 `a1-13c4f05a` "cerrar" | B2 `b2-13c4f05a` "cerrar" |
| bueno | A1 `a1-28e5793a` "bueno" | A2 `a2-28e5793a` "bueno" |
| malo | A1 `a1-bf7cdc72` "malo" | A2 `a2-bf7cdc72` "malo" |
| bien | A1 `a1-5a32ead2` "(muy) bien" | A1 `a1-d4e2f608` "bien" |
| cambio | A1 `a1-3e178482` "cambio" | B1 `b1-93cf094f` "cambio" |
| ser moreno | A1 `a1-0f0b5b56` "ser moreno" | B1 `b1-f02ef2ac` "ser moreno (de piel)" |
| pintar | A1 `a1-48d4cd11` "pintar" | B1 `b1-6efb2f76` "pintar" |
| antiguo | A1 `a1-a8be1b78` "antiguo" | B1 `b1-bd17811d` "antiguo" |
| levantarse | A1 `a1-2e1b710d` "levantarse" | B1 `b1-2e1b710d` "levantarse" |
| inteligente | A1 `a1-a1d7da7c` "inteligente" | A2 `a2-33aa91b9` "inteligente" |
| serio | A1 `a1-ee6093af` "serio" | A2 `a2-76e69820` "serio" |
| edad | A1 `a1-287c5312` "edad" | B1 `b1-287c5312` "edad" |
| joven | A1 `a1-18ad3550` "joven" | A2 `a2-18ad3550` "joven" |
| familia | A1 `a1-3b660a83` "familia" | B2 `b2-3b660a83` "familia" |
| vino blanco | A1 `a1-98462fdf` "vino blanco" | A2 `a2-98462fdf` "vino blanco" |
| vino tinto | A1 `a1-57219a77` "vino tinto" | A2 `a2-57219a77` "vino tinto" |
| actividad | A1 `a1-5347c609` "actividad" | B1 `b1-5347c609` "actividad" |
| pregunta | A1 `a1-0524ae33` "pregunta" | A2 `a2-0524ae33` "pregunta" |
| entender | A1 `a1-42bd1643` "entender" | B1 `b1-42bd1643` "entender" |
| comprender | A1 `a1-15725a66` "comprender" | A2 `a2-4e747478` "comprender" |
| practicar | A1 `a1-6d611149` "practicar" | B1 `b1-6d611149` "practicar" |
| papel | A1 `a1-cb030c5e` "papel" | A2 `a2-cb030c5e` "papel" |
| trabajar | A1 `a1-5d26b8f2` "trabajar (en)" | A1 `a1-a4adaa62` "trabajar" |
| fax | A1 `a1-da41abc0` "fax" | A2 `a2-da41abc0` "fax" |
| correr | A1 `a1-43e97870` "correr" | A2 `a2-43e97870` "correr" |
| hacer deporte | A1 `a1-aa153cb1` "hacer deporte" | A2 `a2-aa153cb1` "hacer deporte" |
| hacer ejercicio | A1 `a1-94113f9f` "hacer ejercicio" | A2 `a2-94113f9f` "hacer ejercicio"; B2 `b2-94113f9f` "hacer ejercicio" |
| todavía | A1 `a1-ada4eb2a` "todavía" | B1 `b1-dc3c29a6` "todavía (no)" |
| hacer gimnasia | A1 `a1-127a0261` "hacer gimnasia" | A2 `a2-127a0261` "hacer gimnasia"; B2 `b2-127a0261` "hacer gimnasia" |
| televisión | A1 `a1-bf6e4067` "televisión" | A1 `a1-6316b04a` "televisión (TV)" |
| quiosco | A1 `a1-60439c2e` "quiosco" | A2 `a2-60439c2e` "quiosco" |
| duro | A1 `a1-ca4f31ae` "duro" | B2 `b2-53af8c2c` "duro" |
| jardín | A1 `a1-152b0c98` "jardín" | A2 `a2-152b0c98` "jardín" |
| ducha | A1 `a1-976df5d6` "ducha" | A2 `a2-976df5d6` "ducha" |
| dvd | A1 `a1-a61906a1` "DVD" | A2 `a2-a61906a1` "DVD" |
| tarjeta | A1 `a1-a4f56575` "tarjeta (de crédito)" | A1 `a1-c1048c64` "tarjeta" |
| billete | A1 `a1-4f28f744` "billete" | A2 `a2-4f28f744` "billete" |
| publicidad | A1 `a1-701e7d7e` "publicidad" | A2 `a2-701e7d7e` "publicidad" |
| carretera | A1 `a1-157a7200` "carretera" | A2 `a2-157a7200` "carretera" |
| entrevista | A1 `a1-4f47cb40` "entrevista" | B1 `b1-24c11764` "entrevista" |
| aparcamiento | A1 `a1-98736edd` "aparcamiento" | B1 `b1-98736edd` "aparcamiento" |
| presidente | A1 `a1-5cfbb084` "presidente" | A2 `a2-5cfbb084` "presidente" |
| edificio | A1 `a1-affe4c6c` "edificio" | A2 `a2-affe4c6c` "edificio" |
| monumento | A1 `a1-b4b82088` "monumento" | A2 `a2-b4b82088` "monumento" |
| catedral | A1 `a1-6c351bdc` "catedral" | A2 `a2-6c351bdc` "catedral" |
| iglesia | A1 `a1-f163153f` "iglesia" | A2 `a2-f163153f` "Iglesia" |
| cristiano | A1 `a1-1ce45b47` "cristiano" | B1 `b1-1ce45b47` "cristiano" |
| centro comercial | A1 `a1-a34acec5` "centro comercial" | A2 `a2-a34acec5` "centro comercial" |
| colegio | A1 `a1-a1f9819c` "colegio" | A2 `a2-a1f9819c` "colegio" |
| barrio | A1 `a1-2ce33323` "barrio" | A2 `a2-2ce33323` "barrio" |
| azúcar | A1 `a1-59c21812` "azúcar" | A2 `a2-59c21812` "azúcar" |
| gracias | A1 `a1-a30b3970` "gracias" | B1 `b1-a30b3970` "gracias" |
| hueso | A1 `a1-72cd55ac` "hueso" | B2 `b2-e7d715d8` "hueso" |
| buzón | A1 `a1-c25345c1` "buzón" | B1 `b1-a12f41f5` "buzón (de correos)" |
| entrenar | A1 `a1-6fcb40ad` "entrenar(se)" | A1 `a1-cdd20898` "entrenar" |
| estar sentado | A2 `a2-cf732fea` "estar sentado" | B1 `b1-cf732fea` "estar sentado" |
| distancia | A2 `a2-a4b3d4fc` "distancia" | B1 `b1-a4b3d4fc` "distancia" |
| total | A2 `a2-d515331b` "total" | B2 `b2-5a537e20` "total" |
| grupo | A2 `a2-d1df2f5f` "grupo" | B1 `b1-3acd56d5` "grupo (musical)" |
| hace un momento | A2 `a2-91494565` "hace un momento" | B1 `b1-91494565` "hace un momento" |
| ya | A2 `a2-e92fc4e2` "ya" | B1 `b1-6a42348f` "ya (no)"; B2 `b2-e92fc4e2` "ya" |
| espacio | A2 `a2-83097082` "espacio" | B2 `b2-6e1e6776` "espacio" |
| estación | A2 `a2-927c75cc` "estación (del año)" | B1 `b1-927c75cc` "estación (del año)" |
| toda la mañana | A2 `a2-fbff2020` "toda la mañana" | B2 `b2-fbff2020` "toda la mañana" |
| todo el día | A2 `a2-feb62f38` "todo el día" | B2 `b2-feb62f38` "todo el día" |
| cuadrado | A2 `a2-80e7adc1` "cuadrado" | B1 `b1-80e7adc1` "cuadrado" |
| caer | A2 `a2-dfa5ab80` "caer" | A2 `a2-fa768f5e` "caer(se)" |
| parar | A2 `a2-6aadcb2f` "parar(se)" | A2 `a2-56b62493` "parar" |
| orden | A2 `a2-3712246f` "orden" | A2 `a2-4c1fb51a` "(des)orden" |
| primero | A2 `a2-957fb763` "primero" | B1 `b1-a8f63ebb` "(el) primero" |
| útil | A2 `a2-d16c8b5e` "útil" | B1 `b1-d16c8b5e` "útil" |
| santo | A2 `a2-24271fc5` "santo" | B2 `b2-ca066736` "santo" |
| oído | A2 `a2-e0bea26f` "oído" | B2 `b2-e0bea26f` "oído" |
| crecer | A2 `a2-c722afa1` "crecer" | B1 `b1-c722afa1` "crecer"; B2 `b2-c722afa1` "crecer" |
| prefijo | A2 `a2-85d51065` "prefijo" | B1 `b1-85d51065` "prefijo" |
| futuro | A2 `a2-b0aea6e6` "futuro" | B2 `b2-daa24f33` "futuro" |
| receta | A2 `a2-7c712919` "receta" | B1 `b1-7c712919` "receta" |
| línea | A2 `a2-a017d361` "línea" | B1 `b1-55ebd3c1` "línea (ocupada)" |
| aprobar | A2 `a2-decfe095` "aprobar" | B1 `b1-c1933634` "aprobar" |
| historia | A2 `a2-64c2b8d9` "Historia" | B1 `b1-64c2b8d9` "historia" |
| adivinar | A2 `a2-f9d0eba6` "adivinar" | B1 `b1-f9d0eba6` "adivinar" |
| funcionario | A2 `a2-3802bbe7` "funcionario" | B1 `b1-3802bbe7` "funcionario" |
| ropa de trabajo | A2 `a2-d7e4635f` "Ropa de trabajo" | B1 `b1-d7e4635f` "Ropa de trabajo"; B2 `b2-d7e4635f` "Ropa de trabajo" |
| tomar una copa | A2 `a2-03bd8995` "tomar una copa" | B1 `b1-03bd8995` "tomar una copa" |
| musical | A2 `a2-fe0feb3c` "musical" | A2 `a2-7f70a3ce` "(un) musical" |
| montar en bicicleta | A2 `a2-55b16311` "montar en bicicleta" | B1 `b1-55b16311` "montar en bicicleta" |
| hacer senderismo | A2 `a2-5505b787` "hacer senderismo" | B1 `b1-5505b787` "hacer senderismo" |
| enviar | A2 `a2-d22aed21` "enviar" | B1 `b1-d22aed21` "enviar" |
| dejar un mensaje | A2 `a2-8876f906` "dejar un mensaje" | B1 `b1-8876f906` "dejar un mensaje" |
| virus | A2 `a2-68bb75d2` "virus" | B1 `b1-a279db67` "virus" |
| propietario | A2 `a2-3ed65aec` "propietario" | B1 `b1-3ed65aec` "propietario" |
| victoria | A2 `a2-21f542d3` "victoria" | B2 `b2-d714d845` "victoria" |
| hacer la compra | A2 `a2-52b6f359` "hacer la compra" | B1 `b1-52b6f359` "hacer la compra" |
| especial | A2 `a2-309a93d9` "especial" | B2 `b2-569b1c7e` "especial" |
| idea | A2 `a2-0a73baf2` "idea" | B2 `b2-76625061` "idea" |
| botas | A2 `a2-13c9bd54` "botas" | A2 `a2-985b3b2d` "botas (de montaña)"; B1 `b1-13c9bd54` "botas" |
| pagar en efectivo | A2 `a2-a0ab4edf` "pagar en efectivo" | B1 `b1-a0ab4edf` "pagar en efectivo" |
| urgencias | A2 `a2-f39ea4a8` "urgencias" | B1 `b1-f39ea4a8` "urgencias" |
| paciente | A2 `a2-43e092fb` "(im)paciente" | A2 `a2-238dcada` "paciente" |
| montar en moto | A2 `a2-5e8daa07` "montar en moto" | B1 `b1-5e8daa07` "montar en moto" |
| cheque | A2 `a2-ba743803` "cheque" | B1 `b1-82e7c1fa` "cheque (de viaje)"; B1 `b1-e0300c7d` "cheque" |
| empleado | A2 `a2-f9f011a5` "empleado" | B1 `b1-f9f011a5` "empleado" |
| cordero | A2 `a2-99c93466` "cordero" | B1 `b1-99c93466` "cordero" |
| educación | A2 `a2-359dd51a` "educación" | B1 `b1-1a907bfd` "educación" |
| ejército | A2 `a2-3c0071dc` "ejército" | B2 `b2-3c0071dc` "ejército" |
| cuento | A2 `a2-5949d2e9` "cuento" | B1 `b1-5949d2e9` "cuento" |
| cámara | A2 `a2-fc3a47fb` "cámara (de fotos)" | A2 `a2-0d07f0eb` "cámara" |
| recordar | A2 `a2-421558bc` "recordar" | B2 `b2-af4d702a` "recordar" |
| olvidar | A2 `a2-7f856203` "olvidar" | B2 `b2-29630133` "olvidar" |
| señal | A2 `a2-56cb77b8` "señal" | B2 `b2-4900b120` "señal (de tráfico)" |
| dividir | B1 `b1-377dc534` "dividir" | B2 `b2-377dc534` "dividir" |
| calentar | B1 `b1-29c9fbfd` "calentar(se)" | B2 `b2-51bc100b` "calentar" |
| al principio | B1 `b1-bd0f7746` "al principio (de)" | B1 `b1-2f137e76` "al principio" |
| aniversario | B1 `b1-1e29c190` "aniversario" | B2 `b2-1e29c190` "aniversario" |
| día festivo | B1 `b1-04dcaa43` "día festivo" | B2 `b2-04dcaa43` "día festivo" |
| día laborable | B1 `b1-bdb8cb52` "día laborable" | B2 `b2-bdb8cb52` "día laborable" |
| presente | B1 `b1-88b7ff90` "presente" | B2 `b2-88b7ff90` "presente" |
| montar un negocio | B1 `b1-61967e4c` "montar un negocio" | B2 `b2-61967e4c` "montar un negocio" |
| recto | B1 `b1-1e07b9ee` "recto" | B2 `b2-5190b193` "(estar) recto" |
| aluminio | B1 `b1-2ef63117` "aluminio" | B2 `b2-2ef63117` "aluminio" |
| organización | B1 `b1-6079e6cf` "(des)organización" | B1 `b1-70b1b0c1` "organización" |
| dar igual | B1 `b1-ca2961bc` "dar igual" | B2 `b2-ca2961bc` "dar igual" |
| expresión | B1 `b1-086720f7` "expresión" | B2 `b2-086720f7` "expresión" |
| callado | B1 `b1-468e31e0` "callado" | B2 `b2-468e31e0` "callado" |
| postura | B1 `b1-ce2dcbde` "postura" | B2 `b2-ce2dcbde` "postura" |
| estar deprimido | B1 `b1-afec8d9e` "estar deprimido" | B2 `b2-afec8d9e` "estar deprimido" |
| cansarse | B1 `b1-a8bac81b` "cansarse" | B2 `b2-a8bac81b` "cansarse" |
| recién nacido | B1 `b1-2307a1ca` "recién nacido" | B2 `b2-2307a1ca` "recién nacido" |
| anciano | B1 `b1-a2c88df8` "anciano" | B2 `b2-a2c88df8` "anciano" |
| separación | B1 `b1-0f65a52e` "separación" | B2 `b2-0f65a52e` "separación" |
| insistir | B1 `b1-ca59ff32` "insistir" | B2 `b2-66fae76b` "insistir (en)" |
| fiesta de disfraces | B1 `b1-c0f4eb09` "fiesta de disfraces" | B2 `b2-c0f4eb09` "fiesta de disfraces" |
| producto natural | B1 `b1-493fe980` "producto natural" | B2 `b2-493fe980` "producto natural" |
| sabor agradable | B1 `b1-0e3d5738` "sabor agradable" | B2 `b2-9b7f2330` "sabor (des)agradable" |
| equivocarse | B1 `b1-7d8414fd` "equivocarse" | B2 `b2-7d8414fd` "equivocarse" |
| hacer una presentación | B1 `b1-61d54209` "hacer una presentación" | B2 `b2-61d54209` "hacer una presentación" |
| demanda | B1 `b1-d961e8aa` "demanda" | B2 `b2-d961e8aa` "demanda" |
| firmar un contrato | B1 `b1-93f009cf` "firmar un contrato" | B2 `b2-de64699e` "firmar un contrato (de alquiler)" |
| poner una película | B1 `b1-f85a02d4` "poner una película" | B2 `b2-f85a02d4` "poner una película" |
| comentario | B1 `b1-c248c235` "comentario" | B2 `b2-c248c235` "comentario" |
| informar | B1 `b1-f76d1e3d` "informar" | B2 `b2-9a34b25e` "informar(se)"; B2 `b2-f76d1e3d` "informar" |
| comunicarse con alguien por correo | B1 `b1-ede5c5f0` "comunicarse con alguien por correo (electrónico)" | B1 `b1-5d801ef4` "comunicarse con alguien por correo" |
| justo | B1 `b1-36e96341` "(in)justo" | B1 `b1-34af5447` "justo" |
| debate | B1 `b1-26fee417` "debate" | B2 `b2-26fee417` "debate" |
| florero | B1 `b1-e7c93042` "florero" | B2 `b2-e7c93042` "florero" |
| salida de emergencia | B1 `b1-8a28a9f0` "salida de emergencia" | B2 `b2-8a28a9f0` "salida de emergencia" |
| garantía | B1 `b1-f2b946b7` "garantía" | B2 `b2-f2b946b7` "garantía" |
| estar de oferta | B1 `b1-4ef4b2bc` "estar de oferta" | B2 `b2-4ef4b2bc` "estar de oferta" |
| tener garantía | B1 `b1-90e3eee8` "tener garantía" | B2 `b2-90e3eee8` "tener garantía" |
| estar caducado | B1 `b1-205bf8ca` "estar caducado" | B2 `b2-205bf8ca` "estar caducado" |
| estar de baja | B1 `b1-d03542b9` "estar de baja" | B2 `b2-d03542b9` "estar de baja" |
| estar agotado | B1 `b1-27a13d0a` "estar agotado" | B2 `b2-27a13d0a` "estar agotado" |
| termómetro | B1 `b1-fdc75ba3` "termómetro" | B2 `b2-fdc75ba3` "termómetro" |
| hacer un crucero | B1 `b1-6287b8d8` "hacer un crucero" | B2 `b2-6287b8d8` "hacer un crucero" |
| fila | B1 `b1-47a5d765` "fila" | B2 `b2-47a5d765` "fila" |
| hacer escala | B1 `b1-4b49a06d` "hacer escala" | B2 `b2-4b49a06d` "hacer escala" |
| policía de tráfico | B1 `b1-5d8e4b67` "policía de tráfico" | B2 `b2-5d8e4b67` "policía de tráfico" |
| hipoteca | B1 `b1-0d3e9377` "hipoteca" | B2 `b2-0d3e9377` "hipoteca" |
| producción | B1 `b1-63746892` "producción" | B2 `b2-63746892` "producción" |
| construcción | B1 `b1-3098cc7e` "construcción" | B2 `b2-3098cc7e` "construcción" |
| físico | B1 `b1-325f0c41` "físico" | B2 `b2-325f0c41` "físico" |
| químico | B1 `b1-73672bba` "químico" | B2 `b2-73672bba` "químico" |
| historiador | B1 `b1-bf4d96d5` "historiador" | B2 `b2-bf4d96d5` "historiador" |
| ciudadano | B1 `b1-2d3e9a4b` "ciudadano" | B1 `b1-2d2f971f` "ciudadano(s)" |
| historia contemporánea | B1 `b1-34fe5d0a` "historia contemporánea" | B2 `b2-34fe5d0a` "Historia Contemporánea" |
| ley | B1 `b1-afa13919` "ley" | B2 `b2-afa13919` "ley" |
| general | B1 `b1-dfe2db74` "general" | B2 `b2-dfe2db74` "general" |
| universal | B1 `b1-da5f51a1` "universal" | B2 `b2-da5f51a1` "universal" |
| huerta | B1 `b1-888b4cb3` "huerta" | B2 `b2-888b4cb3` "huerta" |
| raíz | B1 `b1-fd002ada` "raíz" | B2 `b2-fd002ada` "raíz" |
| contenedor de papel | B1 `b1-ad5ce72c` "contenedor de papel" | B2 `b2-ad5ce72c` "contenedor de papel" |
| contenedor de vidrio | B1 `b1-e4cf1d0f` "contenedor de vidrio" | B2 `b2-e4cf1d0f` "contenedor de vidrio" |
| recursos naturales | B1 `b1-fd67333b` "recursos naturales" | B2 `b2-fd67333b` "recursos naturales" |
| helar | B2 `b2-ba600bf7` "helar(se)" | B2 `b2-a413d2d8` "helar" |
| colocado | B2 `b2-ee75ed6c` "colocado" | B2 `b2-b5daf6eb` "(des)colocado" |
| doblado | B2 `b2-bb7a52f8` "(estar) doblado" | B2 `b2-df08f5d4` "doblado" |
| alejado | B2 `b2-97b19f7b` "alejado (de)" | B2 `b2-13da3ced` "alejado" |
| aislado | B2 `b2-664f2086` "aislado (de)" | B2 `b2-545f67ac` "aislado" |
| por delante | B2 `b2-9650f06d` "por delante (de)" | B2 `b2-6c739193` "por delante" |
| por detrás | B2 `b2-ea118c13` "por detrás (de)" | B2 `b2-c4ac90c0` "por detrás" |
| por el principio | B2 `b2-398ec7a8` "por el principio (de)" | B2 `b2-20df41c0` "por el principio" |
| por el final | B2 `b2-5333d3fd` "por el final (de)" | B2 `b2-44fe0602` "por el final" |
| por arriba | B2 `b2-7d4024a5` "por arriba (de)" | B2 `b2-ca1d15cd` "por arriba" |
| estabilidad | B2 `b2-54568480` "(in)estabilidad" | B2 `b2-82766bc8` "estabilidad" |
| estar de moda | B2 `b2-cce9aae3` "estar de moda" | B2 `b2-53ebbdc0` "estar (pasado) de moda" |
| aún | B2 `b2-64cc155f` "aún (no)" | B2 `b2-b9e1a24c` "aún" |
| puntualidad | B2 `b2-da3b4c76` "puntualidad" | B2 `b2-912d12ed` "(im)puntualidad" |
| ángulo | B2 `b2-7fac8c08` "ángulo" | B2 `b2-d0ea5642` "ángulo (recto)" |
| invertir | B2 `b2-a0979246` "invertir" | B2 `b2-c5295542` "invertir (en)" |
| tener facilidad para | B2 `b2-876c09dc` "tener facilidad para" | B2 `b2-81c31c85` "tener facilidad(es) para" |
| tener facilidad con | B2 `b2-41cfb9d0` "tener facilidad con" | B2 `b2-26dec75c` "tener facilidad(es) con" |
| reflexionar | B2 `b2-6c387e68` "reflexionar (sobre)" | B2 `b2-681d2ea1` "reflexionar" |
| discreto | B2 `b2-9644293a` "(in)discreto" | B2 `b2-369ddfed` "discreto" |
| sensibilidad | B2 `b2-afcb740d` "(in)sensibilidad" | B2 `b2-aee493f3` "sensibilidad" |
| redactor | B2 `b2-0e4b2b12` "redactor (jefe)" | B2 `b2-c7f560ae` "redactor" |
| hacer una transferencia | B2 `b2-94575acf` "hacer una transferencia (bancaria)" | B2 `b2-e2b8a3b4` "hacer una transferencia" |
| fórmula | B2 `b2-cad89b0b` "fórmula" | B2 `b2-f29d692d` "fórmula (matemática)" |
