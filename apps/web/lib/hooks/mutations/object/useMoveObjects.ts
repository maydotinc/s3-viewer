import { api, objectsPath } from "@/lib/api";
import type { BucketTarget } from "@/lib/types";
import { visibleText } from "@/lib/utils/format";
import {
   answerFrom,
   reportBatchResult,
   runBatched,
   type BatchFailure,
   type BatchSummary,
} from "@/lib/utils/s3/batch";
import {
   OBJECT_MUTATION_PATH,
   objectKeySchema,
   type MoveObjectsInput,
   type S3MoveResult,
} from "@s3-viewer/types";
import useObjectMutation, { forgetTouched } from "./object-mutation";

const MOVE_BATCH_KEYS = 50;

type MoveTarget = MoveObjectsInput["objects"][number];

const pairId = (target: MoveTarget) =>
   JSON.stringify([target.key, target.newKey]);

type MoveSummary = BatchSummary<BatchFailure<MoveTarget>>;

const moveObjects = async (
   path: string,
   objects: readonly MoveTarget[],
   userId: string,
   signal?: AbortSignal
): Promise<MoveSummary> => {
   for (const { key, newKey } of objects) {
      if (!objectKeySchema.safeParse(newKey).success)
         throw new Error(
            `Can't move ${visibleText(key)}: its new key must be valid and at most 1,024 UTF-8 bytes.`
         );
   }
   return runBatched<MoveTarget, S3MoveResult>({
      targets: objects,
      targetId: pairId,
      responseTargetName: ({ key }) => key,
      limit: MOVE_BATCH_KEYS,
      send: (batch) =>
         api.post<S3MoveResult>(
            `${path}${OBJECT_MUTATION_PATH}/move`,
            { expectedUserId: userId, objects: batch },
            signal
         ),
      answer: (result) =>
         answerFrom(result.moved, result.failed, ({ key }) => key),
      unconfirmedMessage:
         "Storage did not confirm the move. Refresh and check this object.",
      transportFailureSuffix:
         "Close this dialog and refresh before moving this object again.",
      signal,
   });
};

const reportMoveResult = (summary: MoveSummary) =>
   reportBatchResult(summary, {
      pastTenseVerb: "moved",
      incomplete: "The move is incomplete",
   });

const useMoveObjects = () =>
   useObjectMutation({
      mutationFn: ({
         userId,
         serverId,
         bucketName,
         objects,
         signal,
      }: BucketTarget & {
         objects: MoveTarget[];
         signal?: AbortSignal;
      }) =>
         moveObjects(
            objectsPath(serverId, bucketName),
            objects,
            userId,
            signal
         ),
      onSuccess: reportMoveResult,
      settle: forgetTouched(
         ({ objects }) => objects.map(({ newKey }) => newKey),
         ({ objects }) => objects.map(({ key }) => key)
      ),
   });

export default useMoveObjects;
export { moveObjects, reportMoveResult };
export type { MoveSummary, MoveTarget };
