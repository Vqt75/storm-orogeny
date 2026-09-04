import fs from 'node:fs';
import path from 'node:path';

export function equinoxeSeedExists(repoRoot) {
  return fs.existsSync(path.join(repoRoot, 'src', 'db', 'seedDemo.js'));
}

function findArrayLiteral(source, symbol) {
  const declaration = 'const ' + symbol + ' = ';
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex < 0) throw new Error('Source corpus introuvable : ' + symbol);

  const start = source.indexOf('[', declarationIndex + declaration.length);
  if (start < 0) throw new Error('Début du tableau source introuvable : ' + symbol);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char.charCodeAt(0) === 96) {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('Fin du tableau source introuvable : ' + symbol);
}

export function extractEquinoxeQuestions(repoRoot) {
  const sourcePath = path.join(repoRoot, 'src', 'db', 'seedDemo.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const literal = findArrayLiteral(source, 'QUESTIONS');
  const questions = Function('"use strict"; return (' + literal + ');')();

  if (!Array.isArray(questions) || questions.some(pair =>
    !Array.isArray(pair) || pair.length !== 2 ||
    typeof pair[0] !== 'string' || typeof pair[1] !== 'string'
  )) {
    throw new Error('Le tableau QUESTIONS ne respecte plus la forme [question, answer].');
  }

  return questions.map(([question, answer], index) => ({
    entryId: 'equinoxe-q' + String(index + 1).padStart(3, '0'),
    intentId: null,
    question,
    answer
  }));
}
