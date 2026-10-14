import { Permission, hasPermission } from "@s3-viewer/permissions";
import type { ServerInfo } from "@s3-viewer/types";

const canInviteTo = (server: ServerInfo): boolean =>
   hasPermission(server.userRole, Permission.MANAGE_MEMBERS);

const manageableServers = (servers: readonly ServerInfo[]): ServerInfo[] =>
   servers.filter(canInviteTo);

export { canInviteTo, manageableServers };
