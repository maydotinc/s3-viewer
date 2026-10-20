// long-lived maps keyed by user or server would otherwise keep every key they ever saw.
const bump = <K>(counts: Map<K, number>, key: K, delta: number): number => {
   const next = (counts.get(key) ?? 0) + delta;
   if (next > 0) counts.set(key, next);
   else counts.delete(key);
   return Math.max(next, 0);
};

const countOf = <K>(counts: ReadonlyMap<K, number>, key: K): number =>
   counts.get(key) ?? 0;

export { bump, countOf };
