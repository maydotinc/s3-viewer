# S3 Viewer design system

The single source of truth for how S3 Viewer looks and behaves: colour, type,
layout, spacing, motion, components and page anatomy for `apps/web` and
`apps/landing`. Read it before touching any UI, and update it in the same
change when you deliberately change a rule. Exact numbers are deliberate; do
not invent new ones.

The feel: calm, generous, precise. A well-funded startup's admin, not a dense
console. Products that get this right: Vercel and Render (settings, members,
tables), Linear (density and motion), Kytelink and Koala (general UI).

## 0. Ten rules

1. **One border deep.** A card may contain controls (inputs, selects,
   buttons: they are controls, not containers) but never another bordered
   container. Lists inside a card are separated by hairlines; callouts are
   `bg-viewergray` with no border; tables sit flush against the card edges.
2. **One action, one place.** An action appears once per screen. If the page
   header has "Invite people", no empty state or footer repeats it: the
   empty state just says what is missing and where the action lives.
3. **Nothing moves after it renders.** Loading states have the final
   dimensions. Buttons keep their width while loading. Skeletons match the
   real anatomy. Toggles that appear later are `invisible`, not unmounted.
4. **Only Viewer Blue.** Everything else is grayscale. No gradients (the
   avatar is the one exception), no second accent, no coloured badges.
5. **No focus rings.** Inputs, selects and checkboxes swap their border to
   `viewerblue` on `focus-visible`; buttons and menu items show nothing.
6. **Dialogs never animate.** Menus, selects, tooltips and tab indicators
   fade or slide over ≤ 200 ms. Everything else is `transition-colors`.
7. **Spacing scale only:** 4, 8, 12, 16, 24, 32, 48 px for layout (page,
   card and section gaps, field stacks, list rows). Inside dense controls
   (`sm` buttons, menu and select items, chips, `Kbd`) a compact 2 / 6 / 10 px
   step is also allowed, exactly as the component specs below spell out.
   Nothing else: no 20, 28 or 40.
8. **One primary button per surface.** Right-aligned. No Cancel next to an X.
9. **Tabs for siblings, pages for children.** Two or more peer collections on
   one screen (members / pending invites, profile / invites) are tabs above a
   single card, never stacked cards the user has to scroll past.
10.   **Sentence case, plain words, no exclamation marks.**

## 1. Colour

Tailwind theme colours in `src/styles/globals.css`.

| Token             | Hex       | Use it for                                        |
| ----------------- | --------- | ------------------------------------------------- |
| `viewerblue`      | `#3658C1` | Primary. CTAs, links, active state, focus border. |
| `viewerdarkblue`  | `#253977` | Primary button hover, hero surfaces.              |
| `viewerblack`     | `#0E121B` | Headings, high-emphasis text, active tab.         |
| `viewertext`      | `#525866` | Body and secondary text. Default `color`.         |
| `viewerlighttext` | `#99A0AE` | Captions, meta, placeholders, disabled labels.    |
| `viewerborder`    | `#E1E4EA` | Hairlines, dividers, input and card borders.      |
| `viewergray`      | `#F7F7F7` | Muted surfaces, callouts, hover fills.            |
| `viewerwhite`     | `#FFFFFF` | Page background, text on blue or red.             |
| `viewertextred`   | `#FB3748` | Destructive text, icons and fills.                |
| `viewerbgred`     | `#FEEBEC` | Destructive hover and backdrop surfaces only.     |

Exceptions, scoped and documented: the JSON preview's four syntax colours
(`jsonkey`, `jsonstring`, `jsonnumber`, `jsonliteral`, code only) and the
avatar gradient (`apps/web/components/Avatar.tsx`, identity not chrome, one
place). Nothing else may use hue.

The shadcn semantic tokens (`primary`, `secondary`, `muted-foreground`,
`destructive`, …) map onto these, so they are on-brand too. `radius` is
`0.5rem`. There is no `ring` token.

**Single light theme.** No `.dark` block, no theme switcher, no `dark:`
utilities: with no dark variant defined they would fall back to
`prefers-color-scheme`.

## 2. Typography

Inter everywhere through `--font-sans` (apps set `--font-inter` with
`next/font`). `--font-mono` is the system mono stack. `h1`–`h6` default to
`viewerblack`.

| Role                 | Classes                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Page title           | `text-xl font-semibold tracking-tight text-viewerblack`                |
| Page description     | `text-sm text-viewertext`                                              |
| Card title           | `text-base font-semibold text-viewerblack`                             |
| Card description     | `text-sm text-viewertext`                                              |
| Section heading      | `text-sm font-medium text-viewerblack`                                 |
| Label                | `text-sm font-medium text-viewerblack`                                 |
| Body / cell          | `text-sm text-viewerblack` (secondary cells `text-viewertext`)         |
| Meta / hint          | `text-xs text-viewertext`; captions `text-xs text-viewerlighttext`     |
| Section label (caps) | `text-[11px] font-medium uppercase tracking-wide text-viewerlighttext` |
| Landing h1           | `text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack`   |
| Landing h2           | `text-3xl font-semibold tracking-tight text-viewerblack`               |

Utilities `.text-title` (30/36 semibold), `.text-body` (16/28) and `.text-meta`
(12/18 medium) exist in `globals.css` for the landing and emails.

## 3. Layout

### App shell (`apps/web`), exact

| Region                | Spec                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top bar               | `h-16 px-6 border-b border-viewerborder bg-viewerwhite`, `gap-4` between clusters                                                                             |
| Logo                  | `/icons/viewer.svg` at its native size: `h-8 w-auto` (150 × 32). Vertically centred, sits on the 24px left padding                                            |
| Sidebar trigger       | ghost `size-9`, `gap-3` after the logo, tooltip "Toggle sidebar" + `⌘B`                                                                                       |
| Top-bar right cluster | `gap-3`: command-menu field `h-9 w-64` (quiet, `⌘K` chip) then avatar `size-8`                                                                                |
| Sidebar               | `w-64 border-r border-viewerborder bg-viewerwhite px-4 py-5 gap-6`                                                                                            |
| Sidebar section label | Section label style, `mb-2 px-2`                                                                                                                              |
| Sidebar row           | `h-9 rounded-lg px-2 gap-2.5 text-sm`; active `bg-viewergray text-viewerblack font-medium`; hover `bg-viewergray/70`                                          |
| Server switcher card  | `h-12 rounded-lg border px-3`, name `text-sm font-medium`, role `text-xs`                                                                                     |
| Main                  | `min-w-0 flex-1 overflow-hidden`                                                                                                                              |
| Page                  | `mx-auto w-full max-w-[1400px] px-8 py-6 flex flex-col gap-6`                                                                                                 |
| Page header           | `min-h-9 flex items-center justify-between gap-4`: left = title (+ optional description on a second line) or breadcrumb; right = actions `gap-2`              |
| Toolbar row           | `flex h-9 items-center gap-2`: search `w-72` (fixed), actions pushed right with `ml-auto`. While data loads the buttons render `disabled`, never as skeletons |
| Narrow content        | Forms and settings live in a `max-w-3xl` column so fields never stretch across a 1400px page; tables and grids use the full page width                        |

Nothing sits closer than 24px to the viewport edge on desktop. Sidebar rows
align to the 16px sidebar inset; main content aligns to the 32px page padding.
Below `md` the sidebar becomes a drawer under the top bar (`top-16`) and the
page padding drops to `px-4`. Below `sm` the top bar keeps the logo and the
sidebar trigger, swaps the `w-64` command-menu field for a `size-8` ghost
search button, and keeps the avatar; the page header's actions wrap under the
title.

### Landing (`apps/landing`)

Header `h-16` sticky, `max-w-6xl px-6`, logo `h-8 w-auto`, right cluster
`gap-2` (ghost "GitHub" from `sm` up, primary "Open app"). Sections are
`py-20` inside `max-w-6xl px-6`. Sub-page heroes are `bg-viewergray` with a
`border-b`, `pt-16 pb-16`, a breadcrumb (`text-xs text-viewerlighttext`,
`ChevronRight size-3`), the landing h1 and a `max-w-[620px]` lede. Footer:
brand column + three link columns, `pt-14 pb-8`, MIT line under a hairline.

## 4. Components

### Buttons (`src/components/button.tsx`)

Variants: `default` (blue, the one CTA), `secondary` (gray fill), `outline`,
`ghost` (toolbars, icon buttons), `destructive`, `link`.

| Size      | Box      | Padding | Gap   | Text |
| --------- | -------- | ------- | ----- | ---- |
| `sm`      | `h-8`    | `px-3`  | `1.5` | 13px |
| `default` | `h-9`    | `px-4`  | `2`   | 14px |
| `lg`      | `h-10`   | `px-5`  | `2`   | 14px |
| `icon`    | `size-9` | `p-0`   |       | icon |
| `icon-sm` | `size-8` | `p-0`   |       | icon |

Padding is symmetric; never fixed widths (the one exception: a button whose
label is one of a few known options, like the sort menu, may set a `min-w-*`
equal to its widest label so it does not resize, rule 3); icons `size-4 shrink-0` via `gap`,
never `mr-2`. Disabled = 50% opacity + `cursor-not-allowed`, hover gated
behind `not-disabled:`. `loading` keeps the label mounted and invisible with a
centred spinner on top, so the width never changes. Never "Saving…".

### Inputs, selects, checkboxes

`h-9 px-3 rounded-lg` with a 1px `viewerborder`; `sm` variants `h-8`. Focus
swaps the border to `viewerblue`, `aria-invalid` to `viewertextred`. Select
items may carry a one-line `description` in `text-xs text-viewerlighttext`.

### Cards

`rounded-xl border border-viewerborder bg-viewerwhite`. Padded cards: `p-6`
with `gap-4` inside. Flush cards (tables): header `px-6 pt-5 pb-4` ending in
one hairline (`border-b border-viewerborder`) drawn by the card, never by the
children, then the table, empty state or callout against the edges. Card
title and description per §2. A card's action sits in its header,
right-aligned. A card that sits under a tab row has no header of its own: the
tabs are the heading.

### Badges

`Badge` is for status words only ("Expired", "Pending"), grayscale
(`secondary`, `bg-viewergray text-viewerblack`) or `destructive`
(`bg-viewerbgred text-viewertextred`), never inside a bordered card with the
`outline` variant (rule 1). Roles are plain text (`text-viewertext`) in
tables and menus, never badges.

### Tabs (`src/components/tabs.tsx`)

The switch between sibling collections and settings sections. A `TabList`
row `h-10` on a full-width hairline (`border-b border-viewerborder`); items
`h-10 px-3 text-sm font-medium`, inactive `text-viewertext` hover
`text-viewerblack`, active `text-viewerblack`. Two sliding indicators, both
`transition-[transform,width] duration-200 ease-out`: a `bg-viewergray
rounded-md` hover pill (`inset-y-1.5`) that follows the pointer, and a 2px
`bg-viewerblack` underline under the active item that overlaps the hairline
(`-bottom-px`). Optional `count` renders as `text-viewerlighttext tabular-nums`
after the label, and the underline follows the label when the count arrives
(the list observes the active item). `TabLink` (routes, `aria-current="page"`,
wrapped in a `nav`) and `TabButton` (`role="tab"`, `aria-selected`, with `id`

- `aria-controls` pointing at a `role="tabpanel"` that carries
  `aria-labelledby`; ←/→/Home/End move and activate) share the styling. Tabs
  never live inside a card; they sit `gap-4` above the card they control, and
  the page's normal `gap-6` below the header. The first tab starts at the
  content edge, so its label sits 12px in; that inset is intended.

### Tables (Vercel / Barberflow style)

- Live inside a flush card. Header row `h-11 bg-viewergray/60 text-[13px]
font-medium text-viewertext`, hairline below. Cell padding `px-4`, first
  and last cells included; the first column may take `px-6` when the card
  header is `px-6` so text aligns with the title.
- Single-line rows `h-11 text-sm text-viewerblack`, hairline between rows,
  hover `bg-viewergray/60`, selected `bg-viewerblue/5`.
- **Two-line rows** (name + email, title + meta) are `h-16` with an `Avatar`
  `size-8` (`gap-3`), primary line `text-sm text-viewerblack`, secondary
  `text-xs text-viewerlighttext`. Never squeeze two lines into `h-11`.
- Checkbox column `w-10`, centred. Numeric and date columns right-aligned with
  `tabular-nums`. Text cells `truncate`. Relative dates carry the full date in
  a tooltip.
- Row actions: a ghost `size-8` icon button at the row end, or one `sm` text
  button ("Revoke", "Edit"). Menus `align="end"`.
- Empty state inside the card: icon tile (`size-10 rounded-lg bg-viewergray`,
  icon `size-5 text-viewerlighttext`) + one line + at most one action, and
  none if the action already exists on the page (rule 2). `py-16`, centred.
  The landing's feature cards use the same tile with `text-viewerblue`; that
  is the one place the tile carries the brand colour.
- Loading: the table's own anatomy, no spinner. Header band + `h-11` (or
  `h-16`) rows with a `h-3.5` bar where the text will be. Never a padded
  stack of pills.
- Pagination bar `h-12 px-4 border-t`: "Showing 1–25 of 120" left
  (`tabular-nums`), rows-per-page select + four `size-8` ghost icon buttons
  right.
- AG Grid instances match via `themeQuartz` params: `rowHeight: 44,
headerHeight: 44, cellHorizontalPadding: 16`.

### Callouts

`rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext`, optional `sm`
outline button on a second line (`gap-2`). No border, no icon tile, never red
fill for information.

### Lists inside cards and dialogs

Rows `h-10` with a hairline between them (`divide-y divide-viewerborder`), no
surrounding border, `px-0` inside a padded container so text aligns with the
labels above. Bounded lists scroll (`max-h-64 overflow-y-auto`).

### Dialogs (`src/components/dialog.tsx`)

`Dialog` → `DialogContent` → `DialogHeader` / `DialogBody` / `DialogFooter`.
Content `max-w-md` (forms) or `max-w-lg` (wide), `rounded-xl`, one
`shadow-lg`, no padding of its own: header `px-6 pt-5 pb-4 pr-12`, body
`px-6 py-4`, footer `px-6 pt-2 pb-5 justify-end gap-2`. **Every body is
wrapped in `DialogBody`.** One X top-right, one primary action; no Cancel
next to the X. Destructive confirms hide the X and show Cancel + the
destructive button. Fields stack with `gap-4`; a reserved `min-h-5` error
line sits under the field the primary action depends on.

### Menus, tooltips, popovers

Menu `min-w-[12rem] rounded-lg p-1 shadow-md`; item `h-9 rounded-md px-2.5
gap-2 text-sm`; label in the section-label style `px-2.5 py-1.5`; separator
`-mx-1 my-1`; destructive item red; shortcut hints via `DropdownMenuShortcut`
(`Kbd`, `ml-auto`). Submenus open on hover after 150 ms and on click/→, with
a `ChevronRight size-4 text-viewerlighttext` at the row end, aligned to the
trigger row, no fade. Tooltips on every icon-only button, with the shortcut
when there is one. Tooltip surface `bg-viewerblack text-viewerwhite text-xs
rounded-md px-2.5 py-1.5`.

### Forms

Field = `Label` + control + optional one-line hint (`text-xs text-viewertext`)
only when it adds information; error `text-xs text-viewertextred`. Fields
stack with `gap-4`; two columns `grid gap-4 sm:grid-cols-2`. Primary action
right-aligned under the fields. Disabled until the form is dirty and valid.

### Avatar

`Avatar` `size-8` in tables and the top bar, `size-10` in profile headers.
White initials on the hashed gradient. It is the only gradient in the product.

### Loading and skeletons

`Spinner` (sm/md/lg, viewerblue, `role="status"`) inside a container that
already has the final dimensions. Skeletons only for areas whose loaded shape
is known (a table body). Content that replaces a spinner just appears.

### Truncation

`min-w-0 flex-1 truncate` on the text, `shrink-0` on icons beside it. Never
clip with an arbitrary `max-w-[Npx]`.

## 5. Motion

| What                         | Motion                                                        |
| ---------------------------- | ------------------------------------------------------------- |
| Dialogs and overlays         | None. Appear and disappear instantly.                         |
| Menus, selects, tooltips     | `animate-fade-in` (120 ms, opacity + 2px rise); close instant |
| Submenus                     | None (must be readable the instant the pointer arrives)       |
| Tab hover pill and underline | `transition-[transform,width] duration-200 ease-out`          |
| Hover fills                  | `transition-colors duration-150`                              |
| Spinner, toast               | Their own                                                     |

`prefers-reduced-motion` disables the fade and the tab slide. No
`motion`/`AnimatePresence`, no `tw-animate-css`.

## 6. Keyboard

Global (not in inputs): `/` focus filter, `n` new bucket (dashboard), `u`
upload (bucket page), `r` refresh, `?` shortcuts dialog, `Esc` closes or goes
back. `g d` dashboard, `g s` settings. `⌘K` command menu and `⌘B` sidebar
also fire inside text fields, never while a dialog or menu owns the keyboard.
Every shortcut is discoverable: in the tooltip of the button it triggers
(`SimpleTooltip shortcut="…"`) and in the `?` dialog.

Command menu: one dialog `max-w-xl` (`lg:max-w-2xl`) anchored at `top-[8vh]`,
header row `h-14`, result list `p-2`, footer of ↑↓ / ↵ / Esc hints. Rows
`rounded-lg px-2.5 py-2 gap-2.5`; highlighted `bg-viewergray`; matched
characters `font-semibold text-viewerblue`.

## 7. Pages

- **Dashboard** `/dashboard`: header "Buckets" + provider/role chips; toolbar;
  buckets table card.
- **Bucket** `/buckets/[name]/…`: breadcrumb header; toolbar; objects table
  card.
- **Share** `/servers/[serverId]/share`: header = back chevron (ghost
  `size-9`, tooltip "Back", `Esc`) + "Share {server}" + one-line description;
  action = primary "Invite people" (opens the invite dialog). Tabs **Members
  (n)** / **Pending invites (n)** above one flush card. Members rows are
  two-line `h-16` with avatar, a role select for manageable members, a bucket
  summary ("All buckets" for owners, "3 buckets" otherwise) with an "Edit"
  `sm` ghost button that opens the bucket-access dialog, and a remove X.
  Pending rows: email, role, sent by, expires (relative + tooltip), "Revoke".
  Empty states carry no button (the header has it).
- **Invite dialog** `max-w-lg`: Email addresses (comma separated, chips under
  the field), Server role select, Bucket access list (hairline rows: checkbox
   - name + `sm` role select, "Select all" link in the section heading row),
     footer "Send invite" / "Send 3 invites".
- **Settings** `/settings`: header "Settings" (+ action for the current tab),
  tabs **Profile** / **Invites** (`TabLink`s to `/settings/profile` and
  `/settings/invites`), content in a `max-w-3xl` column. Profile = one card
  (name editable, email read-only) and the **Delete account** card
  (`border-viewertextred/30`, description of what deletion means, one
  destructive button). Invites = **Received** and **Sent** flush cards; the
  one "Invite people" button lives in the page header. `/invites` redirects
  here.
- **Delete account**: the dialog lists exactly what will be deleted (owned
  servers by name with member counts, memberships left, invites revoked),
  what is kept (anonymised audit entries) and what is untouched (buckets and
  files). The user types their email to confirm. A session older than 24 h
  is sent to sign in again first. Success signs out, shows a toast and sends
  a confirmation email.
- **Login / sign-up / forgot password** `/login`, `/signup`,
  `/forgot-password`: `AuthLayout` = logo top-left (`left-6 top-6`, `sm:left-12
sm:top-10`), a `max-w-sm` column centred in the left half, legal line
  `mt-10`, brand panel on the right from `lg`. Step = `.text-title` + one
  `text-sm` sentence, `mt-8` to the form. Fields stack `gap-4` with a reserved
  `min-h-5` message line under each (error in red, otherwise a hint in
  `viewerlighttext`). Buttons are `lg` and full width: one primary, then an
  outline "Email me a code instead" `gap-4` below it; GitHub is an outline
  button above an "or" hairline. The password label row holds "Forgot
  password?" right-aligned as a text link; the show/hide eye is a ghost
  `icon-sm` inside the field (`right-0.5 top-0.5`). Steps keep the first
  step's height (`useStepHeight`) so nothing below them moves. Code steps:
  `OtpInput`, primary "Verify", centred "Didn't get it? Resend code in 45s"
  plus at most one text-link escape ("Skip for now").
- **Settings → Profile** also has a **Password** card (current + new, or just
  new when the account has none; primary right-aligned, hint on the reserved
  line) and, for an unverified address, "Not verified yet. Verify email" as a
  text link in the email hint that opens a `FormDialog` with the `OtpInput`.
- **Profile menu**: name/email header, Settings (`g s`), Support (opens
  `/contact`), separator, Sign out.
- **Landing `/contact`**: hero + three cards (email, GitHub issues, built by
  May Inc.), linked from the footer, the profile menu and the legal hub.

## 8. Copy

Sentence case. Short verbs on buttons ("Send invite", "Save", "Remove",
"Revoke"). Descriptions are one sentence and only when they add information.
No exclamation marks, no "please", no "military-grade". The product is
**S3 Viewer** with a space. Role names come from `ROLE_LABELS` in
`@s3-viewer/permissions`. Button labels never change while an action runs.

## 9. Checklist before you ship a screen

- [ ] Measured at 1280–1440 px with real pixels (JS `getBoundingClientRect`),
      not a scaled screenshot; checked again at 768 and 375.
- [ ] No nested bordered containers; no duplicate actions.
- [ ] No layout shift between loading, empty, error and loaded states.
- [ ] Every icon-only button has a tooltip; every shortcut is surfaced.
- [ ] Only the spacing scale; only the colour tokens; no `dark:`; no rings.
- [ ] Dialog bodies wrapped in `DialogBody`; one primary action.
- [ ] Copy is sentence case and one sentence.
