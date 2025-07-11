interface UploadResult {
   promise: Promise<void>;
   cancel: () => void;
}

const uploadToUrl = (
   presignedUrl: string,
   file: File,
   onProgress?: (progress: number) => void
): UploadResult => {
   let xhr: XMLHttpRequest;

   const promise = new Promise<void>((resolve, reject) => {
      xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
         if (event.lengthComputable && onProgress) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
         }
      };

      xhr.onload = () => {
         if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
         } else {
            reject(
               new Error(`Uploading ${file.name} failed: ${xhr.statusText}`)
            );
         }
      };

      xhr.onerror = () => {
         reject(new Error(`Uploading ${file.name} failed: ${xhr.statusText}`));
      };

      xhr.onabort = () => {
         reject(new Error(`Uploading ${file.name} cancelled`));
      };

      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
   });

   const cancel = () => {
      if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
         xhr.abort();
      }
   };

   return { promise, cancel };
};

export default uploadToUrl;
