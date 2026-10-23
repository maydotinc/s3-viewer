import { publicEnv } from "./env";
import { anySignal } from "@/lib/utils/any-signal";
import useSessionStore from "@/lib/stores/session-store";
import {
   GENERIC_ERROR_MESSAGE,
   EXPECTED_USER_ID_HEADER,
   ErrorCode,
   MINUTE_MS,
   MULTIPART_UPLOADS_PATH,
   OBJECT_MUTATION_PATH,
   type ApiError as ApiErrorBody,
} from "@s3-viewer/types";

const ClientErrorCode = {
   NETWORK: "NETWORK",
   ABORTED: "ABORTED",
   BAD_RESPONSE: "BAD_RESPONSE",
   NOT_UTF8: "NOT_UTF8",
   UPLOAD_OUTCOME_UNKNOWN: "UPLOAD_OUTCOME_UNKNOWN",
} as const;

const NETWORK_MESSAGE =
   "Couldn't reach the server. Check your connection and try again.";

const TIMEOUT_MESSAGE = "The server took too long to answer. Try again.";

// the API drops a silent socket after two minutes, so a read still open past that is stuck on a dead connection.
// writes get no bound: a large copy runs as long as storage needs, and abandoning one would leave its outcome unknown
const READ_TIMEOUT_MS = 2 * MINUTE_MS;

class ApiError extends Error {
   constructor(
      public readonly status: number,
      message: string,
      public readonly code?: string
   ) {
      super(message);
      this.name = "ApiError";
   }
}

const apiUrl = (path: string) => `${publicEnv.apiOrigin}${path}`;

const networkError = () =>
   new ApiError(0, NETWORK_MESSAGE, ClientErrorCode.NETWORK);

const cancelledError = () =>
   new ApiError(0, "Request cancelled", ClientErrorCode.ABORTED);

const timeoutError = () =>
   new ApiError(0, TIMEOUT_MESSAGE, ClientErrorCode.NETWORK);

const transportError = (error: unknown) =>
   error instanceof DOMException && error.name === "AbortError"
      ? cancelledError()
      : error instanceof DOMException && error.name === "TimeoutError"
        ? timeoutError()
        : networkError();

const withReadTimeout = (signal: AbortSignal | undefined): AbortSignal => {
   const timeout = AbortSignal.timeout(READ_TIMEOUT_MS);
   return signal ? anySignal([signal, timeout]) : timeout;
};

const BAD_RESPONSE_MESSAGE =
   "The server sent an unexpected response. Try again.";

// a body that is not JSON (a proxy's maintenance page, say) is the server's fault, not the connection's.
const bodyError = (res: Response, error: unknown) =>
   error instanceof SyntaxError
      ? new ApiError(
           res.status,
           BAD_RESPONSE_MESSAGE,
           ClientErrorCode.BAD_RESPONSE
        )
      : transportError(error);

const isAborted = (error: unknown) =>
   error instanceof ApiError && error.code === ClientErrorCode.ABORTED;

let onAccessRefusal: () => void = () => {};

const setAccessRefusalHandler = (handler: () => void): void => {
   onAccessRefusal = handler;
};

// a bare 403 is a role refusal, so the cached role or folder scope is out of date
const isAccessRefusal = (error: ApiError) =>
   error.code === ErrorCode.FOLDER_ACCESS ||
   (error.status === 403 && error.code === undefined);

const responseError = (status: number, data: ApiErrorBody | null) => {
   const error = new ApiError(
      status,
      data?.message ?? GENERIC_ERROR_MESSAGE,
      data?.code
   );
   if (isAccessRefusal(error)) onAccessRefusal();
   return error;
};

let onUnauthorized: () => void = () => {};

const setUnauthorizedHandler = (handler: () => void): void => {
   onUnauthorized = handler;
};

const handleUnauthorized = (userId: string | null): void => {
   if (useSessionStore.getState().userId === userId) onUnauthorized();
};

const failedResponse = async (
   res: Response,
   userId: string | null
): Promise<ApiError> => {
   const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
   if (res.status === 401) handleUnauthorized(userId);
   return responseError(res.status, data);
};

const send = async (
   method: "GET" | "POST" | "PATCH" | "DELETE",
   path: string,
   body?: unknown,
   signal?: AbortSignal
): Promise<Response> => {
   const userId = useSessionStore.getState().userId;
   let res: Response;
   try {
      res = await fetch(apiUrl(path), {
         method,
         credentials: "include",
         signal,
         headers: {
            ...(body === undefined
               ? {}
               : { "Content-Type": "application/json" }),
            ...(method !== "GET" && userId
               ? { [EXPECTED_USER_ID_HEADER]: userId }
               : {}),
         },
         body: body === undefined ? undefined : JSON.stringify(body),
      });
   } catch (error) {
      throw transportError(error);
   }
   if (!res.ok) throw await failedResponse(res, userId);
   return res;
};

const request = async <T>(
   method: "GET" | "POST" | "PATCH" | "DELETE",
   path: string,
   body?: unknown,
   signal?: AbortSignal
): Promise<T> => {
   const res = await send(
      method,
      path,
      body,
      method === "GET" ? withReadTimeout(signal) : signal
   );
   if (res.status === 204) return undefined as T;
   try {
      return (await res.json()) as T;
   } catch (error) {
      throw bodyError(res, error);
   }
};

const api = {
   get: <T>(path: string, signal?: AbortSignal) =>
      request<T>("GET", path, undefined, signal),
   blob: async (path: string, signal?: AbortSignal) => {
      const res = await send("GET", path, undefined, signal);
      try {
         return await res.blob();
      } catch (error) {
         throw transportError(error);
      }
   },
   bytes: async (path: string, signal?: AbortSignal) => {
      const res = await send("GET", path, undefined, signal);
      try {
         return { body: await res.arrayBuffer(), headers: res.headers };
      } catch (error) {
         throw transportError(error);
      }
   },
   post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
      request<T>("POST", path, body, signal),
   patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
      request<T>("PATCH", path, body, signal),
   delete: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
      request<T>("DELETE", path, body, signal),
};

const field =
   <K extends string>(key: K) =>
   <T>(body: Record<K, T>): T =>
      body[key];

const errorMessage = (error: unknown): string =>
   error instanceof Error && error.message
      ? error.message
      : GENERIC_ERROR_MESSAGE;

const qs = (params: Record<string, string | number | undefined | null>) => {
   const sp = new URLSearchParams();
   for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
   }
   const s = sp.toString();
   return s ? `?${s}` : "";
};

const serverPath = (serverId: string) =>
   `/servers/${encodeURIComponent(serverId)}`;

const memberPath = (serverId: string, userId: string) =>
   `${serverPath(serverId)}/members/${encodeURIComponent(userId)}`;

const serverInvitePath = (serverId: string, inviteId: string) =>
   `${serverPath(serverId)}/invites/${encodeURIComponent(inviteId)}`;

const invitePath = (inviteId: string) =>
   `/invites/${encodeURIComponent(inviteId)}`;

const bucketPath = (serverId: string, bucketName: string) =>
   `${serverPath(serverId)}/buckets/${encodeURIComponent(bucketName)}`;

const objectsPath = (serverId: string, bucketName: string, suffix = "") =>
   `${bucketPath(serverId, bucketName)}/objects${suffix}`;

const objectMutationPath = (
   serverId: string,
   bucketName: string,
   suffix = ""
) => objectsPath(serverId, bucketName, `${OBJECT_MUTATION_PATH}${suffix}`);

const multipartUploadsPath = (serverId: string, bucketName: string) =>
   objectsPath(serverId, bucketName, MULTIPART_UPLOADS_PATH);

export {
   ApiError,
   ClientErrorCode,
   api,
   apiUrl,
   bucketPath,
   cancelledError,
   errorMessage,
   field,
   handleUnauthorized,
   invitePath,
   isAborted,
   memberPath,
   multipartUploadsPath,
   networkError,
   objectMutationPath,
   objectsPath,
   qs,
   responseError,
   serverInvitePath,
   serverPath,
   setAccessRefusalHandler,
   setUnauthorizedHandler,
};
