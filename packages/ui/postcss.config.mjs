// Tailwind scans the consuming app's own directory (its cwd, honouring
// .gitignore) plus the explicit `@source` directives in the CSS entry. Do not
// widen `base` to the repo root: that makes every Next dev server watch the
// whole monorepo, so two apps recompile each other in a loop.
const config = {
   plugins: {
      "@tailwindcss/postcss": {},
   },
};

export default config;
