import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

// wrap it in a card: the table only draws hairlines between rows
function Table({ className, ...props }: React.ComponentProps<"table">) {
   return (
      <div data-slot="table-container" className="w-full overflow-x-auto">
         <table
            data-slot="table"
            className={cn("w-full caption-bottom text-sm", className)}
            {...props}
         />
      </div>
   );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
   return (
      <thead
         data-slot="table-header"
         className={cn(
            "bg-viewergray/60 [&_tr]:hover:bg-transparent",
            className
         )}
         {...props}
      />
   );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
   return (
      <tbody
         data-slot="table-body"
         className={cn("[&_tr:last-child]:border-0", className)}
         {...props}
      />
   );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
   return (
      <tr
         data-slot="table-row"
         className={cn(
            "h-11 border-b border-viewerborder transition-colors duration-150 hover:bg-viewergray/60 data-[state=selected]:bg-viewerblue/5",
            className
         )}
         {...props}
      />
   );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
   return (
      <th
         data-slot="table-head"
         className={cn(
            "h-11 px-4 text-left align-middle text-[13px] font-medium whitespace-nowrap text-viewertext",
            className
         )}
         {...props}
      />
   );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
   return (
      <td
         data-slot="table-cell"
         className={cn(
            "h-11 px-4 align-middle text-sm whitespace-nowrap text-viewerblack",
            className
         )}
         {...props}
      />
   );
}

function TableCaption({
   className,
   ...props
}: React.ComponentProps<"caption">) {
   return (
      <caption
         data-slot="table-caption"
         className={cn("mt-4 text-sm text-viewertext", className)}
         {...props}
      />
   );
}

export {
   Table,
   TableBody,
   TableCaption,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
};
