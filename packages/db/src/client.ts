import { PrismaClient } from "@prisma/client";

declare global {
   var prisma: PrismaClient | undefined;
}

const isProduction = process.env.NODE_ENV === "production";

const getPrismaClient = () => {
   return new PrismaClient({
      log: isProduction ? ["warn", "error"] : ["query", "warn", "error"],
   });
};

export const prisma = global.prisma || getPrismaClient();

if (!isProduction) {
   global.prisma = prisma;
}
