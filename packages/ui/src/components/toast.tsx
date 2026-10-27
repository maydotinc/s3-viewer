import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

// a described error usually lists what failed, which takes longer to read than the 3 s a one-liner gets
const DESCRIBED_ERROR_MS = 10_000;

const error: typeof sonnerToast.error = (message, data) =>
   sonnerToast.error(
      message,
      data?.description && data.duration === undefined
         ? { ...data, duration: DESCRIBED_ERROR_MS }
         : data
   );

const toast: typeof sonnerToast = Object.assign(
   (...args: Parameters<typeof sonnerToast>) => sonnerToast(...args),
   sonnerToast,
   { error }
);

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
            error: "text-viewerstrongred!",
            success: "text-viewerblack!",
         },
      }}
   />
);

export default Toaster;
export { DESCRIBED_ERROR_MS, toast };
