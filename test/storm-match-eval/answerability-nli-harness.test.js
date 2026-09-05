import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = join(HERE, 'answerability-nli');

test('development export reclassifies all 200 observed Decision cases without exposing holdout', () => {
  const payload = JSON.parse(execFileSync(process.execPath, [join(HARNESS, 'export-input.mjs'), 'development'], { encoding: 'utf8' }));
  assert.equal(payload.phase, 'development');
  assert.equal(payload.entries.length, 112);
  assert.equal(payload.cases.length, 200);
  assert.equal(payload.cases.filter(item => item.label === 'covered').length, 100);
  assert.equal(payload.cases.filter(item => item.label === 'notCovered').length, 80);
  assert.equal(payload.cases.filter(item => item.label === 'ambiguous').length, 20);
  assert.equal(payload.answerabilityHoldoutFingerprint, null);
  assert.ok(payload.cases.every(item => Object.hasOwn(item, 'originalSplit')));
});

test('NLI specs pin two distinct local CPU candidates and all three probabilities', () => {
  const specs = JSON.parse(readFileSync(join(HARNESS, 'model-specs.json'), 'utf8'));
  assert.equal(specs.models.length, 2);
  assert.deepEqual(specs.models.map(item => item.key), ['nli-minilm-l6', 'nli-mdeberta-base']);
  for (const model of specs.models) {
    assert.match(model.revision, /^[0-9a-f]{40}$/);
    assert.equal(model.license, 'mit');
    assert.deepEqual(model.labelIds, { entailment: 0, neutral: 1, contradiction: 2 });
    assert.match(model.weightSha256, /^[0-9a-f]{64}$/);
    assert.match(model.artifactFingerprint, /^[0-9a-f]{64}$/);
  }
  assert.equal(specs.deferred.length, 1);
  assert.match(specs.deferred[0].reason, /not executed/i);
});

test('harness keeps NLI directions and knowledge representations separate', () => {
  const source = readFileSync(join(HARNESS, 'benchmark.py'), 'utf8');
  assert.match(source, /REPRESENTATIONS = \("question", "questionAnswer"\)/);
  assert.match(source, /DIRECTIONS = \("knowledgeToQuery", "queryToKnowledge"\)/);
  assert.match(source, /for top_k in \(3, 5\)/);
  const common = readFileSync(join(HARNESS, 'common.py'), 'utf8');
  assert.match(common, /return knowledge, query/);
  assert.match(common, /return query, knowledge/);
});

test('Python harness is offline/local-only and contains no machine-specific path or product dependency', () => {
  const files = readdirSync(HARNESS).filter(name => name.endsWith('.py'));
  const source = files.map(name => readFileSync(join(HARNESS, name), 'utf8')).join('\n');
  assert.match(source, /HF_HUB_OFFLINE/);
  assert.match(source, /TRANSFORMERS_OFFLINE/);
  assert.match(source, /local_files_only=True/);
  assert.match(source, /trust_remote_code=False/);
  assert.doesNotMatch(source, /snapshot_download|hf_hub_download|requests\.|urllib\./);
  assert.doesNotMatch(source, /C:\\Users\\|\/home\//);
  assert.doesNotMatch(source, /(?:from|import)\s+src|public[\\/]|scoreEntry|CURRENT_THRESHOLDS/);
});

test('one-shot holdout is exported only after both model selections are locked', () => {
  const source = readFileSync(join(HARNESS, 'benchmark.py'), 'utf8');
  const lockPosition = source.indexOf('selection_paths, latency');
  const exportPosition = source.indexOf('export_payload(args.node, "holdout"');
  assert.ok(lockPosition > 0);
  assert.ok(exportPosition > lockPosition);
  assert.match(readFileSync(join(HARNESS, 'final_holdout_worker.py'), 'utf8'), /"holdoutPasses": 1/);
});

test('measured report records the sealed holdout failure without a product recommendation', () => {
  const report = readFileSync(join(HARNESS, 'report-answerability-nli.md'), 'utf8');
  assert.match(report, /nli-minilm-l6` \| 38\/96 \(39\.6%\) \| 5\/32 \(15\.6%\)/);
  assert.match(report, /nli-mdeberta-base` \| 32\/96 \(33\.3%\) \| 1\/32 \(3\.1%\)/);
  assert.match(report, /0\/0\/6/);
  assert.match(report, /0\/0\/2/);
  assert.match(report, /Aucune des deux architectures NLI ne satisfait/);
  assert.match(report, /SQuAD2 n’a pas été exécutée/);
  assert.doesNotMatch(report, /C:\\Users\\|\/home\//);
});
