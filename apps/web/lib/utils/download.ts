const downloadUrl = (url: string, fileName?: string): void => {
   const anchor = document.createElement("a");
   anchor.href = url;
   if (fileName !== undefined) anchor.download = fileName;
   anchor.rel = "noopener";
   anchor.style.display = "none";
   document.body.appendChild(anchor);
   try {
      anchor.click();
   } finally {
      anchor.remove();
   }
};

const REVOKE_AFTER_MS = 60_000;

const saveBlob = (name: string, blob: Blob): void => {
   const url = URL.createObjectURL(blob);
   downloadUrl(url, name);
   setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
};

export { downloadUrl, saveBlob };
