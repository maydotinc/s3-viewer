import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
   return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
   return (
      <ol
         data-slot="breadcrumb-list"
         className={cn(
            "flex min-w-0 items-center gap-1.5 text-sm text-viewertext",
            className
         )}
         {...props}
      />
   );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
   return (
      <li
         data-slot="breadcrumb-item"
         className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
         {...props}
      />
   );
}

function BreadcrumbLink({
   asChild,
   className,
   ...props
}: React.ComponentProps<"a"> & {
   asChild?: boolean;
}) {
   const Comp = asChild ? Slot : "a";

   return (
      <Comp
         data-slot="breadcrumb-link"
         className={cn(
            "min-w-0 transition-colors hover:text-viewerblack",
            className
         )}
         {...props}
      />
   );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
   return (
      <span
         data-slot="breadcrumb-page"
         role="link"
         aria-disabled="true"
         aria-current="page"
         className={cn("min-w-0 font-normal text-viewerblack", className)}
         {...props}
      />
   );
}

function BreadcrumbSeparator({
   className,
   ...props
}: Omit<React.ComponentProps<"li">, "children">) {
   return (
      <li
         data-slot="breadcrumb-separator"
         role="presentation"
         aria-hidden="true"
         className={cn(
            "shrink-0 text-viewerlighttext [&>svg]:size-3.5",
            className
         )}
         {...props}
      >
         <ChevronRight />
      </li>
   );
}

function BreadcrumbEllipsis({
   className,
   ...props
}: React.ComponentProps<"span">) {
   return (
      <span
         data-slot="breadcrumb-ellipsis"
         className={cn(
            "flex size-4 shrink-0 items-center justify-center",
            className
         )}
         {...props}
      >
         <MoreHorizontal aria-hidden="true" className="size-4" />
         <span className="sr-only">Hidden folders</span>
      </span>
   );
}

export {
   Breadcrumb,
   BreadcrumbEllipsis,
   BreadcrumbItem,
   BreadcrumbLink,
   BreadcrumbList,
   BreadcrumbPage,
   BreadcrumbSeparator,
};
