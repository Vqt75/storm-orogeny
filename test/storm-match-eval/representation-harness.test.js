import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, 'representation');

test('representation export preserves official and decision corpus contracts', () => {
  const payload = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'export-input.mjs')], { encoding: 'utf8' }));
  assert.equal(payload.entries.length, 112);
  assert.equal(payload.officialCases.length, 290);
  assert.equal(payload.decisionPositiveCases.length, 100);
  assert.equal(payload.priorHoldoutMissIds.length, 16);
  assert.equal(new Set(payload.priorHoldoutMissIds).size, 16);
  assert.equal(payload.corpusFingerprint, '55f5df84538e53a21f3c9fa3c2363587fb1e80d39ec5ff8288e1796a3f0559f1');
  assert.equal(payload.decisionFingerprint, '7965afbd8fe9d63bffc27dd3f59b87733a24e302f75ab36e56dc3a6bce61f35f');
});

test('representation harness stays offline, retrieval-only, and machine-neutral', () => {
  const source = readdirSync(ROOT).filter(name => name.endsWith('.py') || name.endsWith('.mjs'))
    .map(name => readFileSync(join(ROOT, name), 'utf8')).join('\n');
  assert.match(source, /HF_HUB_OFFLINE/);
  assert.match(source, /encode_passages/);
  assert.doesNotMatch(source, /snapshot_download|hf_hub_download|AutoModelForSequenceClassification|score_pairs/);
  assert.doesNotMatch(source, /C:\\Users\\|\/home\/|PostgreSQL|scoreEntry/);
});

test('measured report reproduces question baselines and records Q+A gains', () => {
  const report = readFileSync(join(ROOT, 'report-knowledge-retrieval.md'), 'utf8');
  assert.match(report, /218\/290 \(75\.2%\).*254\/290 \(87\.6%\).*264\/290 \(91\.0%\)/);
  assert.match(report, /221\/290 \(76\.2%\).*256\/290 \(88\.3%\).*266\/290 \(91\.7%\)/);
  assert.match(report, /DistilUSE 82\/100 à R@3/);
  assert.match(report, /récupère 10\/16 anciens misses/);
  assert.doesNotMatch(report, /C:\\Users\\|\/home\//);
});

test('answerability survey proposes decision models rather than more rerankers', () => {
  const survey = readFileSync(join(ROOT, 'answerability-gate-survey.md'), 'utf8');
  assert.match(survey, /multilingual-MiniLMv2-L6-mnli-xnli/);
  assert.match(survey, /mDeBERTa-v3-base-mnli-xnli/);
  assert.match(survey, /xlm-roberta-base-squad2/);
  assert.match(survey, /entailment.*neutral.*contradiction/s);
  assert.match(survey, /span nul/);
  assert.match(survey, /nouveau\s+holdout answerability/);
  assert.match(survey, /Aucun de ces candidats n’est recommandé/);
});
