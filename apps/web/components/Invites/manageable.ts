import { Permission, hasPermission } from "@s3-viewer/permissions";
import type { ServerInfo } from "@s3-viewer/shared";

const canInviteTo = (server: ServerInfo): boolean =>
   hasPermission(server.userRole, Permission.MANAGE_MEMBERS);

const manageableServers = (servers: readonly ServerInfo[]): ServerInfo[] =>
   servers.filter(canInviteTo);

// the members page opens on the current server when it can be managed, otherwise the first that can
const defaultManageableServer = (
   manageable: readonly ServerInfo[],
   currentServerId: string | null | undefined
): ServerInfo | undefined =>
   (currentServerId &&
      manageable.find((server) => server.id === currentServerId)) ||
   manageable[0];

export { defaultManageableServer, manageableServers };
