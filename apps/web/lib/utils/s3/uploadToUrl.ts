const uploadToUrl = async (
   presignedUrl: string,
   file: File,
   onProgress?: (progress: number) => void
): Promise<void> => {
   return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

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
            reject(new Error(`Upload failed: ${xhr.statusText}`));
         }
      };

      xhr.onerror = () => {
         reject(new Error("Upload failed"));
      };

      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
   });
};

export default uploadToUrl;
