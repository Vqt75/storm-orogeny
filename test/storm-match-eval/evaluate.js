import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluationCases, selectedEntryIds } from './evaluation-corpus.js';
import { CURRENT_THRESHOLDS, heuristicMatcher } from './matchers/heuristic.js';

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(EVAL_DIR, '..', '..');
export const BASELINE_PATH = path.join(EVAL_DIR, 'report-baseline.txt');

export function loadSnapshot() {
  return JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'equinoxe-corpus.snapshot.json'), 'utf8'));
}

function percent(value, total) {
  return total === 0 ? 'n/a' : (value * 100 / total).toFixed(1) + '%';
}

function severityForFalsePositive(result) {
  const bucket = result.rankedCandidates[0]?.confidenceBucket;
  if (bucket === 'high') return 'dangerous';
  if (bucket === 'medium') return 'medium';
  return 'weak';
}

function diagnoseFailure(result) {
  if (result.case.category === 'hors_corpus') return 'out_of_corpus_non_abstention';
  if (result.case.expectedEntryId === null) return 'true_ambiguity_non_abstention';
  if (result.outcome === 'disambiguated') return 'disambiguation_without_resolution';
  if (result.outcome === 'matched') return 'competing_entry_ranked_first';
  if (result.expectedRank === 1) return 'expected_top1_below_match_threshold';
  if (result.expectedRank > 1 && result.expectedRank <= 3) return 'expected_in_top3_but_not_selected';
  return 'expected_outside_top3_lexical_gap';
}

export function evaluateBenchmark({
  matcher = heuristicMatcher,
  entries = loadSnapshot().entries,
  cases = evaluationCases
} = {}) {
  const results = cases.map(testCase => {
    const match = matcher.match(testCase.formulation, entries);
    const expectedRankIndex = testCase.expectedEntryId === null
      ? -1
      : match.rankedCandidates.findIndex(candidate => candidate.entryId === testCase.expectedEntryId);
    const expectedRank = expectedRankIndex < 0 ? null : expectedRankIndex + 1;
    const top1Correct = testCase.expectedEntryId === null
      ? match.outcome === 'abstained'
      : match.outcome === 'matched' && match.matchedEntryId === testCase.expectedEntryId;
    const top3Correct = testCase.expectedEntryId !== null && expectedRank !== null && expectedRank <= 3;

    return {
      case: testCase,
      ...match,
      expectedRank,
      top1Correct,
      top3Correct
    };
  });

  const inCorpus = results.filter(result => result.case.category !== 'hors_corpus');
  const resolvable = inCorpus.filter(result => result.case.expectedEntryId !== null);
  const trueAmbiguous = inCorpus.filter(result => result.case.expectedEntryId === null);
  const outOfCorpus = results.filter(result => result.case.category === 'hors_corpus');
  const falsePositives = outOfCorpus
    .filter(result => result.outcome !== 'abstained')
    .map(result => ({ ...result, severity: severityForFalsePositive(result) }));
  const overAbstentions = resolvable.filter(result => result.outcome === 'abstained');
  const ambiguityCases = results.filter(result => result.case.category === 'ambiguite_adjacent');
  const ambiguityErrors = ambiguityCases.filter(result => !result.top1Correct);
  const failures = results.filter(result => !result.top1Correct);

  const categories = new Map();
  for (const result of results) {
    const key = result.case.category;
    const metric = categories.get(key) || {
      cases: 0,
      positives: 0,
      top1Correct: 0,
      top3Correct: 0,
      abstained: 0
    };
    metric.cases += 1;
    if (result.case.expectedEntryId !== null) metric.positives += 1;
    if (result.top1Correct) metric.top1Correct += 1;
    if (result.top3Correct) metric.top3Correct += 1;
    if (result.outcome === 'abstained') metric.abstained += 1;
    categories.set(key, metric);
  }

  const causes = new Map();
  for (const failure of failures) {
    const cause = diagnoseFailure(failure);
    causes.set(cause, (causes.get(cause) || 0) + 1);
  }

  return {
    matcherId: matcher.id,
    sourceGitCommit: loadSnapshot().source.gitCommit,
    entries,
    cases,
    results,
    inCorpus,
    resolvable,
    trueAmbiguous,
    outOfCorpus,
    falsePositives,
    overAbstentions,
    ambiguityCases,
    ambiguityErrors,
    failures,
    categories,
    causes,
    metrics: {
      top1Global: results.filter(result => result.top1Correct).length,
      top1InCorpus: inCorpus.filter(result => result.top1Correct).length,
      top1Resolvable: resolvable.filter(result => result.top1Correct).length,
      top3Resolvable: resolvable.filter(result => result.top3Correct).length,
      abstentions: results.filter(result => result.outcome === 'abstained').length,
      correctTrueAmbiguousAbstentions: trueAmbiguous.filter(result => result.outcome === 'abstained').length,
      correctOutOfCorpusAbstentions: outOfCorpus.filter(result => result.outcome === 'abstained').length
    }
  };
}

function resultLine(result) {
  const top = result.rankedCandidates.slice(0, 3)
    .map(candidate => candidate.entryId + ':' + candidate.score + '/' + candidate.confidenceBucket)
    .join(', ');
  return [
    result.case.id,
    JSON.stringify(result.case.formulation),
    'source=' + (result.case.sourceEntryId ?? 'null'),
    'expected=' + (result.case.expectedEntryId ?? 'null'),
    'ambiguity=' + (result.case.ambiguityClassification ?? 'n/a'),
    'outcome=' + result.outcome,
    'actual=' + (result.matchedEntryId ?? 'null'),
    'expectedRank=' + (result.expectedRank ?? 'n/a'),
    'top3=[' + top + ']'
  ].join(' | ');
}

function appendDetailedSection(lines, title, results) {
  lines.push('', title + ' (' + results.length + ')');
  lines.push('-'.repeat(title.length + String(results.length).length + 3));
  if (results.length === 0) {
    lines.push('none');
    return;
  }
  for (const result of results) lines.push(resultLine(result));
}

export function renderReport(evaluation) {
  const { metrics } = evaluation;
  const lines = [
    'STORM MATCH — PORTABLE BENCHMARK V0',
    '===================================',
    'Production Git hash: ' + evaluation.sourceGitCommit,
    'Matcher: ' + evaluation.matcherId,
    'Snapshot entries: ' + evaluation.entries.length,
    'Selected canonical questions: ' + selectedEntryIds.length,
    'Evaluation cases: ' + evaluation.cases.length,
    'In-corpus cases: ' + evaluation.inCorpus.length,
    'Resolvable in-corpus cases: ' + evaluation.resolvable.length,
    'True-ambiguous in-corpus cases: ' + evaluation.trueAmbiguous.length,
    'Out-of-corpus cases: ' + evaluation.outOfCorpus.length,
    'Execution timestamp: omitted for deterministic diffs',
    '',
    'CURRENT ENGINE THRESHOLDS (reported unchanged)',
    '----------------------------------------------',
    'Minimum match/candidate score: ' + CURRENT_THRESHOLDS.minimumMatchScore,
    'Medium confidence starts at: ' + CURRENT_THRESHOLDS.mediumConfidenceScore,
    'High confidence starts at: ' + CURRENT_THRESHOLDS.highConfidenceScore,
    '',
    'GLOBAL METRICS',
    '--------------',
    'Top-1 global (correct entry or correct required abstention): ' +
      metrics.top1Global + '/' + evaluation.results.length + ' (' + percent(metrics.top1Global, evaluation.results.length) + ')',
    'Top-1 in-corpus (including correct true-ambiguity abstention): ' +
      metrics.top1InCorpus + '/' + evaluation.inCorpus.length + ' (' + percent(metrics.top1InCorpus, evaluation.inCorpus.length) + ')',
    'Top-1 resolvable in-corpus: ' +
      metrics.top1Resolvable + '/' + evaluation.resolvable.length + ' (' + percent(metrics.top1Resolvable, evaluation.resolvable.length) + ')',
    'Top-3 diagnostic resolvable in-corpus: ' +
      metrics.top3Resolvable + '/' + evaluation.resolvable.length + ' (' + percent(metrics.top3Resolvable, evaluation.resolvable.length) + ')',
    'Abstention rate (all cases): ' +
      metrics.abstentions + '/' + evaluation.results.length + ' (' + percent(metrics.abstentions, evaluation.results.length) + ')',
    'Correct true-ambiguity abstention: ' +
      metrics.correctTrueAmbiguousAbstentions + '/' + evaluation.trueAmbiguous.length + ' (' +
      percent(metrics.correctTrueAmbiguousAbstentions, evaluation.trueAmbiguous.length) + ')',
    'Correct out-of-corpus abstention: ' +
      metrics.correctOutOfCorpusAbstentions + '/' + evaluation.outOfCorpus.length + ' (' +
      percent(metrics.correctOutOfCorpusAbstentions, evaluation.outOfCorpus.length) + ')',
    'Out-of-corpus false positives/non-abstentions: ' +
      evaluation.falsePositives.length + '/' + evaluation.outOfCorpus.length + ' (' +
      percent(evaluation.falsePositives.length, evaluation.outOfCorpus.length) + ')',
    'Over-abstentions (expected entry, engine abstained): ' + evaluation.overAbstentions.length,
    'Ambiguity/adjacent errors: ' + evaluation.ambiguityErrors.length + '/' + evaluation.ambiguityCases.length,
    '',
    'METRICS BY CATEGORY',
    '-------------------'
  ];

  for (const [category, metric] of evaluation.categories) {
    lines.push(
      category +
      ' | cases=' + metric.cases +
      ' | top1=' + metric.top1Correct + '/' + metric.cases + ' (' + percent(metric.top1Correct, metric.cases) + ')' +
      ' | top3=' + (metric.positives ? metric.top3Correct + '/' + metric.positives + ' (' + percent(metric.top3Correct, metric.positives) + ')' : 'n/a') +
      ' | abstained=' + metric.abstained
    );
  }

  lines.push('', 'OBSERVABLE FAILURE CAUSES', '-------------------------');
  if (evaluation.causes.size === 0) lines.push('none');
  else for (const [cause, count] of evaluation.causes) lines.push(cause + ': ' + count);

  appendDetailedSection(lines, 'OUT-OF-CORPUS FALSE POSITIVES', evaluation.falsePositives);
  if (evaluation.falsePositives.length) {
    lines.push(
      'Severity counts: weak=' + evaluation.falsePositives.filter(result => result.severity === 'weak').length +
      ', medium=' + evaluation.falsePositives.filter(result => result.severity === 'medium').length +
      ', dangerous=' + evaluation.falsePositives.filter(result => result.severity === 'dangerous').length
    );
  }
  appendDetailedSection(lines, 'OVER-ABSTENTIONS', evaluation.overAbstentions);
  appendDetailedSection(lines, 'TRUE-AMBIGUOUS CASES', evaluation.trueAmbiguous);
  appendDetailedSection(lines, 'AMBIGUITY OR ADJACENT CASES', evaluation.ambiguityCases);

  appendDetailedSection(
    lines,
    'REPRESENTATIVE SUCCESSES',
    evaluation.results.filter(result => result.top1Correct).slice(0, 10)
  );
  appendDetailedSection(lines, 'REPRESENTATIVE FAILURES', evaluation.failures.slice(0, 10));

  lines.push('', 'Notes:');
  lines.push('- Top-3 is diagnostic ranking only; it does not change the production outcome.');
  lines.push('- expectedEntryId=null means required abstention; category distinguishes true ambiguity from out-of-corpus.');
  lines.push('- False-positive severity reuses Ivory confidence buckets: weak=low, medium=medium, dangerous=high.');
  lines.push('- No user/runtime query, timestamp, database value, or random content is persisted; this report contains only static evaluation fixtures and their results.');
  return lines.join('\n') + '\n';
}

function runCli() {
  const report = renderReport(evaluateBenchmark());
  if (process.argv.includes('--write')) {
    fs.writeFileSync(BASELINE_PATH, report, 'utf8');
    process.stdout.write('Wrote ' + BASELINE_PATH + '\n');
    return;
  }
  if (process.argv.includes('--check')) {
    const baseline = fs.readFileSync(BASELINE_PATH, 'utf8').replace(/\r\n/g, '\n');
    if (baseline !== report) {
      process.stderr.write('Baseline report is stale. Run: node test/storm-match-eval/evaluate.js --write\n');
      process.exitCode = 1;
    }
    return;
  }
  process.stdout.write(report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
