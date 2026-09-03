export const isFolderKey = (key: string): boolean => key.endsWith("/");

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

export const mapLimit = async <T, R>(
   items: readonly T[],
   limit: number,
   fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
   const results: R[] = new Array<R>(items.length);
   let next = 0;
   let failed = false;

   const worker = async () => {
      while (!failed) {
         const index = next++;
         if (index >= items.length) return;
         try {
            results[index] = await fn(items[index] as T, index);
         } catch (error) {
            failed = true;
            throw error;
         }
      }
   };

   await Promise.all(
      Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
   );
   return results;
};
