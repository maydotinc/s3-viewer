import { Prisma } from "@prisma/client";

const isPrismaError = (error: unknown, code: string): boolean =>
   error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const isUniqueViolation = (error: unknown): boolean =>
   isPrismaError(error, "P2002");

const isMissingRow = (error: unknown): boolean => isPrismaError(error, "P2025");

const isMissingTable = (error: unknown): boolean =>
   isPrismaError(error, "P2021");

export { isMissingRow, isMissingTable, isUniqueViolation };
