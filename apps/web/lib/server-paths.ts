import { SITE_PATHS } from "@s3-viewer/types";

const auditPath = (serverId: string) =>
   `/servers/${encodeURIComponent(serverId)}/audit`;

const withServer = (path: string, serverId: string) =>
   `${path}?server=${encodeURIComponent(serverId)}`;

const invitePeoplePath = (serverId: string) =>
   withServer(SITE_PATHS.settingsInviteNew, serverId);

const membersPath = (serverId: string) =>
   withServer(SITE_PATHS.settingsMembers, serverId);

export { auditPath, invitePeoplePath, membersPath };
