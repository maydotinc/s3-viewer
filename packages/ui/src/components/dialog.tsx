import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

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

function DialogClose({
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
   return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
   className,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
   return (
      <DialogPrimitive.Overlay
         data-slot="dialog-overlay"
         className={cn("fixed inset-0 z-50 bg-viewerblack/40", className)}
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
            className={cn(
               "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite shadow-lg outline-none",
               className
            )}
            {...props}
         >
            {children}
            {showCloseButton && (
               <DialogPrimitive.Close
                  data-slot="dialog-close"
                  aria-label="Close"
                  className="absolute top-4 right-4 flex size-8 cursor-pointer items-center justify-center rounded-md text-viewertext transition-colors outline-none not-disabled:hover:bg-viewergray not-disabled:hover:text-viewerblack [&_svg]:size-4 [&_svg]:shrink-0"
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
         className={cn("flex flex-col gap-1 px-6 pt-5 pr-12 pb-4", className)}
         {...props}
      />
   );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="dialog-body"
         className={cn("min-h-0 overflow-y-auto px-6 py-4", className)}
         {...props}
      />
   );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="dialog-footer"
         className={cn("flex justify-end gap-2 px-6 pt-2 pb-5", className)}
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
   Dialog,
   DialogBody,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
};
