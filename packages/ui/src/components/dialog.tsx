import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";

const DIALOG_OVERLAY = "fixed inset-0 z-50 bg-viewerblack/40";

const DIALOG_CONTENT =
   "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite shadow-lg outline-none";

function Dialog({
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
   return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogPortal({
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
   return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({
   className,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
   return (
      <DialogPrimitive.Overlay
         data-slot="dialog-overlay"
         data-backdrop=""
         className={cn(DIALOG_OVERLAY, className)}
         {...props}
      />
   );
}

function DialogContent({
   className,
   children,
   showCloseButton = true,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
   showCloseButton?: boolean;
}) {
   return (
      <DialogPortal data-slot="dialog-portal">
         <DialogOverlay />
         <DialogPrimitive.Content
            data-slot="dialog-content"
            className={cn(DIALOG_CONTENT, className)}
            {...props}
         >
            {children}
            {showCloseButton && (
               <DialogPrimitive.Close
                  data-slot="dialog-close"
                  aria-label="Close"
                  className={cn(
                     "absolute top-4 right-4 flex size-8 cursor-pointer items-center justify-center rounded-md pointer-coarse:top-2.5 pointer-coarse:right-2.5 pointer-coarse:size-11 text-viewertext transition-colors outline-none not-disabled:hover:bg-viewergray not-disabled:hover:text-viewerblack [&_svg]:size-4 [&_svg]:shrink-0",
                     FOCUS_RING
                  )}
               >
                  <XIcon aria-hidden="true" />
               </DialogPrimitive.Close>
            )}
         </DialogPrimitive.Content>
      </DialogPortal>
   );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="dialog-header"
         className={cn(
            "flex max-h-[min(35dvh,16rem)] min-w-0 shrink-0 flex-col gap-1 overflow-y-auto px-4 pt-5 pr-12 pb-4 [overflow-wrap:anywhere] [scrollbar-gutter:stable] sm:px-6 sm:pr-12 pointer-coarse:pr-14",
            className
         )}
         {...props}
      />
   );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="dialog-body"
         className={cn(
            "min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-gutter:stable] sm:px-6",
            className
         )}
         {...props}
      />
   );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="dialog-footer"
         className={cn(
            "flex min-w-0 shrink-0 flex-wrap justify-end gap-2 px-4 pt-2 pb-5 [&>button]:h-auto [&>button]:min-h-9 pointer-coarse:[&>button]:min-h-11 [&>button]:whitespace-normal sm:px-6",
            className
         )}
         {...props}
      />
   );
}

function DialogTitle({
   className,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
   return (
      <DialogPrimitive.Title
         data-slot="dialog-title"
         className={cn(
            "text-base leading-6 font-semibold text-viewerblack",
            className
         )}
         {...props}
      />
   );
}

function DialogDescription({
   className,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
   return (
      <DialogPrimitive.Description
         data-slot="dialog-description"
         className={cn("text-sm text-viewertext", className)}
         {...props}
      />
   );
}

export {
   DIALOG_CONTENT,
   DIALOG_OVERLAY,
   Dialog,
   DialogBody,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
};
