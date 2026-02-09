import { PrismaClient } from "@prisma/client";

declare global {
   var prisma: PrismaClient | undefined;
}

const getPrismaClient = () => {
   return new PrismaClient();
};

export const prisma = global.prisma || getPrismaClient();

if (process.env.NODE_ENV !== "production") {
   global.prisma = prisma;
}
