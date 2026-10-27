import { SITE_PATHS } from "@s3-viewer/shared";

const auditPath = (serverId: string) =>
   `/servers/${encodeURIComponent(serverId)}/audit`;

const withServer = (path: string, serverId: string) =>
   `${path}?server=${encodeURIComponent(serverId)}`;

const invitePeoplePath = (serverId: string) =>
   withServer(SITE_PATHS.settingsMembersInvite, serverId);

const membersPath = (serverId: string, tab?: "pending") =>
   `${withServer(SITE_PATHS.settingsMembers, serverId)}${tab ? `&tab=${tab}` : ""}`;

export { auditPath, invitePeoplePath, membersPath };
