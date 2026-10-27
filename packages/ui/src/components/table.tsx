import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
   return (
      <div className="relative min-h-0 min-w-0 w-full overflow-auto [scrollbar-gutter:stable]">
         <table
            className={cn("w-full caption-bottom text-sm", className)}
            {...props}
         />
      </div>
   );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
   return (
      <thead
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
         className={cn("[&_tr:last-child]:border-0", className)}
         {...props}
      />
   );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
   return (
      <tr
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
         className={cn(
            "h-11 px-4 align-middle text-sm whitespace-nowrap text-viewerblack",
            className
         )}
         {...props}
      />
   );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
