import type { AuditEntry } from "@s3-viewer/types";
import { describeFailure } from "./utils";

type AuthEventHandler = (entry: AuditEntry) => Promise<void>;

let handler: AuthEventHandler | null = null;

const onAuthEvent = (next: AuthEventHandler): void => {
   handler = next;
};

// an audit write is a side effect of an auth request, never a reason to fail
// one: a full disk must not stop people signing in
const emitAuthEvent = (entry: AuditEntry): void => {
   void handler?.(entry).catch((error: unknown) => {
      console.error(`[auth] audit event failed: ${describeFailure(error)}`);
   });
};

export { emitAuthEvent, onAuthEvent };
export type { AuthEventHandler };
