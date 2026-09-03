import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

function DropdownMenu({
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
   return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
   return (
      <DropdownMenuPrimitive.Trigger
         data-slot="dropdown-menu-trigger"
         {...props}
      />
   );
}

function DropdownMenuContent({
   className,
   sideOffset = 4,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
   return (
      <DropdownMenuPrimitive.Portal>
         <DropdownMenuPrimitive.Content
            data-slot="dropdown-menu-content"
            sideOffset={sideOffset}
            className={cn(
               "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border p-2 shadow-md",
               className
            )}
            {...props}
         />
      </DropdownMenuPrimitive.Portal>
   );
}

function DropdownMenuItem({
   className,
   inset,
   variant = "default",
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
   inset?: boolean;
   variant?: "default" | "destructive";
}) {
   return (
      <DropdownMenuPrimitive.Item
         data-slot="dropdown-menu-item"
         data-inset={inset}
         data-variant={variant}
         className={cn(
            "focus:bg-accent focus:text-accent-foreground hover:cursor-pointer data-[variant=destructive]:text-viewertextred data-[variant=destructive]:focus:bg-viewerbgred data-[variant=destructive]:focus:text-viewertextred data-[variant=destructive]:*:[svg]:!text-viewertextred [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className
         )}
         {...props}
      />
   );
}

function DropdownMenuRadioGroup({
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
   return (
      <DropdownMenuPrimitive.RadioGroup
         data-slot="dropdown-menu-radio-group"
         {...props}
      />
   );
}

function DropdownMenuRadioItem({
   className,
   children,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
   return (
      <DropdownMenuPrimitive.RadioItem
         data-slot="dropdown-menu-radio-item"
         className={cn(
            "focus:bg-accent focus:text-accent-foreground hover:cursor-pointer relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className
         )}
         {...props}
      >
         {children}
      </DropdownMenuPrimitive.RadioItem>
   );
}

function DropdownMenuLabel({
   className,
   inset,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
   inset?: boolean;
}) {
   return (
      <DropdownMenuPrimitive.Label
         data-slot="dropdown-menu-label"
         data-inset={inset}
         className={cn(
            "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
            className
         )}
         {...props}
      />
   );
}

function DropdownMenuSeparator({
   className,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
   return (
      <DropdownMenuPrimitive.Separator
         data-slot="dropdown-menu-separator"
         className={cn("bg-border -mx-1 my-1 h-px", className)}
         {...props}
      />
   );
}

export {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
};
