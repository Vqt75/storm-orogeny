// Logger minimal — sortie JSON structurée sur stdout/stderr, sans
// dépendance externe. L'observabilité complète (agrégation, tracing)
// est un sujet de Phase 8 (Enterprise hardening), pas de Foundations.
// Ce logger doit rester trivialement remplaçable par un adapter plus
// riche le moment venu, sans changer son interface (info/warn/error).

function write(stream, level, payload, message) {
  const entry = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(payload && typeof payload === 'object' ? serializeError(payload) : {})
  };
  stream.write(JSON.stringify(entry) + '\n');
}

function serializeError(payload) {
  if (payload.err instanceof Error) {
    return { ...payload, err: { name: payload.err.name, message: payload.err.message, stack: payload.err.stack } };
  }
  return payload;
}

export const logger = {
  info(payload, message) { write(process.stdout, 'info', payload, message ?? payload); },
  warn(payload, message) { write(process.stdout, 'warn', payload, message ?? payload); },
  error(payload, message) { write(process.stderr, 'error', payload, message ?? payload); }
};
