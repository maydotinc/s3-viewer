class UploadCancelled extends Error {
   constructor() {
      super("Upload cancelled");
      this.name = "UploadCancelled";
   }
}

const isCancelled = (error: unknown): error is UploadCancelled =>
   error instanceof UploadCancelled;

export { UploadCancelled, isCancelled };
