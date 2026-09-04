import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { decisionCases, decisionCorpusContract } from './verifier/decision-corpus.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, 'verifier');
const snapshot = JSON.parse(readFileSync(join(HERE, 'equinoxe-corpus.snapshot.json'), 'utf8'));
const entryIds = new Set(snapshot.entries.map(entry => entry.entryId));

test('decision corpus has the declared 200-case static composition', () => {
  assert.equal(decisionCases.length, 200);
  assert.equal(decisionCorpusContract.calibration, 120);
  assert.equal(decisionCorpusContract.holdout, 80);
  assert.equal(decisionCases.filter(item => item.expectedEntryId).length, 100);
  assert.equal(decisionCases.filter(item => !item.expectedEntryId).length, 100);
  assert.equal(new Set(decisionCases.map(item => item.id)).size, 200);
  assert.equal(new Set(decisionCases.map(item => item.formulation)).size, 200);
  assert.ok(decisionCases.every(item => item.intentId === null));
});

test('calibration and holdout positive sources are disjoint and all IDs are test fixtures', () => {
  const sources = split => new Set(decisionCases.filter(item => item.split === split && item.expectedEntryId).map(item => item.expectedEntryId));
  const calibration = sources('calibration');
  const holdout = sources('holdout');
  assert.equal(calibration.size, 15);
  assert.equal(holdout.size, 10);
  assert.deepEqual([...calibration].filter(id => holdout.has(id)), []);
  assert.ok(decisionCases.every(item => item.expectedEntryId === null || entryIds.has(item.expectedEntryId)));
  assert.ok([...calibration, ...holdout].every(id => /^equinoxe-q\d{3}$/.test(id)));
});

test('decision corpus fingerprint is stable', () => {
  const fingerprint = createHash('sha256').update(JSON.stringify(decisionCases)).digest('hex');
  assert.equal(fingerprint, '7965afbd8fe9d63bffc27dd3f59b87733a24e302f75ab36e56dc3a6bce61f35f');
});

test('exports physically isolate calibration and holdout', () => {
  const run = phase => JSON.parse(execFileSync(process.execPath, [join(VERIFIER, 'export-input.mjs'), phase], { encoding: 'utf8' }));
  const calibration = run('calibration');
  const holdout = run('holdout');
  assert.equal(calibration.entries.length, 112);
  assert.equal(calibration.officialCases.length, 320);
  assert.equal(calibration.decisionCases.length, 120);
  assert.ok(calibration.decisionCases.every(item => item.split === 'calibration'));
  assert.equal(holdout.officialCases.length, 0);
  assert.equal(holdout.decisionCases.length, 80);
  assert.ok(holdout.decisionCases.every(item => item.split === 'holdout'));
  assert.equal(calibration.decisionFingerprint, holdout.decisionFingerprint);
  assert.equal(calibration.corpusFingerprint, '55f5df84538e53a21f3c9fa3c2363587fb1e80d39ec5ff8288e1796a3f0559f1');
});

test('verifier specs pin portable commercial candidates and explain exclusions', () => {
  const specs = JSON.parse(readFileSync(join(VERIFIER, 'verifier-model-specs.json'), 'utf8'));
  assert.equal(specs.models.length, 2);
  for (const model of specs.models) {
    assert.match(model.revision, /^[0-9a-f]{40}$/);
    assert.equal(model.architecture, 'XLMRobertaForSequenceClassification');
    assert.equal(model.license, 'apache-2.0');
    assert.equal(model.scoreTransform, 'sigmoid');
  }
  assert.equal(specs.rejected.length, 2);
  assert.ok(specs.rejected.some(item => item.reason.includes('trust_remote_code')));
  assert.ok(specs.rejected.some(item => item.reason.includes('CC-BY-NC-4.0')));
});

test('Python harness is offline-only, local-only, and contains no machine path', () => {
  const files = readdirSync(VERIFIER).filter(name => name.endsWith('.py'));
  const source = files.map(name => readFileSync(join(VERIFIER, name), 'utf8')).join('\n');
  assert.match(source, /HF_HUB_OFFLINE/);
  assert.match(source, /TRANSFORMERS_OFFLINE/);
  assert.match(source, /local_files_only/);
  assert.match(source, /trust_remote_code=False/);
  assert.doesNotMatch(source, /snapshot_download|hf_hub_download|requests\.|urllib\./);
  assert.doesNotMatch(source, /C:\\Users\\|\/home\//);
  assert.doesNotMatch(source, /scoreEntry|CURRENT_THRESHOLDS|PostgreSQL|\bpg\b/);
});

test('measured report records one-shot holdout failure without a product recommendation', () => {
  const report = readFileSync(join(VERIFIER, 'report-verifier.md'), 'utf8');
  assert.match(report, /Holdout : exporté et exécuté une seule fois/);
  assert.match(report, /Top-1 résoluble : 11\/40 \(27\.5%\)/);
  assert.match(report, /Faux positifs faibles\/moyens\/dangereux : 1\/0\/3/);
  assert.match(report, /Aucune architecture n’est recommandée/);
  assert.doesNotMatch(report, /C:\\Users\\|\/home\//);
});
