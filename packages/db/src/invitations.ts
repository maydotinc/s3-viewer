const liveInvite = (now = new Date()) => ({ expiresAt: { gt: now } });

export { liveInvite };
