import { pluralize } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { joinList } from "@s3-viewer/types";

type RecordedGrant = {
   bucketName: string;
   role: string;
   folders: string[] | number | null;
};

const DIGEST = /^\[(\d+) folders sha256:[0-9a-f]+\]$/;

const closingBracket = (raw: string, start: number): number => {
   let quoted = false;
   for (let i = start + 1; i < raw.length; i++) {
      const char = raw[i];
      if (quoted) {
         if (char === "\\") i++;
         else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "]") return i;
   }
   return -1;
};

const parseFolders = (list: string): string[] | number | null => {
   const digest = DIGEST.exec(list);
   if (digest) return Number(digest[1]);
   try {
      const parsed: unknown = JSON.parse(list);
      return Array.isArray(parsed) &&
         parsed.every((folder) => typeof folder === "string")
         ? parsed
         : null;
   } catch {
      return null;
   }
};

// `alpha:EDITOR["landing/"],zeta:VIEWER`; bucket names never hold `:`, `,` or `[`.
const parseBucketDetail = (raw: string): RecordedGrant[] | null => {
   const grants: RecordedGrant[] = [];
   let i = 0;
   while (i < raw.length) {
      const colon = raw.indexOf(":", i);
      if (colon <= i) return null;
      const role = /^[A-Z_]+/.exec(raw.slice(colon + 1))?.[0];
      if (!role) return null;
      const grant: RecordedGrant = {
         bucketName: raw.slice(i, colon),
         role,
         folders: null,
      };
      i = colon + 1 + role.length;
      if (raw[i] === "[") {
         const end = closingBracket(raw, i);
         if (end < 0) return null;
         const folders = parseFolders(raw.slice(i, end + 1));
         if (folders === null) return null;
         grant.folders = folders;
         i = end + 1;
      }
      grants.push(grant);
      if (i === raw.length) break;
      if (raw[i] !== "," || i === raw.length - 1) return null;
      i++;
   }
   return grants.length > 0 ? grants : null;
};

const grantText = ({ bucketName, role, folders }: RecordedGrant): string => {
   const label = ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
   if (folders === null) return `${bucketName}: ${label}`;
   const where =
      typeof folders === "number"
         ? pluralize(folders, "folder")
         : joinList(folders);
   return `${bucketName}: ${label} in ${where}`;
};

const bucketDetailText = (raw: string): string =>
   parseBucketDetail(raw)?.map(grantText).join("; ") ?? raw;

export { bucketDetailText, parseBucketDetail };
