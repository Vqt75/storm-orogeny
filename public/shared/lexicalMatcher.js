// Environment-neutral lexical primitives. No content or project vocabulary.
export function normalize(text = "") {
  return text.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text = "") {
  return normalize(text).split(" ").filter(Boolean);
}

export function createLexicalMatcher({ tokenize: tokensFor = tokenize } = {}) {
  const tokenize = tokensFor;
  function scoreEntry(question, entry) {
    const normQ  = normalize(question);
    const tokens = tokenize(question);
    let score = 0;

    (entry.keywords || []).forEach(kw => {
      tokenize(kw).forEach(t => { if (tokens.includes(t)) score += 3; });
      const nk = normalize(kw);
      if (nk.length > 3 && normQ.includes(nk)) score += 5;
    });

    (entry.phrases || []).forEach(phrase => {
      const np = normalize(phrase);
      if (np && normQ.includes(np)) score += 10;
    });

    (entry.intentSignals || []).forEach(sig => {
      const ns = normalize(sig);
      if (tokens.includes(ns) || (ns.length > 3 && normQ.includes(ns))) score += 4;
    });

    (entry.emotionSignals || []).forEach(sig => {
      const ns = normalize(sig);
      if (tokens.includes(ns) || (ns.length > 3 && normQ.includes(ns))) score += 2;
    });

    (entry.negativeSignals || []).forEach(sig => {
      const ns = normalize(sig);
      if (tokens.includes(ns) || (ns.length > 3 && normQ.includes(ns))) score -= 3;
    });

    // Published title overlap also works without curated scoring metadata.
    if (entry.title) {
      const titleTokens = tokenize(entry.title);
      const sharedTokens = titleTokens.filter(t => t.length > 2 && tokens.includes(t));
      score += sharedTokens.length * 6;

      const normTitle = normalize(entry.title);
      if (normTitle && (normQ.includes(normTitle) || normTitle.includes(normQ))) score += 15;
    }

    score += (entry.priority || 0);
    return score;
  }

  function matchFaq(question, faqItems) {
    const scored = (faqItems || [])
      .map(entry => ({ entry, score: scoreEntry(question, entry) }))
      .sort((a, b) => b.score - a.score);

    const best   = scored[0];
    const second = scored[1];

    if (!best || best.score < 12) return null;

    const strongCandidates = scored.filter(s => s.score >= 28);
    const distinctCategories = new Set(strongCandidates.map(s => s.entry.category));
    if (distinctCategories.size >= 3) return null;

    if (second && second.score >= 18) {
      const gap = best.score - second.score;
      if (gap < 5 && best.entry.category !== second.entry.category) {
        if ((second.entry.priority || 0) > (best.entry.priority || 0)) return second.entry;
        if ((best.entry.priority || 0) === (second.entry.priority || 0)) return null;
      }
    }

    if (second && Math.abs(best.score - second.score) <= 3) {
      if ((second.entry.priority || 0) > (best.entry.priority || 0)) {
        return second.entry;
      }
    }

    return best.entry;
  }

  return Object.freeze({ scoreEntry, matchFaq });
}
