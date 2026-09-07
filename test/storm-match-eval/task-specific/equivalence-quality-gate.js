function sameSet(left, right) {
  return left.length === right.length && left.every(value => right.includes(value));
}

export function validateAnswerEquivalenceQualityGate({ entries, groups, cases }) {
  const errors = [];
  const knownEntryIds = new Set(entries.map(entry => entry.entryId));
  const groupById = new Map();
  const groupByEntryId = new Map();

  for (const group of groups) {
    const groupId = group.answerEquivalenceGroupId;
    if (!groupId || groupById.has(groupId)) {
      errors.push({ code: 'INVALID_OR_DUPLICATE_GROUP_ID', groupId });
      continue;
    }
    groupById.set(groupId, group);

    if (!Array.isArray(group.entryIds) || group.entryIds.length === 0) {
      errors.push({ code: 'EMPTY_GROUP', groupId });
      continue;
    }

    if (!group.entryIds.includes(group.preferredEntryId) || !knownEntryIds.has(group.preferredEntryId)) {
      errors.push({ code: 'INVALID_PREFERRED_ENTRY_ID', groupId, preferredEntryId: group.preferredEntryId });
    }

    for (const entryId of group.entryIds) {
      if (!knownEntryIds.has(entryId)) {
        errors.push({ code: 'UNKNOWN_GROUP_ENTRY_ID', groupId, entryId });
        continue;
      }
      if (groupByEntryId.has(entryId)) {
        errors.push({
          code: 'ENTRY_IN_MULTIPLE_GROUPS',
          entryId,
          groupIds: [groupByEntryId.get(entryId), groupId]
        });
        continue;
      }
      groupByEntryId.set(entryId, groupId);
    }
  }

  for (const entryId of knownEntryIds) {
    if (!groupByEntryId.has(entryId)) {
      errors.push({ code: 'ENTRY_WITHOUT_GROUP', entryId });
    }
  }

  for (const item of cases) {
    const caseId = item.caseId;
    const candidateIds = item.goldCoveredCandidateIds;
    const declaredGroupIds = item.goldCoveredAnswerEquivalenceGroupIds;
    if (!Array.isArray(candidateIds) || !Array.isArray(declaredGroupIds)) {
      errors.push({ code: 'MISSING_GOLD_ARRAY', caseId });
      continue;
    }

    const derivedGroupIds = [];
    for (const entryId of new Set(candidateIds)) {
      if (!knownEntryIds.has(entryId)) {
        errors.push({ code: 'UNKNOWN_GOLD_CANDIDATE_ID', caseId, entryId });
        continue;
      }
      const groupId = groupByEntryId.get(entryId);
      if (!groupId) {
        errors.push({ code: 'GOLD_CANDIDATE_WITHOUT_GROUP', caseId, entryId });
        continue;
      }
      if (!derivedGroupIds.includes(groupId)) derivedGroupIds.push(groupId);
    }

    const normalisedDeclared = [...new Set(declaredGroupIds)].sort();
    const normalisedDerived = [...derivedGroupIds].sort();
    if (!sameSet(normalisedDeclared, normalisedDerived)) {
      errors.push({
        code: 'GOLD_GROUPS_MISMATCH',
        caseId,
        declaredGroupIds: normalisedDeclared,
        derivedGroupIds: normalisedDerived
      });
    }

    const expectedOutcome = normalisedDerived.length === 0
      ? 'notCovered'
      : normalisedDerived.length === 1
        ? 'covered'
        : 'ambiguous';

    if (item.expectedSystemOutcome !== expectedOutcome) {
      errors.push({
        code: expectedOutcome === 'covered' && item.expectedSystemOutcome === 'ambiguous'
          ? 'FALSE_AMBIGUOUS_SINGLE_GROUP'
          : 'SYSTEM_OUTCOME_MISMATCH',
        caseId,
        expectedOutcome,
        actualOutcome: item.expectedSystemOutcome
      });
    }

    const expectedEntryId = expectedOutcome === 'covered'
      ? groupById.get(normalisedDerived[0])?.preferredEntryId
      : null;
    if ((item.expectedEntryId ?? null) !== (expectedEntryId ?? null)) {
      errors.push({
        code: 'EXPECTED_ENTRY_ID_MISMATCH',
        caseId,
        expectedEntryId: expectedEntryId ?? null,
        actualEntryId: item.expectedEntryId ?? null
      });
    }

    for (const pair of item.candidatePairs ?? []) {
      const actualGroupId = groupByEntryId.get(pair.candidateEntryId);
      if (!actualGroupId) {
        errors.push({ code: 'UNKNOWN_PAIR_CANDIDATE_ID', caseId, entryId: pair.candidateEntryId });
      } else if (pair.answerEquivalenceGroupId !== actualGroupId) {
        errors.push({
          code: 'PAIR_GROUP_MISMATCH',
          caseId,
          entryId: pair.candidateEntryId,
          expectedGroupId: actualGroupId,
          actualGroupId: pair.answerEquivalenceGroupId
        });
      }
      const expectedLabel = candidateIds.includes(pair.candidateEntryId) ? 'covered' : 'notCovered';
      if (pair.label !== expectedLabel) {
        errors.push({
          code: 'PAIR_LABEL_MISMATCH',
          caseId,
          entryId: pair.candidateEntryId,
          expectedLabel,
          actualLabel: pair.label
        });
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertAnswerEquivalenceQualityGate(input) {
  const result = validateAnswerEquivalenceQualityGate(input);
  if (!result.ok) {
    const error = new Error(`Answer-equivalence Quality Gate failed with ${result.errors.length} error(s)`);
    error.details = result.errors;
    throw error;
  }
  return result;
}
