import type { LucideIcon } from "lucide-react";
import type { LinkProps } from "next/link";

const CATALOG_GROUPS = ["Navigation", "Buckets", "Actions", "Servers"] as const;

const RECENT_GROUP = "Recent" as const;

const GROUP_ORDER = [RECENT_GROUP, ...CATALOG_GROUPS] as const;

const GROUP_LIMITS: Partial<Record<ResultGroup, number>> = {
   Recent: 5,
   Buckets: 6,
   Servers: 5,
};

type CommandGroup = (typeof CATALOG_GROUPS)[number];

type ResultGroup = (typeof GROUP_ORDER)[number];

type CommandItem = {
   id: string;
   group: CommandGroup;
   label: string;
   description?: string;
   keywords?: string;
   icon: LucideIcon;
   shortcut?: string;
   trailing?: string;
   destructive?: boolean;
} & (
   | { href: LinkProps["href"]; run?: never }
   | { href?: never; run: () => void }
);

export { GROUP_LIMITS, GROUP_ORDER, RECENT_GROUP };
export type { CommandItem, ResultGroup };
