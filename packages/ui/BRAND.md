# S3 Viewer brand in code

Source of truth for the visual brand is the public brand kit
(`apps/landing/components/BrandKit/index.tsx`). This file describes how those
decisions are encoded in `@s3-viewer/ui`.

## Colors

Defined as Tailwind theme colors in `src/styles/globals.css`.

| Token             | Hex       | Use it for                                        |
| ----------------- | --------- | ------------------------------------------------- |
| `viewerblue`      | `#3658C1` | Primary. CTAs, links, active state, focus rings.  |
| `viewerdarkblue`  | `#253977` | Hero/emphasis surfaces, primary button hover.     |
| `viewerblack`     | `#0E121B` | Headings and high-emphasis text.                  |
| `viewertext`      | `#525866` | Body copy and secondary text. Default `color`.    |
| `viewerlighttext` | `#99A0AE` | Captions, meta, placeholders, disabled labels.    |
| `viewerborder`    | `#E1E4EA` | Hairlines, dividers, input and card borders.      |
| `viewergray`      | `#F7F7F7` | Muted surfaces, section backgrounds, hover fills. |
| `viewerwhite`     | `#FFFFFF` | Page background, text on blue/red fills.          |
| `viewertextred`   | `#FB3748` | Destructive text, icons and fills.                |
| `viewerbgred`     | `#FEEBEC` | Destructive hover/backdrop surfaces only.         |

Viewer Blue is the only brand-defining color; everything else is grayscale. No
gradients.

The shadcn semantic tokens map onto the above, so `bg-primary`,
`text-muted-foreground`, `bg-destructive` and friends are already on-brand:
`primary` = viewerblue on white, `secondary` = viewergray on viewerblack,
`muted-foreground` = viewerlighttext, `destructive` = viewertextred,
`foreground` = viewertext, `ring` = viewerblue, `radius` = `0.5rem`.

## Single light theme

The product ships one light theme, deliberately. There is no `.dark` block, no
`@custom-variant dark`, no theme switcher and no `next-themes`. Do not add
`dark:` utilities — with no dark variant defined they would fall back to
`prefers-color-scheme` and fire on anyone whose OS is in dark mode.

## Typography

Inter everywhere, wired through `--font-sans` (apps set `--font-inter` with
`next/font`). `--font-mono` is the system mono stack.

Utilities in `globals.css` (`@layer components`):

| Class           | Spec                                        |
| --------------- | ------------------------------------------- |
| `.text-title`   | 30/36 semibold, tight tracking, viewerblack |
| `.text-heading` | 20/28 semibold, viewerblack                 |
| `.text-body`    | 16/28 regular, viewertext                   |
| `.text-meta`    | 12/18 medium, viewerlighttext               |

They set a color too; override it with a normal Tailwind `text-*` utility when
needed. `h1`–`h6` default to viewerblack.

## Button variants

`src/components/button.tsx`:

- `default` — viewerblue fill, white text, hover viewerdarkblue. The one CTA.
- `secondary` — viewergray fill, viewerblack text.
- `outline` — white fill, viewerborder border, viewertext.
- `ghost` — transparent, viewergray on hover. Toolbars and icon buttons.
- `destructive` — viewertextred fill, white text.
- `link` — viewerblue, underline on hover.

Focus rings are viewerblue, disabled is 50% opacity. Every variant accepts
`loading` — it shows a `Loader2` spinner and disables the button, so app code
should not re-implement that.

## Writing rules

- The product is **S3 Viewer**, with a space. Never "s3-viewer" or "S3Viewer"
  in user-facing copy (the npm scope and repo name are separate things).
- Sentence case for buttons, labels, headings and menu items: "Create bucket",
  not "Create Bucket".
- In-progress button labels end in an ellipsis character: "Saving…", "Deleting…"
  — one `…`, not three periods.
- Role names in the UI always come from `ROLE_LABELS` in
  `@s3-viewer/permissions`. Do not spell them inline.
- Plain and specific. Say what a thing does; skip "military-grade",
  "revolutionary", "bank-level". "Your credentials are encrypted at rest" beats
  "enterprise-grade security".
