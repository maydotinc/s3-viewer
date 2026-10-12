import { Role } from "./server-types";

/** `null` reaches the whole bucket; otherwise only keys under these folders. */
type FolderScope = readonly string[] | null;

const MAX_GRANT_FOLDERS = 20;

const FOLDER_LIMITED_ROLES: readonly Role[] = [Role.VIEWER, Role.EDITOR];

const canLimitToFolders = (role: Role): boolean =>
   FOLDER_LIMITED_ROLES.includes(role);

const isDotSegment = (segment: string | undefined): boolean =>
   segment === "." || segment === "..";

// storage may resolve dot segments, escaping a folder or (path-style) the bucket.
const hasDotSegment = (path: string): boolean =>
   path.split(/[\\/]/).some(isDotSegment);

const normalizeFolders = (folders: readonly string[]): string[] => {
   const unique = [...new Set(folders)].sort();
   return unique.filter(
      (folder) =>
         !unique.some((other) => other !== folder && folder.startsWith(other))
   );
};

const prefixHasDotSegment = (prefix: string): boolean => {
   const segments = prefix.split(/[\\/]/);
   const last = segments.pop();
   return last === ".." || segments.some(isDotSegment);
};

// an empty folder name would match every key, so it never matches any.
// a stored folder missing its slash would also match "docs-private" for "docs", so it is read as "docs/".
const under = (scope: readonly string[], path: string): boolean =>
   scope.some(
      (folder) =>
         folder !== "" &&
         path.startsWith(folder.endsWith("/") ? folder : `${folder}/`)
   );

const isInFolderScope = (scope: FolderScope, path: string): boolean =>
   scope === null || (!hasDotSegment(path) && under(scope, path));

const isPrefixInFolderScope = (scope: FolderScope, prefix: string): boolean =>
   scope === null || (!prefixHasDotSegment(prefix) && under(scope, prefix));

const folderScopeCovers = (outer: FolderScope, inner: FolderScope): boolean =>
   outer === null ||
   (inner !== null && inner.every((folder) => isInFolderScope(outer, folder)));

const sameFolderScope = (a: FolderScope, b: FolderScope): boolean => {
   if (a === null || b === null) return a === b;
   const left = normalizeFolders(a);
   const right = normalizeFolders(b);
   return (
      left.length === right.length &&
      left.every((folder, i) => folder === right[i])
   );
};

const foldersLeadingToScope = (
   scope: readonly string[],
   prefix: string
): string[] => {
   const children = new Set<string>();
   for (const folder of scope) {
      if (folder === prefix || !folder.startsWith(prefix)) continue;
      const rest = folder.slice(prefix.length);
      children.add(prefix + rest.slice(0, rest.indexOf("/") + 1));
   }
   return [...children].sort();
};

type ScopedGrant = { role: Role; folders: FolderScope };

export {
   MAX_GRANT_FOLDERS,
   canLimitToFolders,
   folderScopeCovers,
   foldersLeadingToScope,
   hasDotSegment,
   isDotSegment,
   isInFolderScope,
   isPrefixInFolderScope,
   normalizeFolders,
   prefixHasDotSegment,
   sameFolderScope,
};
export type { FolderScope, ScopedGrant };
