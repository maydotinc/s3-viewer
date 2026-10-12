import { ApiError, isAborted } from "@/lib/api";
import { downloadUrl } from "@/lib/utils/download";
import { archiveUrl, requestArchive } from "@/lib/utils/s3/archive";
import type { BucketTarget } from "@/lib/types";
import { toastError } from "@/lib/utils/toast";
import type { S3ArchiveTicket } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

type ArchiveDownloadInput = BucketTarget & {
   objectKeys: string[];
   signal?: AbortSignal;
};

const PREPARING = "Preparing zip…";
const EMPTY = "Nothing to download";
const ARCHIVE_MUTATION_KEY = ["archive-download"] as const;

const reportFailure = (error: unknown) => {
   if (error instanceof ApiError && error.status === 404)
      toast.error(EMPTY, {
         description: "There are no objects under this selection.",
      });
   else toastError("Couldn't prepare the zip")(error);
};

const useArchiveDownload = () =>
   useMutation({
      mutationKey: ARCHIVE_MUTATION_KEY,
      mutationFn: ({
         userId,
         serverId,
         bucketName,
         objectKeys,
         signal,
      }: ArchiveDownloadInput): Promise<S3ArchiveTicket> =>
         requestArchive(serverId, bucketName, userId, objectKeys, signal),
      onMutate: () => ({ toastId: toast.loading(PREPARING) }),
      onSuccess: (ticket, { serverId, bucketName }, context) => {
         if (context) toast.dismiss(context.toastId);
         downloadUrl(archiveUrl(serverId, bucketName, ticket.token));
      },
      onError: (error, _input, context) => {
         if (context) toast.dismiss(context.toastId);
         if (!isAborted(error)) reportFailure(error);
      },
   });

export default useArchiveDownload;
export { ARCHIVE_MUTATION_KEY };
