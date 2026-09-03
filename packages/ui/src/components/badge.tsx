import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

const badgeVariants = cva(
   [
      "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden select-none",
      "rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      "transition-colors outline-none aria-invalid:border-viewertextred",
      "[&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-3",
   ],
   {
      variants: {
         variant: {
            default:
               "bg-viewerblue text-viewerwhite [a&]:hover:bg-viewerdarkblue",
            secondary:
               "bg-viewergray text-viewerblack [a&]:hover:bg-viewerborder/70",
            destructive:
               "bg-viewerbgred text-viewertextred [a&]:hover:bg-viewerbgred/70",
            outline:
               "border-viewerborder bg-viewerwhite text-viewertext [a&]:hover:bg-viewergray [a&]:hover:text-viewerblack",
         },
      },
      defaultVariants: {
         variant: "default",
      },
   }
);

function Badge({
   className,
   variant,
   asChild = false,
   ...props
}: React.ComponentProps<"span"> &
   VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
   const Comp = asChild ? Slot : "span";

   return (
      <Comp
         data-slot="badge"
         className={cn(badgeVariants({ variant }), className)}
         {...props}
      />
   );
}

export { Badge };
