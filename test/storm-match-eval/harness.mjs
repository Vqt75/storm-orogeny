// STORM MATCH — HARNAIS D'ÉVALUATION (audit-only)
//
// Exécute le VRAI moteur (public/ivory/faq-engine.js, matchFaq) contre
// le corpus versionné (corpus.js), sur les 112 vraies questions
// d'Équinoxe (src/db/seedDemo.js, QUESTIONS, importées directement --
// jamais une copie qui pourrait dériver). Aucune base de données
// requise -- entièrement offline, déterministe, reproductible.
//
// Usage : node test/storm-match-eval/harness.mjs
// Sortie : rapport texte sur stdout (tableau de métriques + exemples).
//
// Ne modifie rien, n'écrit rien -- audit-only, comme demandé.

import { matchFaq, scoreEntry } from '../../public/ivory/faq-engine.js';
import { QUESTIONS } from '../../src/db/seedDemo.js';
import { CANONICAL_ENTRIES, OUT_OF_CORPUS_QUERIES } from './corpus.js';

// Reconstruit exactement la forme produite par compileQuestions() en
// production (src/domain/publication/compiler.js) : {id, title,
// answer} uniquement -- jamais de keywords/phrases/category/priority,
// pour que ce harnais teste RÉELLEMENT ce que Storm Match voit en
// production, pas une version enrichie artificiellement. id
// déterministe (index), jamais un UUID -- corpus reproductible.
const faqItems = QUESTIONS.map(([question, answer], i) => ({
  id: `q-${i}`,
  title: question,
  answer
}));

const titleToId = new Map(faqItems.map(item => [item.title, item.id]));

const FORMULATION_TYPES = [
  'nearIdentical', 'naturalParaphrase', 'conversational', 'short',
  'synonym', 'differentVocab', 'imperfectSyntax', 'typo', 'keywordsOnly'
];
// 'ambiguous' traité à part -- pas de bonne réponse garantie par
// construction, mesuré séparément (voir plus bas).

const results = { byType: {}, ambiguous: [], outOfCorpus: [], failures: [], surprisingSuccesses: [], dangerousFalsePositives: [], excessiveAbstentions: [] };

for (const type of FORMULATION_TYPES) results.byType[type] = { total: 0, top1: 0, top3: 0, abstained: 0 };

function top3Ids(question) {
  const scored = faqItems
    .map(entry => ({ entry, score: scoreEntry(question, entry) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map(s => s.entry.id);
}

// ── Évaluation des formulations canoniques ──────────────────────────
for (const canonical of CANONICAL_ENTRIES) {
  const expectedId = titleToId.get(canonical.canonicalQuestion);
  if (!expectedId) throw new Error(`Question canonique introuvable dans QUESTIONS : ${canonical.canonicalQuestion}`);

  for (const type of FORMULATION_TYPES) {
    const query = canonical.formulations[type];
    const result = matchFaq(query, faqItems);
    const stats = results.byType[type];
    stats.total++;

    if (result === null) {
      stats.abstained++;
      results.excessiveAbstentions.push({ type, query, expected: canonical.canonicalQuestion });
      continue;
    }

    if (result.id === expectedId) {
      stats.top1++;
      // Réussite « surprenante » : formulation très éloignée
      // (conversationnelle, faute, synonyme, différent vocabulaire)
      // qui trouve quand même la bonne réponse.
      if (['conversational', 'typo', 'synonym', 'differentVocab'].includes(type)) {
        results.surprisingSuccesses.push({ type, query, matched: result.title });
      }
    } else {
      results.failures.push({ type, query, expected: canonical.canonicalQuestion, got: result.title, score: scoreEntry(query, result) });
      // Faux positif dangereux : une réponse SUBSTANTIELLEMENT
      // différente est retournée avec une confiance élevée (score
      // fort) alors que ce n'est pas la bonne -- risque réel
      // d'induire en erreur un collaborateur avec assurance.
      const score = scoreEntry(query, result);
      if (score >= 28) {
        results.dangerousFalsePositives.push({ type, query, expected: canonical.canonicalQuestion, got: result.title, score });
      }
    }

    if (top3Ids(query).includes(expectedId)) stats.top3++;
  }

  // ── Ambiguïté : mesuré à part, jamais compté comme un échec Top-1 ──
  const ambiguousQuery = canonical.formulations.ambiguous;
  const ambiguousResult = matchFaq(ambiguousQuery, faqItems);
  results.ambiguous.push({
    query: ambiguousQuery,
    expectedFamily: canonical.canonicalQuestion,
    outcome: ambiguousResult ? ambiguousResult.title : 'ABSTAINED',
    correct: ambiguousResult ? ambiguousResult.id === expectedId : null
  });
}

// ── Hors-corpus : doit toujours abstenir ────────────────────────────
for (const query of OUT_OF_CORPUS_QUERIES) {
  const result = matchFaq(query, faqItems);
  results.outOfCorpus.push({ query, outcome: result ? result.title : 'ABSTAINED', falsePositive: result !== null });
}

// ── Rapport ──────────────────────────────────────────────────────────
console.log('='.repeat(78));
console.log('STORM MATCH — RAPPORT D\'ÉVALUATION (moteur actuel, corpus Équinoxe)');
console.log('='.repeat(78));
console.log(`Corpus : ${faqItems.length} questions réelles (Équinoxe) — ${CANONICAL_ENTRIES.length} canoniques testées`);
console.log(`Requêtes d'évaluation : ${CANONICAL_ENTRIES.length * FORMULATION_TYPES.length} formulations + ${CANONICAL_ENTRIES.length} ambiguës + ${OUT_OF_CORPUS_QUERIES.length} hors-corpus = ${CANONICAL_ENTRIES.length * FORMULATION_TYPES.length + CANONICAL_ENTRIES.length + OUT_OF_CORPUS_QUERIES.length}\n`);

console.log('--- Tableau de métriques par type de formulation ---\n');
console.log('Type'.padEnd(20), 'Requêtes'.padStart(9), 'Top-1'.padStart(8), 'Top-3'.padStart(8), 'Abstention'.padStart(11));
for (const type of FORMULATION_TYPES) {
  const s = results.byType[type];
  const top1Pct = ((s.top1 / s.total) * 100).toFixed(1) + '%';
  const top3Pct = ((s.top3 / s.total) * 100).toFixed(1) + '%';
  const abstPct = ((s.abstained / s.total) * 100).toFixed(1) + '%';
  console.log(type.padEnd(20), String(s.total).padStart(9), top1Pct.padStart(8), top3Pct.padStart(8), abstPct.padStart(11));
}

const totalCanonical = FORMULATION_TYPES.reduce((s, t) => s + results.byType[t].total, 0);
const totalTop1 = FORMULATION_TYPES.reduce((s, t) => s + results.byType[t].top1, 0);
console.log('\nTop-1 accuracy globale (hors ambiguës/hors-corpus) :', ((totalTop1 / totalCanonical) * 100).toFixed(1) + '%', `(${totalTop1}/${totalCanonical})`);

const correctAbstentions = results.outOfCorpus.filter(r => !r.falsePositive).length;
const falsePositivesOutOfCorpus = results.outOfCorpus.filter(r => r.falsePositive).length;
console.log(`\nAbstention correcte (hors-corpus) : ${correctAbstentions}/${results.outOfCorpus.length} (${((correctAbstentions / results.outOfCorpus.length) * 100).toFixed(1)}%)`);
console.log(`Faux positifs sur hors-corpus : ${falsePositivesOutOfCorpus}/${results.outOfCorpus.length} (${((falsePositivesOutOfCorpus / results.outOfCorpus.length) * 100).toFixed(1)}%)`);

const ambiguousCorrect = results.ambiguous.filter(r => r.correct === true).length;
const ambiguousAbstained = results.ambiguous.filter(r => r.outcome === 'ABSTAINED').length;
const ambiguousWrong = results.ambiguous.filter(r => r.correct === false).length;
console.log(`\nAmbiguïté (${results.ambiguous.length} requêtes) : ${ambiguousCorrect} correctes / ${ambiguousAbstained} abstentions / ${ambiguousWrong} incorrectes`);

console.log('\n--- Faux positifs dangereux (score >= 28, réponse fausse avec forte confiance) ---');
if (results.dangerousFalsePositives.length === 0) console.log('Aucun.');
results.dangerousFalsePositives.forEach(f => console.log(`  [${f.type}] "${f.query}" -> attendu "${f.expected}", obtenu "${f.got}" (score ${f.score})`));

console.log('\n--- Faux positifs sur requêtes hors-corpus (jamais censé matcher) ---');
const outOfCorpusFP = results.outOfCorpus.filter(r => r.falsePositive);
if (outOfCorpusFP.length === 0) console.log('Aucun.');
outOfCorpusFP.forEach(f => console.log(`  "${f.query}" -> "${f.outcome}"`));

console.log('\n--- Réussites surprenantes (formulation éloignée, bonne réponse quand même) ---');
results.surprisingSuccesses.slice(0, 10).forEach(s => console.log(`  [${s.type}] "${s.query}" -> "${s.matched}"`));
console.log(`  (${results.surprisingSuccesses.length} au total, 10 premières affichées)`);

console.log('\n--- Échecs (Top-1 incorrect) ---');
results.failures.slice(0, 20).forEach(f => console.log(`  [${f.type}] "${f.query}" -> attendu "${f.expected}", obtenu "${f.got}" (score ${f.score})`));
console.log(`  (${results.failures.length} au total, 20 premiers affichés)`);

console.log('\n--- Abstentions excessives (aucune réponse alors qu\'une existe) ---');
results.excessiveAbstentions.slice(0, 20).forEach(a => console.log(`  [${a.type}] "${a.query}" -> attendu "${a.expected}"`));
console.log(`  (${results.excessiveAbstentions.length} au total, 20 premières affichées)`);

console.log('\n' + '='.repeat(78));
