class UploadCancelledError extends Error {
   constructor() {
      super("Upload cancelled");
      this.name = "UploadCancelledError";
   }
}

const isCancelled = (error: unknown): error is UploadCancelledError =>
   error instanceof UploadCancelledError;

export { UploadCancelledError, isCancelled };
