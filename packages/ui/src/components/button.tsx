import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { Spinner } from "@s3-viewer/ui/components/spinner";
import { cn } from "@s3-viewer/ui/lib/utils";

const buttonVariants = cva(
   [
      "relative inline-flex cursor-pointer items-center justify-center whitespace-nowrap",
      "rounded-lg border border-transparent font-medium transition-colors",
      // no focus ring: buttons show focus through their hover styling alone
      "outline-none aria-invalid:border-viewertextred",
      // disabled keeps pointer events so the not-allowed cursor shows; the
      // hover utilities below are gated behind `not-disabled:`.
      "disabled:cursor-not-allowed disabled:opacity-50",
      // `asChild` renders an anchor, which has no `disabled` attribute
      "aria-disabled:pointer-events-none aria-disabled:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
   ],
   {
      variants: {
         variant: {
            default:
               "bg-viewerblue text-viewerwhite not-disabled:hover:bg-viewerdarkblue",
            destructive:
               "bg-viewertextred text-viewerwhite not-disabled:hover:bg-viewertextred/90",
            outline:
               "border-viewerborder bg-viewerwhite text-viewertext not-disabled:hover:bg-viewergray not-disabled:hover:text-viewerblack",
            secondary:
               "bg-viewergray text-viewerblack not-disabled:hover:bg-viewerborder/70",
            ghost: "text-viewertext not-disabled:hover:bg-viewergray not-disabled:hover:text-viewerblack",
            link: "text-viewerblue underline-offset-4 not-disabled:hover:underline",
         },
         size: {
            default: "h-9 gap-2 px-4 text-sm",
            sm: "h-8 gap-1.5 px-3 text-[13px]",
            lg: "h-10 gap-2 px-5 text-sm",
            icon: "size-9 p-0 text-sm",
            "icon-sm": "size-8 p-0 text-sm",
         },
      },
      defaultVariants: {
         variant: "default",
         size: "default",
      },
   }
);

// the label stays mounted but invisible, so the button keeps its idle width;
// never swap the label for "saving…".
const LoadingOverlay = () => (
   <span className="absolute inset-0 flex items-center justify-center">
      <Spinner
         size="sm"
         className="border-current border-r-transparent"
         label="Loading"
      />
   </span>
);

function Button({
   className,
   variant,
   size,
   asChild = false,
   loading = false,
   disabled,
   children,
   ref,
   ...props
}: React.ComponentProps<"button"> &
   VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
      loading?: boolean;
   }) {
   if (asChild) {
      const child = React.isValidElement<{ children?: React.ReactNode }>(
         children
      )
         ? children
         : null;

      return (
         <Slot
            ref={ref}
            data-slot="button"
            data-loading={loading || undefined}
            aria-busy={loading || undefined}
            className={cn(buttonVariants({ variant, size, className }))}
            {...(disabled || loading
               ? { "aria-disabled": true, tabIndex: -1 }
               : {})}
            {...props}
         >
            {loading && child
               ? React.cloneElement(
                    child,
                    undefined,
                    <>
                       <LoadingOverlay />
                       <span className="contents invisible">
                          {child.props.children}
                       </span>
                    </>
                 )
               : children}
         </Slot>
      );
   }

   return (
      <button
         ref={ref}
         data-slot="button"
         data-loading={loading || undefined}
         aria-busy={loading || undefined}
         disabled={disabled || loading}
         className={cn(buttonVariants({ variant, size, className }))}
         {...props}
      >
         {loading && <LoadingOverlay />}
         <span className={cn("contents", loading && "invisible")}>
            {children}
         </span>
      </button>
   );
}

export { Button };
