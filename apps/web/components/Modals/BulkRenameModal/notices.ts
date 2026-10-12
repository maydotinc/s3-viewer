import { reviewNotice } from "@/components/Modals/batch-outcome";
import {
   MAX_BULK_RENAME_KEYS,
   type BulkRenamePlan,
} from "@/lib/utils/s3/bulk-rename";
import { formatCount } from "@/lib/utils/format";

type BulkRenameStep = "listing" | "checking" | "renaming";

type Blockers = {
   truncated: boolean;
   plan: BulkRenamePlan;
   existing: string[];
};

type Outcome = {
   attempted: boolean;
   renamed: number;
   failed: number;
   needsReview: number;
};

const SAMPLE = 3;

const sample = (names: readonly string[]): string =>
   names.slice(0, SAMPLE).join(", ");

const blockingNotice = ({
   truncated,
   plan,
   existing,
}: Blockers): string | null => {
   if (truncated)
      return `This holds more than ${formatCount(MAX_BULK_RENAME_KEYS)} objects. Open a subfolder and rename in smaller batches.`;
   if (plan.duplicates.length > 0)
      return `${formatCount(plan.duplicates.length)} new names would be claimed by more than one object: ${sample(plan.duplicates)}.`;
   if (plan.conflicts.length > 0)
      return `Ordering conflict: ${formatCount(plan.conflicts.length)} new names belong to objects this rename also changes (${sample(plan.conflicts)}). Rename those first, or pick a name that isn't already in this batch.`;
   if (plan.invalid.length > 0)
      return `${formatCount(plan.invalid.length)} objects would get an unusable key: ${plan.invalid[0]?.reason ?? ""}`;
   if (existing.length > 0)
      return `${formatCount(existing.length)} of the new names already exist: ${sample(existing)}.`;
   return null;
};

const outcomeNotice = ({
   attempted,
   renamed,
   failed,
   needsReview,
}: Outcome): string | null => {
   const parts: string[] = [];
   if (attempted || renamed > 0)
      parts.push(
         `Renamed ${formatCount(renamed)}${failed > 0 ? `; ${formatCount(failed)} failed` : ""}.`
      );
   if (needsReview > 0) parts.push(reviewNotice("renaming them"));
   return parts.length > 0 ? parts.join(" ") : null;
};

const renameNotice = ({
   error,
   ...state
}: Blockers & Outcome & { error: string | null }): string | null =>
   error ?? blockingNotice(state) ?? outcomeNotice(state);

const progressNotice = (
   step: BulkRenameStep | null,
   listed: number,
   pending: number
): string | null => {
   if (step === "listing")
      return `Listing objects… ${formatCount(listed)} so far.`;
   if (step === "checking") return "Checking the new names…";
   if (step === "renaming") return `Renaming ${formatCount(pending)} objects…`;
   return null;
};

const changeSummary = (plan: BulkRenamePlan, total: number): string => {
   if (plan.rows.length === 0) return "No object would change.";
   const skipped =
      plan.unchanged > 0
         ? `; ${formatCount(plan.unchanged)} unchanged and skipped`
         : "";
   return `${formatCount(plan.rows.length)} of ${formatCount(total)} objects change${skipped}.`;
};

const submitLabel = (attempted: boolean, changes: number): string => {
   if (attempted) return "Continue renaming";
   return changes > 0 ? `Rename ${formatCount(changes)}` : "Rename";
};

export { changeSummary, progressNotice, renameNotice, submitLabel };
export type { BulkRenameStep };
