import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sharedWindowCounter } from "@s3-viewer/db/rate-limit";
import {
   DAY_MS,
   INVITE_EMAIL_COOLDOWN_MS,
   INVITE_EMAILS_PER_RECIPIENT_PER_DAY,
   INVITE_EMAILS_PER_SERVER_PER_DAY,
   canonicalMailbox,
   describeError,
   memoryWindowCounter,
   type WindowCounter,
} from "@s3-viewer/shared";

// the servers whose budget was spent; a server whose own rules were used up is left out.
type Reservation = { servers: string[]; release: () => Promise<void> };

const MAX_MEMORY_KEYS = 10_000;

const memoryCounter = (): WindowCounter => memoryWindowCounter(MAX_MEMORY_KEYS);

// hashed so the shared rate_limit table never holds invitee addresses.
const mailboxKey = (email: string): string =>
   createHash("sha256")
      .update(canonicalMailbox(email))
      .digest("base64url")
      .slice(0, 32);

type Rule = { reason: string; key: string; windowMs: number; limit: number };

const recipientRule = (mailbox: string): Rule => ({
   reason: "recipient",
   key: `invite-mail:to:${mailbox}`,
   windowMs: DAY_MS,
   limit: INVITE_EMAILS_PER_RECIPIENT_PER_DAY,
});

// the instance's sender reputation is shared by every account, so one open-signup account cannot turn it into a relay.
const instanceRule = (): Rule => ({
   reason: "instance",
   key: "invite-mail:all",
   windowMs: DAY_MS,
   limit: env.INVITE_EMAILS_PER_DAY,
});

const serverRules = (serverId: string, mailbox: string): Rule[] => [
   {
      reason: "cooldown",
      key: `invite-mail:again:${serverId}:${mailbox}`,
      windowMs: INVITE_EMAIL_COOLDOWN_MS,
      limit: 1,
   },
   {
      reason: "server",
      key: `invite-mail:server:${serverId}`,
      windowMs: DAY_MS,
      limit: INVITE_EMAILS_PER_SERVER_PER_DAY,
   },
];

// one email to one mailbox: the recipient's and the instance's daily budgets are spent once however
// many servers it lists, each server's budgets once; nothing stays spent when no email will go out.
const inviteEmailBudget =
   (counter: () => WindowCounter) =>
   async (serverIds: string[], email: string): Promise<Reservation | null> => {
      const store = counter();
      const mailbox = mailboxKey(email);
      const taken: string[] = [];
      const undo = (keys: string[]) =>
         Promise.all(keys.map((key) => store.undo(key)));
      const release = async () => {
         await undo(taken.splice(0));
      };
      const spend = async (rule: Rule): Promise<boolean> => {
         const { hits } = await store.hit(rule.key, rule.windowMs);
         taken.push(rule.key);
         return hits <= rule.limit;
      };
      const skipped = (servers: string[], reason: string) =>
         logger.info("Invite email skipped", { servers, reason });
      try {
         for (const rule of [recipientRule(mailbox), instanceRule()]) {
            if (await spend(rule)) continue;
            await release();
            skipped(serverIds, rule.reason);
            return null;
         }
         const servers: string[] = [];
         for (const serverId of serverIds) {
            const mark = taken.length;
            let refused: Rule | undefined;
            for (const rule of serverRules(serverId, mailbox)) {
               if (!(await spend(rule))) {
                  refused = rule;
                  break;
               }
            }
            if (!refused) {
               servers.push(serverId);
               continue;
            }
            await undo(taken.splice(mark));
            skipped([serverId], refused.reason);
         }
         if (servers.length === 0) {
            await release();
            return null;
         }
         return { servers, release };
      } catch (error) {
         await release().catch(() => {});
         logger.warn("Invite email budget unavailable", {
            serverIds,
            error: describeError(error),
         });
         return null;
      }
   };

const memory = memoryCounter();

const reserveInviteEmails = inviteEmailBudget(() =>
   env.RATE_LIMIT_STORE === "postgres" ? sharedWindowCounter : memory
);

export { inviteEmailBudget, memoryCounter, reserveInviteEmails };
