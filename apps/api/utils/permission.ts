import { prisma } from "@s3-viewer/db";

const hasPermissions = async (serverId: string, userId: string, authorizedRoles: string[]) => {
    const accessPermissions = await prisma.serverAccess.findUnique({
        where: {
            userId_serverId: {
                userId,
                serverId
            }
        },
        select: {
            role: true
        }
    });

    if (!accessPermissions) {
        return false;
    }

    return authorizedRoles.includes(accessPermissions.role);
}

export default hasPermissions;