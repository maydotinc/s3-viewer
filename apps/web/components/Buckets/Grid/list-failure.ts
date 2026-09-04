/**
 * A listing failure pinned to the datasource that produced it. Datasources are
 * replaced whenever the bucket, prefix or filter changes, so a late error from
 * a superseded one must never surface against the current listing.
 */
type ListFailure<S> = { source: S; error: unknown };

const pinFailure = <S>(
   current: ListFailure<S> | null,
   latest: S | null,
   source: S,
   error: unknown
): ListFailure<S> | null => (latest === source ? { source, error } : current);

const failureOf = <S>(failure: ListFailure<S> | null, source: S): unknown =>
   failure?.source === source ? failure.error : null;

export { failureOf, pinFailure };
export type { ListFailure };
