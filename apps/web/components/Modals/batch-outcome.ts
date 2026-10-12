type BatchFailure = { retryable: boolean };

type BatchInput<T extends BatchFailure> = {
   failed: T[];
   listingError?: string | null;
   completedCount?: number;
};

type BatchOutcome<T extends BatchFailure> = {
   retryable: T[];
   needsReview: T[];
   attempted: boolean;
   stuck: boolean;
};

const batchOutcome = <T extends BatchFailure>({
   failed,
   listingError = null,
   completedCount = 0,
}: BatchInput<T>): BatchOutcome<T> => {
   const retryable = failed.filter((failure) => failure.retryable);
   return {
      retryable,
      needsReview: failed.filter((failure) => !failure.retryable),
      attempted:
         completedCount > 0 || failed.length > 0 || Boolean(listingError),
      stuck: failed.length > 0 && retryable.length === 0 && !listingError,
   };
};

const reviewNotice = (action: string): string =>
   `Some objects need to be reviewed again. Close this dialog and refresh before ${action}.`;

export { batchOutcome, reviewNotice };
