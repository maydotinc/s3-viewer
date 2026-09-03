import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

const buttonVariants = cva(
   "inline-flex hover:cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-viewerblue aria-invalid:border-viewertextred",
   {
      variants: {
         variant: {
            default:
               "bg-viewerblue text-viewerwhite hover:bg-viewerdarkblue focus-visible:border-viewerdarkblue",
            destructive:
               "bg-viewertextred text-viewerwhite hover:bg-viewertextred/90 focus-visible:border-viewerblack",
            outline:
               "border-viewerborder bg-viewerwhite text-viewertext hover:bg-viewergray hover:text-viewerblack",
            secondary:
               "bg-viewergray text-viewerblack hover:bg-viewerborder/70",
            ghost: "text-viewertext hover:bg-viewergray hover:text-viewerblack",
            link: "text-viewerblue underline-offset-4 hover:underline",
         },
         size: {
            default: "h-9 px-4 py-2 has-[>svg]:px-3",
            sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
            lg: "h-10 rounded-lg px-6 has-[>svg]:px-4",
            icon: "size-9",
         },
      },
      defaultVariants: {
         variant: "default",
         size: "default",
      },
   }
);

type ButtonElement = HTMLElement & { style: CSSStyleDeclaration };

const useKeepWidthWhileLoading = (
   loading: boolean,
   forwardedRef: React.Ref<HTMLButtonElement> | undefined
) => {
   const element = React.useRef<ButtonElement | null>(null);
   const idleWidth = React.useRef<number | null>(null);

   React.useLayoutEffect(() => {
      const node = element.current;
      if (!node) return;
      const minWidth =
         loading && idleWidth.current ? `${idleWidth.current}px` : "";
      if (node.style.minWidth !== minWidth) node.style.minWidth = minWidth;
      if (!loading) idleWidth.current = node.offsetWidth;
   });

   return (node: HTMLButtonElement | null) => {
      element.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
   };
};

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
   const setRef = useKeepWidthWhileLoading(loading, ref);

   if (asChild) {
      const child = React.isValidElement<{ children?: React.ReactNode }>(
         children
      )
         ? children
         : null;

      return (
         <Slot
            ref={setRef}
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
                       <Loader2 className="animate-spin" aria-hidden="true" />
                       {child.props.children}
                    </>
                 )
               : children}
         </Slot>
      );
   }

   return (
      <button
         ref={setRef}
         data-slot="button"
         data-loading={loading || undefined}
         aria-busy={loading || undefined}
         disabled={disabled || loading}
         className={cn(buttonVariants({ variant, size, className }))}
         {...props}
      >
         {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
         {children}
      </button>
   );
}

export { Button };
