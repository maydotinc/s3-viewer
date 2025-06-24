import { prisma } from "@s3-viewer/db";
import { Role } from "@s3-viewer/types";

const hasPermissions = async (serverId: string, userId: string, authorizedRoles: Role[]) => {
   const userRole = await prisma.serverAccess.findUnique({
      where: {
         userId_serverId: {
            userId,
            serverId,
         },
      },
      select: {
         role: true,
      },
   });

   if (!userRole) {
      return false;
   }

   return authorizedRoles.includes(userRole.role as Role);
};

export default hasPermissions;
