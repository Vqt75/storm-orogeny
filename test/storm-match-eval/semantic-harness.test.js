import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SEMANTIC_DIR = path.join(EVAL_DIR, 'semantic');
const REPO_ROOT = path.resolve(EVAL_DIR, '..', '..');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(SEMANTIC_DIR, name), 'utf8'));
}

test('semantic specs : les trois contrats modèle restent distincts et complets', () => {
  const specs = readJson('model-specs.json').models;
  assert.deepEqual(specs.map(spec => spec.modelId), [
    'intfloat/multilingual-e5-small',
    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    'sentence-transformers/distiluse-base-multilingual-cased-v2'
  ]);

  assert.deepEqual(
    specs.map(({ key, dimension, maxSequenceLength, queryPrefix, passagePrefix, moduleTypes }) => ({
      key, dimension, maxSequenceLength, queryPrefix, passagePrefix, moduleTypes
    })),
    [
      {
        key: 'e5-small', dimension: 384, maxSequenceLength: 512,
        queryPrefix: 'query: ', passagePrefix: 'passage: ',
        moduleTypes: [
          'sentence_transformers.models.Transformer',
          'sentence_transformers.models.Pooling',
          'sentence_transformers.models.Normalize'
        ]
      },
      {
        key: 'multilingual-minilm', dimension: 384, maxSequenceLength: 128,
        queryPrefix: '', passagePrefix: '',
        moduleTypes: [
          'sentence_transformers.models.Transformer',
          'sentence_transformers.models.Pooling'
        ]
      },
      {
        key: 'distiluse-cased-v2', dimension: 512, maxSequenceLength: 128,
        queryPrefix: '', passagePrefix: '',
        moduleTypes: [
          'sentence_transformers.models.Transformer',
          'sentence_transformers.models.Pooling',
          'sentence_transformers.models.Dense'
        ]
      }
    ]
  );
  assert.ok(specs.every(spec => spec.pooling === 'mean' && spec.doLowerCase === false));
});

test('semantic input : exporte exactement le corpus officiel et le vrai résultat heuristique', () => {
  const raw = execFileSync(process.execPath, [path.join(SEMANTIC_DIR, 'export-input.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  const payload = JSON.parse(raw);
  assert.equal(payload.entries.length, 112);
  assert.equal(payload.cases.length, 320);
  assert.equal(new Set(payload.cases.map(testCase => testCase.id)).size, 320);
  assert.equal(payload.cases.filter(testCase => testCase.expectedEntryId !== null).length, 290);
  assert.equal(payload.cases.filter(testCase => testCase.ambiguityClassification === 'trueAmbiguous').length, 10);
  assert.equal(payload.cases.filter(testCase => testCase.category === 'hors_corpus').length, 20);
  assert.match(payload.corpusFingerprint, /^[a-f0-9]{64}$/);
  assert.ok(payload.cases.every(testCase => typeof testCase.heuristic.top1Correct === 'boolean'));
});

test('semantic diagnostic : 24 cas séparés, équilibrés sur quatre langues', () => {
  const diagnostic = readJson('multilingual-diagnostic.json');
  assert.equal(diagnostic.officialScoreContribution, false);
  assert.equal(diagnostic.cases.length, 24);
  assert.equal(new Set(diagnostic.cases.map(testCase => testCase.id)).size, 24);
  for (const language of ['fr', 'en', 'nl', 'es']) {
    assert.equal(diagnostic.cases.filter(testCase => testCase.language === language).length, 6);
  }
});

test('semantic harness : le mode validation est offline et ne requiert aucun poids', t => {
  const python = process.env.STORM_SEMANTIC_PYTHON;
  if (!python) {
    t.skip('Définir STORM_SEMANTIC_PYTHON pour valider le runner Python.');
    return;
  }
  const output = execFileSync(python, [path.join(SEMANTIC_DIR, 'benchmark.py'), '--validate-only'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      HF_HUB_OFFLINE: '1',
      TRANSFORMERS_OFFLINE: '1'
    }
  });
  const result = JSON.parse(output);
  assert.equal(result.valid, true);
  assert.equal(result.entries, 112);
  assert.equal(result.cases, 320);
  assert.deepEqual(result.configuredArtifacts, []);
});

test('semantic report : l’absence de poids est rapportée sans recommandation', t => {
  const python = process.env.STORM_SEMANTIC_PYTHON;
  if (!python) {
    t.skip('Définir STORM_SEMANTIC_PYTHON pour valider le rapport Python.');
    return;
  }
  const generated = execFileSync(python, [path.join(SEMANTIC_DIR, 'benchmark.py')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
  }).replace(/\r\n/g, '\n');
  const versioned = fs.readFileSync(path.join(SEMANTIC_DIR, 'report-semantic.md'), 'utf8')
    .replace(/\r\n/g, '\n');
  assert.equal(generated, versioned);
  assert.match(generated, /Modèles mesurés : 0\/3/);
  assert.match(generated, /Aucune recommandation : aucun des trois modèles n’a été exécuté/);
});

test('semantic sources : aucun téléchargement et aucun import DB', () => {
  const adapter = fs.readFileSync(path.join(SEMANTIC_DIR, 'adapters.py'), 'utf8');
  const sources = [
    adapter,
    fs.readFileSync(path.join(SEMANTIC_DIR, 'benchmark.py'), 'utf8'),
    fs.readFileSync(path.join(SEMANTIC_DIR, 'worker.py'), 'utf8'),
    fs.readFileSync(path.join(SEMANTIC_DIR, 'export-input.mjs'), 'utf8')
  ].join('\n');
  assert.match(adapter, /local_files_only=True/);
  assert.match(adapter, /HF_HUB_OFFLINE/);
  assert.doesNotMatch(sources, /src[\\/]db[\\/]pool/);
  assert.doesNotMatch(sources, /\bfetch\s*\(/);
  assert.doesNotMatch(sources, /snapshot_download|hf_hub_download/);
});
