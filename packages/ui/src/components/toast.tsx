import { Toaster as SonnerToaster } from "sonner";

// Sonner injects styles after Tailwind; ! keeps these overrides effective.
const Toaster = () => (
   <SonnerToaster
      position="bottom-center"
      duration={3000}
      gap={8}
      offset={16}
      // phones keep the upload sheet's header pinned to the bottom edge.
      mobileOffset={{ bottom: 72, left: 16, right: 16 }}
      toastOptions={{
         classNames: {
            toast: "rounded-lg! border! border-viewerborder! bg-viewerwhite! font-sans! text-sm! text-viewerblack! shadow-md!",
            title: "text-sm font-medium text-viewerblack!",
            description: "text-sm text-viewertext!",
            icon: "text-viewertext!",
            actionButton:
               "rounded-md! bg-viewerblue! px-2.5! text-xs! font-medium! text-viewerwhite!",
            cancelButton:
               "rounded-md! bg-viewergray! px-2.5! text-xs! font-medium! text-viewerblack!",
            error: "text-viewertextred!",
            success: "text-viewerblack!",
         },
      }}
   />
);

export default Toaster;
export { toast } from "sonner";
