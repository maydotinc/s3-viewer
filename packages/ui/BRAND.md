# S3 Viewer brand in code

Layout, spacing, motion and page anatomy live in `DESIGN.md` next to this file; read both.

Source of truth for the visual brand is the public brand kit
(`apps/landing/components/BrandKit/index.tsx`). This file describes how those
decisions are encoded in `@s3-viewer/ui`.

## Colors

Defined as Tailwind theme colors in `src/styles/globals.css`.

| Token             | Hex       | Use it for                                        |
| ----------------- | --------- | ------------------------------------------------- |
| `viewerblue`      | `#3658C1` | Primary. CTAs, links, active state, focus border. |
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

The other exception is syntax colour. The JSON preview
(`apps/web/components/Buckets/ObjectView/json-preview.tsx`) needs hue to carry
meaning — key, string, number, literal — which grayscale cannot do, so
`globals.css` defines `jsonkey`, `jsonstring`, `jsonnumber` and `jsonliteral`
for it. They are for code and nothing else: no button, badge or chart may use
them. Keys stay on `viewerdarkblue`, and all four clear 4.5:1 on white.

The first exception is the user avatar (`apps/web/components/Avatar.tsx`): white
initials on a 135° two-stop HSL gradient hashed from the user's name. It is
identity, not chrome — the hue is a person, not a brand color — and it appears
in exactly one place, the top-right profile menu trigger. Do not reach for a
gradient anywhere else, and do not add these hues to the palette.

The shadcn semantic tokens map onto the above, so `bg-primary`,
`text-muted-foreground`, `bg-destructive` and friends are already on-brand:
`primary` = viewerblue on white, `secondary` = viewergray on viewerblack,
`muted-foreground` = viewerlighttext, `destructive` = viewertextred,
`foreground` = viewertext, `radius` = `0.5rem`. There is no `ring` token —
nothing in the product draws a focus ring (see "Focus").

## Single light theme

The product ships one light theme, deliberately. There is no `.dark` block, no
`@custom-variant dark`, no theme switcher and no `next-themes`. Do not add
`dark:` utilities — with no dark variant defined they would fall back to
`prefers-color-scheme` and fire on anyone whose OS is in dark mode.

## Typography

Inter everywhere, wired through `--font-sans` (apps set `--font-inter` with
`next/font`). `--font-mono` is the system mono stack.

Utilities in `globals.css` (`@layer components`):

| Class         | Spec                                        |
| ------------- | ------------------------------------------- |
| `.text-title` | 30/36 semibold, tight tracking, viewerblack |
| `.text-body`  | 16/28 regular, viewertext                   |
| `.text-meta`  | 12/18 medium, viewerlighttext               |

They set a color too; override it with a normal Tailwind `text-*` utility when
needed. `h1`–`h6` default to viewerblack.

## Buttons

`src/components/button.tsx`.

Variants:

- `default` — viewerblue fill, white text, hover viewerdarkblue. The one CTA.
- `secondary` — viewergray fill, viewerblack text.
- `outline` — white fill, viewerborder border, viewertext.
- `ghost` — transparent, viewergray on hover. Toolbars and icon buttons.
- `destructive` — viewertextred fill, white text.
- `link` — viewerblue, underline on hover.

Sizes — horizontal padding is symmetric, always. There is no `has-[>svg]`
padding shrink: a button with an icon and a label has the same padding as one
without.

| Size      | Box      | Padding | Gap   | Text      |
| --------- | -------- | ------- | ----- | --------- |
| `sm`      | `h-8`    | `px-3`  | `1.5` | `13px`    |
| `default` | `h-9`    | `px-4`  | `2`   | `14px`    |
| `lg`      | `h-10`   | `px-5`  | `2`   | `14px`    |
| `icon`    | `size-9` | `p-0`   | —     | icon only |
| `icon-sm` | `size-8` | `p-0`   | —     | icon only |

Icons are `size-4 shrink-0` from `[&_svg]` rules; pass an explicit `size-*` on
the icon to override. Never add manual `mr-2`/`ml-1` spacing — that is what
`gap` is for.

Disabled is 50% opacity plus `cursor-not-allowed`; the button keeps its pointer
events (so the cursor shows) and every hover utility is gated behind
`not-disabled:`, so a disabled button never changes on hover.

## Loading buttons keep their width

Every variant accepts `loading`. The label stays mounted inside a
`<span className="contents invisible">` and the spinner is absolutely centred
on top of it, so the button's width never changes and nothing on the row moves.
`loading` also sets `disabled` and `aria-busy`.

Never swap the label for an in-progress version ("Save" → "Saving…"). App code
should not re-implement any of this.

## Focus

No focus rings, anywhere. Never use `ring-*`, `focus:ring-*`,
`focus-visible:ring-*`, `ring-offset-*` or `outline-ring`; every control sets
`outline-none`.

Only the input-like controls show focus at all: **text inputs, select triggers
and checkboxes** swap their border to `viewerblue` on `focus-visible` (and to
`viewertextred` on `aria-invalid`). They carry a 1px border at rest, so the
swap is a colour change and nothing shifts.

Buttons, dialog close buttons, badges and menu items get **no focus styling**
— no ring, and no focus-only border change either. Their hover state is the
whole visual vocabulary.

## Motion

Modal-layer surfaces never animate. Dialogs, their overlays, dropdown menus and
selects appear and disappear instantly — no `animate-in`/`animate-out`, no
fade, zoom or slide, no `motion`/`AnimatePresence`. `tw-animate-css` is not a
dependency and there are no `.fade-in`/`.motion-*` utilities in `globals.css`.

The only motion in the product is `transition-colors` on hover (≤150 ms), the
spinner, and the toast's own enter/exit.

## Dialogs

`Dialog` → `DialogContent` → `DialogHeader` / `DialogBody` / `DialogFooter`.
Content is `max-w-md`, `rounded-xl`, one soft `shadow-lg`, no padding of its
own — the three sections carry it (`px-6 pt-5 pb-4`, `px-6 py-4`,
`px-6 pt-2 pb-5`).

A dialog has exactly one top-right X (`showCloseButton`, on by default) and one
primary action, right-aligned in the footer. **Do not put a "Cancel" button
next to the X** — the X, Escape and the overlay click are the cancel. The one
exception is a destructive confirm, which keeps "Cancel" + the destructive
button and hides the X with `showCloseButton={false}`.

## Loading

`src/components/spinner.tsx` is the one loading indicator: sizes `sm`, `md`,
`lg`, viewerblue, `role="status"` with an `aria-label`. Centre it inside a
container that already has the final dimensions so nothing moves when data
arrives. Skeletons are reserved for large areas whose loaded shape is known
(a table body). Content that replaces a spinner just appears — there is no
fade-in utility.

## Truncation

Text truncates only when its container is genuinely out of room:
`min-w-0 flex-1 truncate` on the text, `shrink-0` on icons beside it. Never
clip with an arbitrary `max-w-[Npx]`. Breadcrumb links and pages carry no
truncation of their own — the caller decides which segment gives way.

## Writing rules

- The product is **S3 Viewer**, with a space. Never "s3-viewer" or "S3Viewer"
  in user-facing copy (the npm scope and repo name are separate things).
- Sentence case for buttons, labels, headings and menu items: "Create bucket",
  not "Create Bucket".
- Button labels do not change while the action runs. A button in flight keeps
  its label and shows the centred spinner (see "Loading buttons keep their
  width"); there is no "Saving…" state.
- Role names in the UI always come from `ROLE_LABELS` in
  `@s3-viewer/permissions`. Do not spell them inline.
- Plain and specific. Say what a thing does; skip "military-grade",
  "revolutionary", "bank-level". "Your credentials are encrypted at rest" beats
  "enterprise-grade security".
