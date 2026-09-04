import { matchFields, splitTerms, type Range } from "./match";
import {
   GROUP_LIMITS,
   GROUP_ORDER,
   RECENT_GROUP,
   type CommandItem,
   type ResultGroup,
} from "./types";

type RankedItem = { command: CommandItem; score: number; ranges: Range[] };

type RankedGroup = { group: ResultGroup; items: RankedItem[] };

const NEVER_USED = Number.MAX_SAFE_INTEGER;

const capped = (group: ResultGroup, items: RankedItem[]): RankedItem[] => {
   const max = GROUP_LIMITS[group];
   return max === undefined ? items : items.slice(0, max);
};

const searchText = (command: CommandItem): string =>
   [command.description, command.keywords, command.trailing]
      .filter(Boolean)
      .join(" ");

const unscored = (command: CommandItem): RankedItem => ({
   command,
   score: 0,
   ranges: [],
});

const byGroup = (
   items: readonly RankedItem[]
): Map<ResultGroup, RankedItem[]> => {
   const groups = new Map<ResultGroup, RankedItem[]>();
   for (const item of items) {
      const bucket = groups.get(item.command.group);
      if (bucket) bucket.push(item);
      else groups.set(item.command.group, [item]);
   }
   return groups;
};

const defaultView = (
   commands: readonly CommandItem[],
   recentIds: readonly string[]
): RankedGroup[] => {
   const recent = capped(
      RECENT_GROUP,
      recentIds.flatMap((id) => {
         const command = commands.find((entry) => entry.id === id);
         return command ? [unscored(command)] : [];
      })
   );
   const promoted = new Set(recent.map((item) => item.command.id));
   const rest = byGroup(
      commands.filter((command) => !promoted.has(command.id)).map(unscored)
   );

   return [
      ...(recent.length > 0 ? [{ group: RECENT_GROUP, items: recent }] : []),
      ...GROUP_ORDER.flatMap((group) => {
         const items = rest.get(group);
         return items ? [{ group, items: capped(group, items) }] : [];
      }),
   ];
};

// groups float by their single best row, with `GROUP_ORDER` breaking ties
const searchView = (
   commands: readonly CommandItem[],
   terms: readonly string[],
   recentIds: readonly string[]
): RankedGroup[] => {
   const recency = new Map(recentIds.map((id, index) => [id, index]));
   const rankOf = (item: RankedItem) =>
      recency.get(item.command.id) ?? NEVER_USED;

   const matched = commands.flatMap((command) => {
      const match = matchFields(command.label, searchText(command), terms);
      return match ? [{ command, ...match }] : [];
   });

   return [...byGroup(matched)]
      .map(([group, items]) => {
         const sorted = [...items].sort(
            (a, b) =>
               b.score - a.score ||
               rankOf(a) - rankOf(b) ||
               a.command.label.localeCompare(b.command.label)
         );
         return {
            group,
            items: capped(group, sorted),
            best: sorted[0]?.score ?? 0,
         };
      })
      .sort(
         (a, b) =>
            b.best - a.best ||
            GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
      )
      .map(({ group, items }) => ({ group, items }));
};

const rankCommands = (
   commands: readonly CommandItem[],
   query: string,
   recentIds: readonly string[]
): RankedGroup[] => {
   const terms = splitTerms(query);
   return terms.length === 0
      ? defaultView(commands, recentIds)
      : searchView(commands, terms, recentIds);
};

const flatten = (groups: readonly RankedGroup[]): CommandItem[] =>
   groups.flatMap((group) => group.items.map((item) => item.command));

export { flatten, rankCommands };
export type { RankedGroup, RankedItem };
