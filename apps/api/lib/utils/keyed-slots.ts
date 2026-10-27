import { bump, countOf } from "./counter-map";

type SlotClaim = readonly [key: string, cap: number, refuse: () => Error];
// an undefined claim is a dimension that does not apply to this caller, such as an anonymous user.
type Claims = readonly (SlotClaim | undefined)[];
type Release = () => void;

// in-flight work counted under several keys at once (whole pool, per server, per user, ...):
// a claim is admitted only when every key has room, and its release frees them all exactly once.
const keyedSlots = () => {
   const counts = new Map<string, number>();
   const held = (key: string): number => countOf(counts, key);

   const take = (claims: readonly SlotClaim[], onRelease?: () => void) => {
      for (const [key] of claims) bump(counts, key, 1);
      let released = false;
      return () => {
         if (released) return;
         released = true;
         for (const [key] of claims) bump(counts, key, -1);
         onRelease?.();
      };
   };

   // claims are checked in order, so the first full one decides which refusal the caller sees.
   const tryClaim = (claims: Claims) => {
      const applied = claims.filter((claim) => claim !== undefined);
      return {
         applied,
         full: applied.find(([key, cap]) => held(key) >= cap),
      };
   };

   const acquire = (claims: Claims, onRelease?: () => void): Release => {
      const { applied, full } = tryClaim(claims);
      if (full) throw full[2]();
      return take(applied, onRelease);
   };

   const tryAcquire = (
      claims: Claims,
      onRelease?: () => void
   ): Release | undefined => {
      const { applied, full } = tryClaim(claims);
      return full ? undefined : take(applied, onRelease);
   };

   return { acquire, tryAcquire, held, clear: () => counts.clear() };
};

type KeyedSlots = ReturnType<typeof keyedSlots>;

export { keyedSlots };
export type { KeyedSlots, Release, SlotClaim };
