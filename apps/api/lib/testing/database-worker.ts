import { prisma } from "@s3-viewer/db";
import { hitRateLimit } from "@s3-viewer/db/rate-limit";
import { AuditLevel } from "@s3-viewer/types";
import { setAuditChainKey } from "../audit/chain";
import { auditLoss, flushAudits, writeAudit } from "../audit/writer";

const [mode, key, worker, countText] = process.argv.slice(2);
if (!process.send || !key || !worker || !countText)
   throw new Error("Run this worker through the database integration test");
const count = Number(countText);
setAuditChainKey(Buffer.from("disposable-database-integration-key"));
await prisma.$connect();
process.send({ ready: true });
await new Promise<void>((resolve) => process.once("message", () => resolve()));

try {
   const hits: number[] = [];
   for (let index = 0; index < count; index++) {
      if (mode === "rate-limit") {
         const hit = await hitRateLimit(
            key,
            60_000,
            new Date("2030-01-01T00:00:00.000Z")
         );
         hits.push(hit.hits);
      } else if (mode === "audit") {
         await writeAudit({
            serverId: key,
            actor: { id: worker, email: `${worker}@example.com` },
            audit: { enabled: true, level: AuditLevel.ALL },
            entry: {
               action: "object.upload",
               bucket: "integration",
               target: `${worker}/${index}`,
               detail: { size: index },
            },
         });
      } else {
         throw new Error(`Unknown integration mode: ${String(mode)}`);
      }
   }
   await flushAudits();
   const loss = auditLoss();
   if (loss.dropped || loss.failed)
      throw new Error(`Audit worker lost entries: ${JSON.stringify(loss)}`);
   process.send({ hits });
} finally {
   await prisma.$disconnect();
   process.disconnect();
}
