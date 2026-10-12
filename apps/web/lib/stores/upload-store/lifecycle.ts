// lets auth pause and clear uploads without importing the upload engine into the shared app chunk
let suspensions = 0;
let reset: (() => Promise<void>) | null = null;

const suspendUploads = (): (() => void) => {
   suspensions++;
   let released = false;
   return () => {
      if (released) return;
      released = true;
      suspensions--;
   };
};

const uploadsSuspended = (): boolean => suspensions > 0;

const registerUploadReset = (handler: () => Promise<void>): void => {
   reset = handler;
};

// resolves at once when the upload store was never loaded, so there is nothing to cancel
const resetUploads = (): Promise<void> => reset?.() ?? Promise.resolve();

export { registerUploadReset, resetUploads, suspendUploads, uploadsSuspended };
