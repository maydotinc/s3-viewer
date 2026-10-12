import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";

import { ENTER, SURFACE } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";

function Select({
   ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
   return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectValue({
   ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
   return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
   className,
   size = "default",
   children,
   ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
   size?: "sm" | "default";
}) {
   return (
      <SelectPrimitive.Trigger
         data-slot="select-trigger"
         data-size={size}
         className={cn(
            "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-sm text-viewerblack transition-colors outline-none",
            "data-[size=default]:h-9 data-[size=sm]:h-8 pointer-coarse:min-h-11",
            "data-[placeholder]:text-viewerlighttext",
            "not-disabled:hover:bg-viewergray",
            "focus-visible:border-viewerblue data-[state=open]:border-viewerblue aria-invalid:border-viewertextred",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&>span]:min-w-0 [&>span]:truncate [&>span]:text-left",
            "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className
         )}
         {...props}
      >
         {children}
         <SelectPrimitive.Icon asChild>
            <ChevronDownIcon className="size-4 shrink-0 text-viewertext" />
         </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
   );
}

function SelectContent({
   className,
   children,
   sideOffset = 4,
   ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Content>, "position">) {
   return (
      <SelectPrimitive.Portal>
         <SelectPrimitive.Content
            data-slot="select-content"
            position="popper"
            sideOffset={sideOffset}
            className={cn(
               SURFACE,
               ENTER,
               "relative max-h-[var(--radix-select-content-available-height)] max-w-[calc(100vw-1rem)] min-w-[var(--radix-select-trigger-width)]",
               className
            )}
            {...props}
         >
            <SelectScrollUpButton />
            <SelectPrimitive.Viewport className="w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1">
               {children}
            </SelectPrimitive.Viewport>
            <SelectScrollDownButton />
         </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
   );
}

function SelectItem({
   className,
   children,
   description,
   ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
   description?: React.ReactNode;
}) {
   return (
      <SelectPrimitive.Item
         data-slot="select-item"
         className={cn(
            "relative flex w-full cursor-pointer flex-col gap-0.5 rounded-md py-2 pr-8 pl-2.5 text-sm text-viewerblack transition-colors outline-none select-none",
            "data-[highlighted]:bg-viewergray data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className
         )}
         {...props}
      >
         <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
         {description ? (
            <span className="text-xs text-viewerlighttext">{description}</span>
         ) : null}
         <span className="pointer-events-none absolute top-2.5 right-2.5 flex size-4 items-center justify-center">
            <SelectPrimitive.ItemIndicator>
               <CheckIcon className="size-4 text-viewerblue" />
            </SelectPrimitive.ItemIndicator>
         </span>
      </SelectPrimitive.Item>
   );
}

function SelectScrollUpButton({
   className,
   ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
   return (
      <SelectPrimitive.ScrollUpButton
         data-slot="select-scroll-up-button"
         className={cn(
            "flex cursor-default items-center justify-center py-1 text-viewertext",
            className
         )}
         {...props}
      >
         <ChevronUpIcon className="size-4" />
      </SelectPrimitive.ScrollUpButton>
   );
}

function SelectScrollDownButton({
   className,
   ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
   return (
      <SelectPrimitive.ScrollDownButton
         data-slot="select-scroll-down-button"
         className={cn(
            "flex cursor-default items-center justify-center py-1 text-viewertext",
            className
         )}
         {...props}
      >
         <ChevronDownIcon className="size-4" />
      </SelectPrimitive.ScrollDownButton>
   );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
