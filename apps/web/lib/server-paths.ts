const sharePath = (serverId: string) =>
   `/servers/${encodeURIComponent(serverId)}/share`;

const auditPath = (serverId: string) =>
   `/servers/${encodeURIComponent(serverId)}/audit`;

export { auditPath, sharePath };
