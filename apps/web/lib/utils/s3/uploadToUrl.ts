interface UploadResult {
   upload: () => Promise<{ success: boolean; error?: string }>;
   cancel: () => void;
}

const uploadToUrl = (
   presignedUrl: string,
   file: File,
   onProgress?: (progress: number) => void
): UploadResult => {
   let xhr: XMLHttpRequest;

   const upload = (): Promise<{ success: boolean; error?: string }> => {
      xhr = new XMLHttpRequest();

      if (onProgress) {
         xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
               const progress = (event.loaded / event.total) * 100;
               onProgress(progress);
            }
         };
      }

      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type);

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
         xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
               resolve({ success: true });
            } else {
               resolve({
                  success: false,
                  error: `Upload failed (${xhr.status})`,
               });
            }
         };

         xhr.onerror = () =>
            resolve({ success: false, error: "Upload failed" });
         xhr.onabort = () =>
            resolve({ success: false, error: "Upload cancelled" });

         xhr.send(file);
      });
   };

   const cancel = () => {
      if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
         xhr.abort();
      }
   };

   return { upload, cancel };
};

export default uploadToUrl;
