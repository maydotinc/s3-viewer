import type { LucideIcon } from "lucide-react";
import type { LinkProps } from "next/link";

/**
 * The order of the default view, and the tiebreaker once a query has groups
 * competing on score.
 */
const CATALOG_GROUPS = ["Navigation", "Buckets", "Actions", "Servers"] as const;

const RECENT_GROUP = "Recent" as const;

const GROUP_ORDER = [RECENT_GROUP, ...CATALOG_GROUPS] as const;

/**
 * How many rows a group may contribute. Navigation and actions are short
 * curated lists and always show in full; the data-driven groups are capped so
 * a broad query stays one scannable screen.
 */
const GROUP_LIMITS: Partial<Record<ResultGroup, number>> = {
   Recent: 5,
   Buckets: 6,
   Servers: 5,
};

type CommandGroup = (typeof CATALOG_GROUPS)[number];

type ResultGroup = (typeof GROUP_ORDER)[number];

/**
 * A row. `href` navigates and `run` acts — exactly one of them, so the row
 * that gets prefetched on highlight is always the one Enter opens.
 */
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

export { CATALOG_GROUPS, GROUP_LIMITS, GROUP_ORDER, RECENT_GROUP };
export type { CommandGroup, CommandItem, ResultGroup };
