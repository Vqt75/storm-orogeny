import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scoreEntry } from '../../public/ivory/faq-engine.js';

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const HYBRID_DIR = path.join(EVAL_DIR, 'hybrid');
const REPO_ROOT = path.resolve(EVAL_DIR, '..', '..');

function exportPayload() {
  return JSON.parse(execFileSync(process.execPath, [path.join(HYBRID_DIR, 'export-input.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  }));
}

test('hybrid input : conserve exactement le corpus officiel et les scores du vrai moteur', () => {
  const payload = exportPayload();
  assert.equal(payload.entries.length, 112);
  assert.equal(payload.cases.length, 320);
  assert.equal(payload.cases.filter(testCase => testCase.expectedEntryId !== null).length, 290);
  assert.equal(payload.cases.filter(testCase => testCase.ambiguityClassification === 'trueAmbiguous').length, 10);
  assert.equal(payload.cases.filter(testCase => testCase.category === 'hors_corpus').length, 20);
  assert.match(payload.corpusFingerprint, /^[a-f0-9]{64}$/);

  const first = payload.cases[0];
  const candidate = first.lexicalCandidates.find(item => item.entryId === payload.entries[0].entryId);
  const direct = scoreEntry(first.formulation, {
    id: payload.entries[0].entryId,
    title: payload.entries[0].question
  });
  assert.equal(candidate.rawScore, direct);
});

test('hybrid lexical : normalisation [0,1] ancrée sur les seuils 18/28 existants', () => {
  const payload = exportPayload();
  assert.equal(payload.lexicalNormalization.highConfidenceScore, 28);
  assert.equal(payload.lexicalNormalization.mediumConfidenceScore, 18);
  assert.equal(payload.lexicalNormalization.mediumSupportNormalized, 18 / 28);
  for (const testCase of payload.cases) {
    assert.equal(testCase.lexicalCandidates.length, 112);
    assert.ok(testCase.lexicalCandidates.every(candidate =>
      candidate.normalizedScore >= 0 && candidate.normalizedScore <= 1
    ));
  }
});

test('hybrid calibration : grille exhaustive déclarée et deux candidats seulement', t => {
  const python = process.env.STORM_SEMANTIC_PYTHON;
  if (!python) {
    t.skip('Définir STORM_SEMANTIC_PYTHON pour valider le runner hybride Python.');
    return;
  }
  const output = execFileSync(python, [path.join(HYBRID_DIR, 'benchmark.py'), '--validate-only'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      HF_HUB_OFFLINE: '1',
      TRANSFORMERS_OFFLINE: '1'
    }
  });
  const result = JSON.parse(output);
  assert.equal(result.valid, true);
  assert.equal(result.grid.totalConfigurations, 327600);
  assert.deepEqual(result.grid.weightSemantic, [
    0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95
  ]);
  assert.equal(result.grid.marginThreshold[0], 0.005);
  assert.equal(result.grid.marginThreshold.at(-1), 0.15);
  assert.deepEqual(result.configuredArtifacts, []);
});

test('hybrid sources : aucun téléchargement, DB ou branchement produit', () => {
  const sourceNames = ['benchmark.py', 'calibration.py', 'worker.py', 'export-input.mjs'];
  const sources = sourceNames
    .map(name => fs.readFileSync(path.join(HYBRID_DIR, name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(sources, /snapshot_download|hf_hub_download/);
  assert.doesNotMatch(sources, /src[\\/]db[\\/]pool/);
  assert.doesNotMatch(sources, /\bfetch\s*\(/);
});
