import type { Request, Response } from "express";
import { EventEmitter } from "node:events";
import { vi } from "vitest";

type FakeResponse = Response & {
   headersSent: boolean;
   writableEnded: boolean;
   destroyed: boolean;
   headers: Record<string, string>;
   req: Request & { setTimeout: ReturnType<typeof vi.fn> };
   // settles with the json body, or undefined for end(), once the route answers
   sent: Promise<unknown>;
};

type FakeResponseState = Partial<
   Pick<FakeResponse, "headersSent" | "writableEnded" | "destroyed">
>;

const fakeResponse = (state: FakeResponseState = {}): FakeResponse => {
   const headers: Record<string, string> = {};
   const sent = Promise.withResolvers<unknown>();
   const res: FakeResponse = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      statusCode: 200,
      locals: {},
      headers,
      sent: sent.promise,
      req: { setTimeout: vi.fn() },
      setHeader(name: string, value: number | string | readonly string[]) {
         if (res.headersSent) {
            throw Object.assign(
               new Error("Cannot set headers after they are sent"),
               { code: "ERR_HTTP_HEADERS_SENT" }
            );
         }
         headers[name] = String(value);
         return res;
      },
      getHeader: (name: string) => headers[name],
      status(code: number) {
         res.statusCode = code;
         return res;
      },
      json(body: unknown) {
         sent.resolve(body);
         return res;
      },
      end() {
         sent.resolve(undefined);
         return res;
      },
      ...state,
   }) as unknown as FakeResponse;
   return res;
};

export { fakeResponse };
