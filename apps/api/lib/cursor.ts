import { ApiHttpError } from "./http";
import { Prisma } from "@prisma/client";
import { ErrorCode, isDatabaseDate, isDatabaseText } from "@s3-viewer/types";

type Position = { createdAt: Date; id: string };

const CURSOR_ID_MAX = 64;

const encodeCursorText = (text: string): string =>
   Buffer.from(text, "utf8").toString("base64url");

const encodeCursor = ({ createdAt, id }: Position): string =>
   encodeCursorText(`${createdAt.toISOString()}|${id}`);

const invalidCursor = (): never => {
   throw new ApiHttpError(400, "Invalid cursor", ErrorCode.VALIDATION);
};

const decodeCursorText = (cursor: string): string => {
   if (
      cursor.length === 0 ||
      cursor.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(cursor)
   )
      return invalidCursor();
   const bytes = Buffer.from(cursor, "base64url");
   if (bytes.toString("base64url") !== cursor) return invalidCursor();
   let decoded: string;
   try {
      decoded = new TextDecoder("utf-8", {
         fatal: true,
         ignoreBOM: true,
      }).decode(bytes);
   } catch {
      return invalidCursor();
   }
   if (!isDatabaseText(decoded)) return invalidCursor();
   return decoded;
};

const decodeCursor = (cursor: string): Position => {
   const parts = decodeCursorText(cursor).split("|");
   const [timestamp, id] = parts;
   const createdAt = new Date(timestamp ?? "");
   if (
      parts.length !== 2 ||
      !id ||
      id.length > CURSOR_ID_MAX ||
      !isDatabaseDate(createdAt) ||
      createdAt.toISOString() !== timestamp
   )
      return invalidCursor();
   return { createdAt, id };
};

const SEEK_OPERATOR = { asc: Prisma.raw(">"), desc: Prisma.raw("<") };

// row-value comparison lets PostgreSQL seek directly to each page; Prisma's OR form cannot.
const keysetAfter = (
   { createdAt, id }: Position,
   order: keyof typeof SEEK_OPERATOR
): Prisma.Sql =>
   Prisma.sql`("createdAt", "id") ${SEEK_OPERATOR[order]} (${createdAt.toISOString()}::timestamp, ${id})`;

const pageWith = <Row>(
   rows: readonly Row[],
   limit: number,
   encode: (row: Row) => string
): { page: Row[]; nextCursor: string | null } => {
   const page = rows.slice(0, limit);
   const last = page.at(-1);
   return {
      page,
      nextCursor: rows.length > limit && last ? encode(last) : null,
   };
};

const pageOf = <Row extends Position>(
   rows: readonly Row[],
   limit: number
): { page: Row[]; nextCursor: string | null } =>
   pageWith(rows, limit, encodeCursor);

export {
   CURSOR_ID_MAX,
   decodeCursor,
   decodeCursorText,
   encodeCursor,
   encodeCursorText,
   invalidCursor,
   keysetAfter,
   pageOf,
   pageWith,
};
export type { Position };
