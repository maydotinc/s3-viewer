import { Prisma } from "@prisma/client";

type DbRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

type ScopeGrant = { bucketName: string; role: DbRole; folders?: string[] };

type ScopeMember = {
   role: DbRole;
   ownerId?: string;
   credentials?: string;
   provider?: string;
   grants?: ScopeGrant[];
   allowedBuckets?: string[];
   restrictedBuckets?: boolean;
   auditEnabled?: boolean;
   auditLevel?: "ALL" | "CHANGES";
   auditViewRole?: DbRole;
   auditManageRole?: DbRole;
   auditRetentionDays?: number;
};

type ScopeLookup = (key: {
   userId: string;
   serverId: string;
}) => ScopeMember | null | undefined;

// match the authorization query's alias, not its tables: server listings join the same tables.
const predicatesOf = (
   sql: string,
   alias: string,
   values: unknown[]
): Record<string, unknown> =>
   Object.fromEntries(
      [...sql.matchAll(/(\w+)\."(\w+)"\s*=\s*\$(\d+)/g)]
         .filter((match) => match[1] === alias)
         .map((match) => [match[2] as string, values[Number(match[3]) - 1]])
   );

const requireColumns = (
   what: string,
   predicates: Record<string, unknown>,
   expected: string[]
): void => {
   const found = Object.keys(predicates).sort().join(",");
   const wanted = [...expected].sort().join(",");
   if (found !== wanted) {
      throw new Error(
         `authorization ${what} must filter on ${wanted}, but filters on ${found || "nothing"}`
      );
   }
};

type ScopeRow = Record<string, unknown>;

const namesOf = (grants: readonly ScopeGrant[]): string[] | null =>
   grants.length > 0 ? grants.map((g) => g.bucketName) : null;

const authorizeScopeRows = (
   strings: TemplateStringsArray,
   raw: unknown[],
   lookup: ScopeLookup
): ScopeRow[] | null => {
   const { text: sql, values } = Prisma.sql(strings, ...raw);
   if (!sql.includes('AS "serverRole"')) return null;

   const access = predicatesOf(sql, "a", values);
   requireColumns("membership", access, ["userId", "serverId"]);
   const userId = access.userId as string;
   const serverId = access.serverId as string;

   const member = lookup({ userId, serverId });
   if (!member) return [];

   const scope: ScopeRow = {
      serverRole: member.role,
      ownerId: member.ownerId,
      credentials: member.credentials,
      provider: member.provider,
      auditEnabled: member.auditEnabled ?? false,
      auditLevel: member.auditLevel ?? "ALL",
      allowedBuckets: member.allowedBuckets ?? [],
      restrictedBuckets: member.restrictedBuckets ?? false,
   };
   const grants = member.grants ?? [];

   if (sql.includes("array_agg")) {
      const reach = predicatesOf(sql, "b", values);
      requireColumns("reach", reach, ["userId", "serverId"]);
      if (reach.userId !== userId || reach.serverId !== serverId) {
         throw new Error("reach aggregate is scoped to the wrong member");
      }
      return [
         {
            ...scope,
            auditViewRole: member.auditViewRole ?? "ADMIN",
            auditManageRole: member.auditManageRole ?? "OWNER",
            auditRetentionDays: member.auditRetentionDays ?? 0,
            reachBuckets: namesOf(grants.filter((g) => !g.folders)),
            ownBuckets: namesOf(grants.filter((g) => g.folders)),
         },
      ];
   }

   if (sql.includes('"bucket_access"')) {
      const grant = predicatesOf(sql, "b", values);
      requireColumns("grant", grant, ["userId", "serverId", "bucketName"]);
      if (grant.userId !== userId || grant.serverId !== serverId) {
         throw new Error("grant join is scoped to the wrong member or server");
      }
      const match = grants.find((g) => g.bucketName === grant.bucketName);
      return [
         {
            ...scope,
            bucketRole: match?.role ?? null,
            restrictedFolders: match ? match.folders !== undefined : null,
            allowedFolders: match ? (match.folders ?? []) : null,
         },
      ];
   }

   return [scope];
};

export { authorizeScopeRows };
export type { DbRole };
