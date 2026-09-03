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
   animate = true,
   className,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
   animate?: boolean;
}) {
   return (
      <DialogPrimitive.Overlay
         data-slot="dialog-overlay"
         className={cn(
            "fixed inset-0 z-50 bg-viewerblack/20 backdrop-blur-[4px]",
            animate &&
               "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
         )}
         {...props}
      />
   );
}

function DialogContent({
   animate = true,
   className,
   children,
   showCloseButton = true,
   ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
   showCloseButton?: boolean;
   animate?: boolean;
}) {
   return (
      <DialogPortal data-slot="dialog-portal">
         <DialogOverlay animate={animate} />
         <DialogPrimitive.Content
            data-slot="dialog-content"
            className={cn(
               "bg-background outline-none focus-visible:outline-none fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border p-6 shadow-lg duration-200 sm:max-w-lg",
               animate &&
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
               className
            )}
            {...props}
         >
            {children}
            {showCloseButton && (
               <DialogPrimitive.Close
                  data-slot="dialog-close"
                  className="text-viewertext cursor-pointer absolute top-4 right-4 rounded-sm p-0.5 opacity-70 transition-opacity hover:opacity-100 outline-none focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-viewerblue/30 focus-visible:border-viewerblue disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
               >
                  <XIcon />
                  <span className="sr-only">Close</span>
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
         className={cn("flex flex-col gap-2 text-center", className)}
         {...props}
      />
   );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="dialog-footer"
         className={cn("flex gap-2", className)}
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
         className={cn("text-heading", className)}
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
         className={cn("text-viewertext text-sm", className)}
         {...props}
      />
   );
}

export {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
};
