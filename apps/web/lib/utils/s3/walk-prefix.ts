import { api, cancelledError, qs } from "@/lib/api";
import type { S3KeysPage } from "@s3-viewer/shared";

const REPEATED_PAGE = "Storage repeated a folder listing page.";
const OUTSIDE_PREFIX = "Storage returned an object outside this folder.";

const acceptKeysPage = (
   page: S3KeysPage,
   prefix: string,
   tokens: Set<string>
): string | undefined => {
   if (page.nextToken && tokens.has(page.nextToken))
      throw new Error(REPEATED_PAGE);
   if (page.objects.some(({ key }) => !key.startsWith(prefix)))
      throw new Error(OUTSIDE_PREFIX);
   if (page.nextToken) tokens.add(page.nextToken);
   return page.nextToken ?? undefined;
};

const fetchKeysPage = (
   path: string,
   prefix: string,
   continuationToken: string | undefined,
   signal?: AbortSignal
): Promise<S3KeysPage> =>
   api.get<S3KeysPage>(
      `${path}/keys${qs({ prefix, continuationToken })}`,
      signal
   );

const walkPrefix = async function* (
   path: string,
   prefix: string,
   signal?: AbortSignal
): AsyncGenerator<S3KeysPage> {
   const tokens = new Set<string>();
   let continuationToken: string | undefined;
   do {
      if (signal?.aborted) throw cancelledError();
      const page = await fetchKeysPage(path, prefix, continuationToken, signal);
      continuationToken = acceptKeysPage(page, prefix, tokens);
      yield page;
   } while (continuationToken);
};

export { acceptKeysPage, fetchKeysPage, walkPrefix };
