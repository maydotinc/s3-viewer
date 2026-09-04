import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { ChevronRight, CircleIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

const ENTER = "data-[state=open]:animate-fade-in";

const SURFACE =
   "z-50 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden rounded-lg border border-viewerborder bg-viewerwhite p-1 shadow-md outline-none";

const ITEM_BASE =
   "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const ITEM_DEFAULT =
   "text-viewerblack data-[highlighted]:bg-viewergray [&_svg:not([class*='text-'])]:text-viewertext";

const ITEM_DESTRUCTIVE =
   "text-viewertextred data-[highlighted]:bg-viewerbgred [&_svg]:text-viewertextred";

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
   // returning focus to the trigger on close steals it from a dialog opened
   // by a menu item.
   onCloseAutoFocus = (event) => event.preventDefault(),
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
   return (
      <DropdownMenuPrimitive.Portal>
         <DropdownMenuPrimitive.Content
            data-slot="dropdown-menu-content"
            sideOffset={sideOffset}
            onCloseAutoFocus={onCloseAutoFocus}
            className={cn(
               SURFACE,
               ENTER,
               "max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[12rem]",
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
            ITEM_BASE,
            variant === "destructive" ? ITEM_DESTRUCTIVE : ITEM_DEFAULT,
            "data-[inset]:pl-8",
            className
         )}
         {...props}
      />
   );
}

// groups are plain divs in the flex column, so they must repeat the surface's
// item gap or their rows' hover fills touch.
const GROUP = "flex flex-col gap-0.5";

function DropdownMenuGroup({
   className,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
   return (
      <DropdownMenuPrimitive.Group
         data-slot="dropdown-menu-group"
         className={cn(GROUP, className)}
         {...props}
      />
   );
}

function DropdownMenuRadioGroup({
   className,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
   return (
      <DropdownMenuPrimitive.RadioGroup
         data-slot="dropdown-menu-radio-group"
         className={cn(GROUP, className)}
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
         className={cn(ITEM_BASE, ITEM_DEFAULT, "pl-8", className)}
         {...props}
      >
         <span className="pointer-events-none absolute left-2.5 flex size-4 items-center justify-center">
            <CircleIcon className="size-3.5 text-viewerborder" />
            <DropdownMenuPrimitive.ItemIndicator className="absolute">
               <CircleIcon className="size-3.5 fill-viewerblue text-viewerblue" />
            </DropdownMenuPrimitive.ItemIndicator>
         </span>
         {children}
      </DropdownMenuPrimitive.RadioItem>
   );
}

function DropdownMenuSub({
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
   return (
      <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
   );
}

function DropdownMenuSubTrigger({
   className,
   inset,
   children,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
   inset?: boolean;
}) {
   return (
      <DropdownMenuPrimitive.SubTrigger
         data-slot="dropdown-menu-sub-trigger"
         data-inset={inset}
         className={cn(
            ITEM_BASE,
            ITEM_DEFAULT,
            "data-[state=open]:bg-viewergray data-[inset]:pl-8",
            className
         )}
         {...props}
      >
         {children}
         <ChevronRight
            aria-hidden="true"
            className="ml-auto size-4 shrink-0 text-viewerlighttext"
         />
      </DropdownMenuPrimitive.SubTrigger>
   );
}

function DropdownMenuSubContent({
   className,
   sideOffset = 4,
   alignOffset = 0,
   ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
   return (
      <DropdownMenuPrimitive.Portal>
         <DropdownMenuPrimitive.SubContent
            data-slot="dropdown-menu-sub-content"
            sideOffset={sideOffset}
            alignOffset={alignOffset}
            // no fade: submenus open on hover intent and must be readable the
            // instant the pointer arrives.
            className={cn(
               SURFACE,
               "max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[12rem]",
               className
            )}
            {...props}
         />
      </DropdownMenuPrimitive.Portal>
   );
}

function DropdownMenuShortcut({
   className,
   keys,
   ...props
}: React.ComponentProps<"span"> & { keys: string }) {
   return (
      <span
         data-slot="dropdown-menu-shortcut"
         className={cn("ml-auto pl-4", className)}
         {...props}
      >
         <Kbd keys={keys} />
      </span>
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
            "px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-viewerlighttext uppercase data-[inset]:pl-8",
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
         className={cn("-mx-1 my-1 h-px bg-viewerborder", className)}
         {...props}
      />
   );
}

export {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSeparator,
   DropdownMenuShortcut,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
};
