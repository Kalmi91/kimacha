#!/usr/bin/env node
/**
 * audit-plan.mjs — Generate audit-plan.md from current P1 report
 * Task 13b — FB3 hybrid phase 1
 * Run: node scripts/audit-plan.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Parse audit-report.md to extract P1 issues
// ---------------------------------------------------------------------------

const report = readFileSync(join(ROOT, 'scripts/audit-report.md'), 'utf8');

const issues = [];
let cur = null;
for (const line of report.split('\n')) {
  const cardMatch = line.match(/\*\*Card (\d+)\*\* \(topic: `([^`]+)`, order: (\d+)\)/);
  if (cardMatch) {
    cur = { id: parseInt(cardMatch[1]), topic: cardMatch[2], order: parseInt(cardMatch[3]) };
    continue;
  }
  if (cur && line.match(/  - `[^`]+`/) && !line.includes('Missing')) {
    const m = line.match(/`([^`]+)`/);
    if (m) cur.sentence = m[1];
    continue;
  }
  if (cur && line.includes('Missing:')) {
    cur.missing = line.replace(/.*Missing:\s*/, '').split(', ').map(t => t.replace(/`/g, '').trim());
    issues.push(cur);
    cur = null;
  }
}

// ---------------------------------------------------------------------------
// Aggregate: unique token → { count, cards[], levels[] }
// ---------------------------------------------------------------------------

const tokenMap = new Map(); // token → { count, cards, levels }

for (const issue of issues) {
  for (const tok of issue.missing) {
    if (!tokenMap.has(tok)) {
      tokenMap.set(tok, { count: 0, cards: [], levels: new Set() });
    }
    const entry = tokenMap.get(tok);
    entry.count++;
    entry.cards.push(issue.id);
    entry.levels.add(issue.topic === 'A0' ? 'A0' : 'A1');
  }
}

// ---------------------------------------------------------------------------
// Topic hints for ADD_CARD suggestions
// ---------------------------------------------------------------------------

const TOPIC_HINTS = {
  // numbers
  'dos': 'numeros', 'tres': 'numeros', 'cinco': 'numeros', 'veintiocho': 'numeros',
  'setenta': 'numeros', 'ciento': 'numeros', 'anos': 'numeros',
  // food/drink
  'dulce': 'comida', 'dulces': 'comida', 'ricas': 'comida', 'rico': 'comida',
  'oliva': 'comida', 'pastel': 'comida', 'parrilla': 'comida', 'natural': 'comida',
  'fritas': 'comida', 'llorar': 'comida',
  // clothing
  'lana': 'ropa', 'cuero': 'ropa', 'invierno': 'ropa', 'verano': 'clima',
  // climate/weather
  'llueve': 'clima', 'verano': 'clima', 'invierno': 'clima', 'caluroso': 'clima',
  'suena': 'clima', 'brilla': 'clima', 'carretera': 'clima',
  // body
  'duele': 'cuerpo', 'dolor': 'cuerpo', 'seca': 'cuerpo', 'secos': 'cuerpo',
  'rojas': 'cuerpo', 'daño': 'cuerpo',
  // transport
  'coche': 'transporte', 'coches': 'transporte', 'bus': 'transporte', 'sur': 'transporte',
  'ruido': 'transporte', 'funciona': 'transporte', 'pinchada': 'transporte',
  // house
  'abierta': 'casa', 'abro': 'casa', 'enciendo': 'casa', 'encuentro': 'casa',
  'rota': 'casa', 'tele': 'casa', 'final': 'casa', 'lavo': 'lavarse/casa',
  // city
  'derecha': 'ciudad', 'derecho': 'ciudad', 'antigua': 'ciudad', 'rio': 'ciudad',
  'giro': 'ciudad',
  // family
  'familia': 'familia', 'cuna': 'familia', 'novia': 'emociones',
  // professions
  'empresa': 'profesiones', 'jefe': 'profesiones', 'noticia': 'profesiones',
  // leisure
  'verano': 'clima', 'invierno': 'clima', 'playa': 'viajes', 'bosque': 'viajes',
  'montaña': 'viajes', 'montañas': 'viajes',
  // office
  'carpeta': 'oficina_trabajo', 'paginas': 'oficina_trabajo',
  // emotions
  'examen': 'emociones', 'pregunta': 'emociones', 'error': 'emociones',
  'orgulloso': 'emociones',
  // animals
  'hierba': 'animales', 'campo': 'animales', 'granja': 'animales',
  'bosque': 'animales', 'desierto': 'animales',
  // misc
  'restaurante': 'restaurante', 'flores': 'casa', 'clase': 'presente_ar',
  'vacaciones': 'ir_a_inf', 'tres': 'numeros', 'dos': 'numeros',
};

// ---------------------------------------------------------------------------
// Classify: ADD_CARD vs REWRITE
// ---------------------------------------------------------------------------

// Tokens that are clearly ADD_CARD candidates (common, A1-level vocabulary)
const ADD_CARD_TOKENS = new Set([
  // numbers/time
  'dos', 'tres', 'cinco', 'ciento', 'setenta', 'veintiocho', 'anos',
  // seasons/weather
  'verano', 'invierno', 'llueve', 'caluroso', 'brilla', 'suena', 'carretera',
  // transport/place
  'coche', 'coches', 'bus', 'sur', 'ruido', 'funciona', 'pinchada',
  // food/restaurant
  'restaurante', 'dulce', 'dulces', 'rico', 'ricas', 'oliva', 'pastel', 'fritas', 'parrilla', 'natural',
  // people/family
  'familia', 'novia',
  // city/house
  'ciudad', 'ciudades', 'derecha', 'derecho', 'abierta', 'abro', 'enciendo', 'encuentro', 'tele',
  'final', 'lavo', 'rota',
  // body/health
  'duele', 'dolor', 'seca', 'secos', 'rojas',
  // clothing/material
  'lana', 'cuero', 'ropa',
  // school/work
  'empresa', 'jefe', 'clase', 'examen', 'noticia', 'error', 'pregunta', 'paginas',
  // nature/animals
  'flores', 'hierba', 'campo', 'granja', 'desierto', 'bosque', 'montana', 'playa',
  // leisure
  'vacaciones', 'verano',
  // misc common
  'amable', 'empieza', 'pasa', 'ciudad', 'llevo', 'lleva', 'tomo',
]);

function classifyToken(tok, count, levels) {
  const stripped = tok.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Digits, emails, special tokens → REWRITE (sentence-level fix)
  if (/\d/.test(tok) || tok.includes('@')) return 'REWRITE';
  if (ADD_CARD_TOKENS.has(stripped)) return 'ADD_CARD';
  // If only appears once and no clear topic → REWRITE
  if (count === 1) return 'REWRITE';
  return 'ADD_CARD';
}

// ---------------------------------------------------------------------------
// Generate plan
// ---------------------------------------------------------------------------

const tokensSorted = [...tokenMap.entries()].sort((a, b) => b[1].count - a[1].count);

let plan = `# Audit Plan — P1 Remaining Tokens\n\n`;
plan += `Generated: ${new Date().toISOString()}\n`;
plan += `P1 card issues: **${issues.length}** (after v2 tolerance rules)\n\n`;

plan += `## Token Action List\n\n`;
plan += `| Token | Count | Level(s) | Action | Topic/Note |\n`;
plan += `|---|---|---|---|---|\n`;

let addCardCount = 0;
let rewriteCount = 0;
const rewriteCards = new Set();
const addCardTokens = [];

for (const [tok, { count, cards, levels }] of tokensSorted) {
  const levelStr = [...levels].join('+');
  const action = classifyToken(tok, count, levels);
  const topicHint = TOPIC_HINTS[tok.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] || '';
  plan += `| \`${tok}\` | ${count} | ${levelStr} | ${action} | ${topicHint} |\n`;
  if (action === 'ADD_CARD') {
    addCardCount++;
    addCardTokens.push(tok);
    for (const id of cards) rewriteCards.add(id); // cards needing this new word
  } else {
    rewriteCount++;
    for (const id of cards) rewriteCards.add(id);
  }
}

plan += `\n## Cards with P1 Issues\n\n`;
plan += `| Card | Topic | Missing Tokens | Action |\n`;
plan += `|---|---|---|---|\n`;
for (const issue of issues) {
  const actions = issue.missing.map(tok => {
    const entry = tokenMap.get(tok);
    return classifyToken(tok, entry ? entry.count : 1, entry ? entry.levels : new Set());
  });
  const dominant = actions.includes('ADD_CARD') ? 'ADD_CARD' : 'REWRITE';
  plan += `| ${issue.id} | \`${issue.topic}\` | ${issue.missing.map(t => `\`${t}\``).join(', ')} | ${dominant} |\n`;
}

// Count A0 vs A1 rewrite cards
const a0IssueCards = issues.filter(i => i.topic === 'A0');
const a1IssueCards = issues.filter(i => i.topic !== 'A0');

plan += `\n## Summary\n\n`;
plan += `- **ADD_CARD candidates**: ${addCardCount} unique tokens\n`;
plan += `- **REWRITE candidates**: ${rewriteCount} unique tokens\n`;
plan += `- Total P1 card issues: ${issues.length}\n`;
plan += `  - A0 level: ${a0IssueCards.length} cards\n`;
plan += `  - A1 level: ${a1IssueCards.length} cards\n`;

const planPath = join(ROOT, 'scripts/audit-plan.md');
writeFileSync(planPath, plan, 'utf8');

console.log('Audit plan generated: scripts/audit-plan.md');
console.log(`Tokens: ${tokensSorted.length} unique`);
console.log(`ADD_CARD: ${addCardCount}, REWRITE: ${rewriteCount}`);
console.log(`P1 card issues: ${issues.length} (A0: ${a0IssueCards.length}, A1: ${a1IssueCards.length})`);
