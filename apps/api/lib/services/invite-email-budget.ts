import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { hitRateLimit, undoRateLimitHit } from "@s3-viewer/db/rate-limit";
import {
   DAY_MS,
   INVITE_EMAIL_COOLDOWN_MS,
   INVITE_EMAILS_PER_RECIPIENT_PER_DAY,
   INVITE_EMAILS_PER_SERVER_PER_DAY,
   canonicalMailbox,
   describeError,
} from "@s3-viewer/types";

type Counter = {
   hit: (key: string, windowMs: number) => Promise<number>;
   undo: (key: string) => Promise<void>;
};

type Reservation = { release: () => Promise<void> };

const MAX_MEMORY_KEYS = 10_000;

const memoryCounter = (): Counter => {
   const windows = new Map<string, { hits: number; resetAt: number }>();
   const evict = (now: number) => {
      for (const [key, window] of windows)
         if (window.resetAt <= now) windows.delete(key);
      for (const oldest of windows.keys()) {
         if (windows.size <= MAX_MEMORY_KEYS) break;
         windows.delete(oldest);
      }
   };
   return {
      hit: async (key, windowMs) => {
         const now = Date.now();
         const live = windows.get(key);
         const window =
            live && live.resetAt > now
               ? { hits: live.hits + 1, resetAt: live.resetAt }
               : { hits: 1, resetAt: now + windowMs };
         windows.delete(key);
         windows.set(key, window);
         if (windows.size > MAX_MEMORY_KEYS) evict(now);
         return window.hits;
      },
      undo: async (key) => {
         const window = windows.get(key);
         if (window && window.hits > 0) window.hits--;
      },
   };
};

const sharedCounter: Counter = {
   hit: async (key, windowMs) => (await hitRateLimit(key, windowMs)).hits,
   undo: undoRateLimitHit,
};

// hashed so the shared rate_limit table never holds invitee addresses.
const mailboxKey = (email: string): string =>
   createHash("sha256")
      .update(canonicalMailbox(email))
      .digest("base64url")
      .slice(0, 32);

const rulesFor = (serverId: string, email: string) => {
   const mailbox = mailboxKey(email);
   return [
      {
         reason: "cooldown",
         key: `invite-mail:again:${serverId}:${mailbox}`,
         windowMs: INVITE_EMAIL_COOLDOWN_MS,
         limit: 1,
      },
      {
         reason: "recipient",
         key: `invite-mail:to:${mailbox}`,
         windowMs: DAY_MS,
         limit: INVITE_EMAILS_PER_RECIPIENT_PER_DAY,
      },
      {
         reason: "server",
         key: `invite-mail:server:${serverId}`,
         windowMs: DAY_MS,
         limit: INVITE_EMAILS_PER_SERVER_PER_DAY,
      },
   ];
};

// spends one invite email from every budget, or none of them when any is used up.
const inviteEmailBudget =
   (counter: () => Counter) =>
   async (serverId: string, email: string): Promise<Reservation | null> => {
      const store = counter();
      const taken: string[] = [];
      const release = async () => {
         await Promise.all(taken.map((key) => store.undo(key)));
      };
      try {
         for (const rule of rulesFor(serverId, email)) {
            taken.push(rule.key);
            if ((await store.hit(rule.key, rule.windowMs)) > rule.limit) {
               await release();
               logger.info("Invite email skipped", {
                  serverId,
                  reason: rule.reason,
               });
               return null;
            }
         }
      } catch (error) {
         await release().catch(() => {});
         logger.warn("Invite email budget unavailable", {
            serverId,
            error: describeError(error),
         });
         return null;
      }
      return { release };
   };

const memory = memoryCounter();

const reserveInviteEmail = inviteEmailBudget(() =>
   env.RATE_LIMIT_STORE === "postgres" ? sharedCounter : memory
);

export { inviteEmailBudget, memoryCounter, reserveInviteEmail };
