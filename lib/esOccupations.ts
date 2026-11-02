// The feminine of the person nouns of the corpus (occupations, roles), for the "learned words only" gate
// (lib/knownSentence.ts): a learner who knows "el secretario" reads "la secretaria". NOT a general rule: a noun
// ending in -o is not a person in general (el libro), so only the masculine forms hand-checked in this list give a
// feminine, and only when the masculine card itself is learned. The list is scoped to the person nouns of
// data/words-open/*.json (pos === 'noun'); a noun whose feminine is the same word (el estudiante, el dentista,
// el cantante, el periodista) is not here, and neither is one the corpus has its own feminine card for (el amigo).
// A pure module: no imports.

// -o → -a
const MASCULINE_O = [
  'ingeniero mesero abogado invitado cajero mecánico carpintero plomero campesino panadero carnicero científico',
  'arquitecto pasajero inquilino jardinero marinero veterinario psicólogo fotógrafo peluquero portero secretario',
  'empleado viudo socio ciudadano candidato obrero zapatero farmacéutico verdulero becario barrendero notario',
  'funcionario empresario encargado diputado aficionado ejecutivo bombero huérfano anciano viajero mensajero',
  'usuario árbitro cartero librero pastelero herrero cocinero ministro',
].join(' ');

// -or → -ora
const MASCULINE_OR = [
  'escritor jugador pescador repartidor contador pintor diseñador programador traductor comprador consumidor',
  'gobernador espectador ganador desarrollador reclutador administrador asesor proveedor empleador director autor',
  'entrenador gestor supervisor coordinador seguidor vendedor trabajador',
].join(' ');

// The pairs that go their own way.
const OTHER: Record<string, string> = {
  bailarín: 'bailarina',
  alcalde: 'alcaldesa',
  jefe: 'jefa',
  presidente: 'presidenta',
  juez: 'jueza',
  cliente: 'clienta',
  patrón: 'patrona',
};

const FEMININE = new Map<string, string>([
  ...MASCULINE_O.split(' ').map((m): [string, string] => [m, `${m.slice(0, -1)}a`]),
  ...MASCULINE_OR.split(' ').map((m): [string, string] => [m, `${m}a`]),
  ...Object.entries(OTHER),
]);

/** The feminine singular of a listed masculine person noun, or null (the plural is `esPlural` of it). */
export function occupationFeminine(masculine: string): string | null {
  return FEMININE.get(masculine) ?? null;
}
