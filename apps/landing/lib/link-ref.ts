type LinkRef = { href: string; title: string; description: string };

const toLinkRef = (
   base: "/how-to" | "/use-cases",
   entry: { slug: string; tagline: string },
   title: string
): LinkRef => ({
   href: `${base}/${entry.slug}`,
   title,
   description: entry.tagline,
});

export { toLinkRef };
export type { LinkRef };
