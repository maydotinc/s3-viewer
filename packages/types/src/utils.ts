import { isDotSegment } from "./folder-scope";

export const normalizeEmail = (email: string): string =>
   email.trim().toLowerCase();

export const joinList = (items: readonly string[]): string => {
   if (items.length <= 1) return items.join("");
   return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
};

export const formatEmailDomains = (domains: readonly string[]): string =>
   joinList(domains.map((domain) => `@${domain}`));

export const canPresignObjectKey = (key: string): boolean =>
   !key.split("/").some(isDotSegment);

export const isFolderKey = (key: string): boolean => key.endsWith("/");

export const parentPrefix = (key: string): string =>
   key.slice(0, key.lastIndexOf("/") + 1);

export const backblazeRegion = (endpoint: string): string | undefined => {
   let url: URL;
   try {
      url = new URL(endpoint.trim());
   } catch {
      return undefined;
   }
   if (url.protocol !== "https:") return undefined;
   return /^(?:[a-z0-9][a-z0-9.-]*\.)?s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(
      url.hostname.replace(/\.$/, "")
   )?.[1];
};

export const baseName = (objectKey: string): string => {
   const trimmed = isFolderKey(objectKey) ? objectKey.slice(0, -1) : objectKey;
   return trimmed.slice(trimmed.lastIndexOf("/") + 1) || objectKey;
};

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
   const out: T[][] = [];
   for (let i = 0; i < items.length; i += size)
      out.push(items.slice(i, i + size));
   return out;
};

export const chunkKeys = (
   keys: readonly string[],
   maxKeys: number,
   maxChars: number
): string[][] => {
   const out: string[][] = [];
   let batch: string[] = [];
   let chars = 0;
   for (const key of keys) {
      if (
         batch.length >= maxKeys ||
         (batch.length > 0 && chars + key.length > maxChars)
      ) {
         out.push(batch);
         batch = [];
         chars = 0;
      }
      batch.push(key);
      chars += key.length;
   }
   if (batch.length > 0) out.push(batch);
   return out;
};

type MapLimitOptions = {
   // aborted items remain undefined.
   signal?: AbortSignal;
   settle?: boolean;
};

export function mapLimit<T, R>(
   items: readonly T[],
   limit: number,
   fn: (item: T, index: number) => Promise<R>
): Promise<R[]>;
export function mapLimit<T, R>(
   items: readonly T[],
   limit: number,
   fn: (item: T, index: number) => Promise<R>,
   options: MapLimitOptions & { signal?: undefined }
): Promise<R[]>;
export function mapLimit<T, R>(
   items: readonly T[],
   limit: number,
   fn: (item: T, index: number) => Promise<R>,
   options: MapLimitOptions
): Promise<(R | undefined)[]>;
export async function mapLimit<T, R>(
   items: readonly T[],
   limit: number,
   fn: (item: T, index: number) => Promise<R>,
   { signal, settle = false }: MapLimitOptions = {}
): Promise<(R | undefined)[]> {
   const results = new Array<R | undefined>(items.length);
   let next = 0;
   let failure: { error: unknown } | undefined;

   const worker = async () => {
      while (!failure && !signal?.aborted) {
         const index = next++;
         if (index >= items.length) return;
         try {
            results[index] = await fn(items[index] as T, index);
         } catch (error) {
            failure ??= { error };
            if (!settle) throw error;
         }
      }
   };

   await Promise.all(
      Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
   );
   if (failure) throw failure.error;
   return results;
}

export const describeError = (error: unknown): string =>
   error instanceof Error ? `${error.name}: ${error.message}` : String(error);
