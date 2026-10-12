import { useEffect } from "react";

const blockStrayFileDrop = (event: DragEvent): void => {
   const transfer = event.dataTransfer;
   if (event.defaultPrevented || !transfer?.types.includes("Files")) return;
   event.preventDefault();
   transfer.dropEffect = "none";
};

const useFileDropGuard = (): void => {
   useEffect(() => {
      window.addEventListener("dragover", blockStrayFileDrop);
      window.addEventListener("drop", blockStrayFileDrop);
      return () => {
         window.removeEventListener("dragover", blockStrayFileDrop);
         window.removeEventListener("drop", blockStrayFileDrop);
      };
   }, []);
};

export default useFileDropGuard;
