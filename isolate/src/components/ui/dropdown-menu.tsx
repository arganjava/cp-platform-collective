"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuContent = React.forwardRef<React.ComponentRef<typeof DropdownMenuPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn("z-50 min-w-40 overflow-hidden border border-border bg-card p-1 shadow-lg data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-in", className)} {...props} /></DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";
const DropdownMenuItem = React.forwardRef<React.ComponentRef<typeof DropdownMenuPrimitive.Item>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item ref={ref} className={cn("relative flex min-h-10 cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm outline-none transition-colors hover:bg-secondary focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-8", className)} {...props} />
));
DropdownMenuItem.displayName = "DropdownMenuItem";
const DropdownMenuSeparator = React.forwardRef<React.ComponentRef<typeof DropdownMenuPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>>(({ className, ...props }, ref) => <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border-default", className)} {...props} />);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
const DropdownMenuLabel = React.forwardRef<React.ComponentRef<typeof DropdownMenuPrimitive.Label>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }>(({ className, inset, ...props }, ref) => <DropdownMenuPrimitive.Label ref={ref} className={cn("px-3 py-2 text-sm font-semibold", inset && "pl-8", className)} {...props} />);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup };
