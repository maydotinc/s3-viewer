type Missing<Slug, Entries extends readonly { slug: Slug }[]> = Exclude<
   Slug,
   Entries[number]["slug"]
>;

export const coveringEverySlug =
   <Entry extends { slug: string }>() =>
   <const Entries extends readonly Entry[]>(
      entries: Entries &
         ([Missing<Entry["slug"], Entries>] extends [never]
            ? unknown
            : { missingSlugs: Missing<Entry["slug"], Entries> })
   ): readonly Entry[] =>
      entries;

export const pickBySlug = <Entry extends { slug: string }>(
   entries: readonly Entry[],
   slug: Entry["slug"]
): Entry => {
   const entry = entries.find((e) => e.slug === slug);
   if (!entry) throw new Error(`No entry for slug "${slug}"`);
   return entry;
};
