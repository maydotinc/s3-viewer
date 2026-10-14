import { toast } from "@s3-viewer/ui/components/toast";

// only for same-origin urls and the API's own, which always answer with an attachment; Safari
// refuses downloads in a frame when the response forbids framing, as the API's responses do
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

const FRAME_LIFETIME_MS = 60_000;
const UNSTARTED_TOAST_MS = 10_000;

// a cross-origin anchor ignores download and would navigate the app away whenever a provider
// serves the file inline anyway; a frame needs no user activation, so it isn't popup-blocked
// after the await for the presigned url. browsers fire no load for a download, so a load
// means the provider rendered a page (an error, or the file itself) instead
const downloadFromStorage = (url: string): void => {
   const frame = document.createElement("iframe");
   frame.hidden = true;
   frame.setAttribute("sandbox", "allow-downloads");
   frame.src = url;
   const timer = setTimeout(() => frame.remove(), FRAME_LIFETIME_MS);
   frame.addEventListener(
      "load",
      () => {
         clearTimeout(timer);
         frame.remove();
         toast.error("The download didn't start", {
            description: "Your storage returned a page instead of the file.",
            duration: UNSTARTED_TOAST_MS,
            action: {
               label: "Open",
               onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
            },
         });
      },
      { once: true }
   );
   document.body.appendChild(frame);
};

const REVOKE_AFTER_MS = 60_000;

const saveBlob = (name: string, blob: Blob): void => {
   const url = URL.createObjectURL(blob);
   downloadUrl(url, name);
   setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
};

export { downloadFromStorage, downloadUrl, saveBlob };
