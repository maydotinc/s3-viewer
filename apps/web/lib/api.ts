import { publicEnv } from "@/lib/env";
import {
   GENERIC_ERROR_MESSAGE,
   type ApiError as ApiErrorBody,
} from "@s3-viewer/types";

const NETWORK_MESSAGE =
   "Couldn't reach the server. Check your connection and try again.";

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

const networkError = () => new ApiError(0, NETWORK_MESSAGE, "NETWORK");

const responseError = (status: number, data: ApiErrorBody | null) =>
   new ApiError(status, data?.message ?? GENERIC_ERROR_MESSAGE, data?.code);

const request = async <T>(
   method: "GET" | "POST" | "PATCH" | "DELETE",
   path: string,
   body?: unknown
): Promise<T> => {
   let res: Response;
   try {
      res = await fetch(apiUrl(path), {
         method,
         credentials: "include",
         headers:
            body === undefined
               ? undefined
               : { "Content-Type": "application/json" },
         body: body === undefined ? undefined : JSON.stringify(body),
      });
   } catch {
      throw networkError();
   }
   if (!res.ok) {
      const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw responseError(res.status, data);
   }
   if (res.status === 204) return undefined as T;
   return (await res.json()) as T;
};

const api = {
   get: <T>(path: string) => request<T>("GET", path),
   post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
   patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
   delete: <T>(path: string, body?: unknown) =>
      request<T>("DELETE", path, body),
};

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

const objectsPath = (serverId: string, bucketName: string) =>
   `${bucketPath(serverId, bucketName)}/objects`;

export {
   ApiError,
   api,
   apiUrl,
   bucketPath,
   errorMessage,
   invitePath,
   memberPath,
   networkError,
   objectsPath,
   qs,
   responseError,
   serverInvitePath,
   serverPath,
};
