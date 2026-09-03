# S3 Viewer design system

This file is the source of truth for layout, spacing, motion and interaction in
`apps/web`. Read it with `BRAND.md` (colours, type, focus) before touching UI.
When two rules disagree, this file wins. Exact numbers are deliberate; do not
invent new ones. The feel we want: calm, generous, precise — a well-funded
startup's admin, not a dense console. References that get this right:
Kytelink (general UI), Koala (general UI), Barberflow (tables).

## 1. Spacing scale

Use only: 4, 8, 12, 16, 24, 32, 48 px (`gap-1/2/3/4/6/8/12`). Padding inside a
control is 8–16, between controls 8–12, between groups 24, between page
sections 32.

## 2. App shell (exact)

| Region                | Size / padding                                                                                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top bar               | `h-14 px-6 border-b border-viewerborder bg-viewerwhite`                                                                                                                                                                                                   |
| Logo                  | `h-6 w-auto`, sits on the 24px left padding, vertically centred                                                                                                                                                                                           |
| Top-bar right cluster | `gap-2`, avatar `size-8`                                                                                                                                                                                                                                  |
| Sidebar               | `w-64 border-r border-viewerborder bg-viewerwhite px-4 py-5 gap-6`                                                                                                                                                                                        |
| Sidebar section label | `mb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-viewerlighttext`                                                                                                                                                                          |
| Sidebar row           | `h-9 rounded-lg px-2 gap-2.5 text-sm`, active `bg-viewergray text-viewerblack font-medium`, hover `bg-viewergray/70`                                                                                                                                      |
| Server switcher card  | `h-12 rounded-lg border px-3`, name `text-sm font-medium`, role `text-xs`                                                                                                                                                                                 |
| Main                  | `min-w-0 flex-1 overflow-hidden`                                                                                                                                                                                                                          |
| Page                  | `mx-auto w-full max-w-[1400px] px-8 py-6 flex flex-col gap-6`                                                                                                                                                                                             |
| Page header           | one row `min-h-9 flex items-center justify-between gap-4`: left = breadcrumb or `h1 text-xl font-semibold tracking-tight text-viewerblack` (+ optional `text-sm text-viewertext` description on a second line), right = actions `flex items-center gap-2` |
| Toolbar row           | `flex h-9 items-center gap-2` — search `w-72` (fixed, not flex-1), actions pushed right with `ml-auto`                                                                                                                                                    |

Nothing may sit closer than 24px to the viewport edge on desktop. Sidebar items
align to the same 16px inset as the sidebar padding; content in the main area
aligns to the 32px page padding.

## 3. Tables (Barberflow style)

- Card: `rounded-xl border border-viewerborder bg-viewerwhite overflow-hidden`.
- Header row: `h-11 bg-viewergray/60 text-[13px] font-medium text-viewertext`,
  hairline below. Body rows: `h-11 text-sm text-viewerblack`, hairline between
  rows (`border-viewerborder`), hover `bg-viewergray/60`, selected
  `bg-viewerblue/5`.
- Cell padding `px-4` (16px) — first and last cells included. Checkbox column
  `w-10` with the checkbox centred. Numeric/date columns right-aligned with
  `tabular-nums`. Text cells `truncate`.
- Row action: ghost `size-8` icon button at the row end, visible on hover/focus
  or always on touch. Menu `align="end"`.
- Empty state inside the card: icon tile + one line + one action, centred,
  `py-16`. Loading: skeleton rows matching row height, no spinner.
- Pagination bar: `h-12 px-4 border-t flex items-center justify-between`;
  left "Showing 1–25 of 120" `text-sm text-viewertext tabular-nums`; right
  "Rows per page" select + first/prev/next/last `size-8` ghost icon buttons.
- AG Grid instances must match these numbers via `themeQuartz` params
  (`rowHeight: 44, headerHeight: 44, cellHorizontalPadding: 16`) — no 4px
  cell padding.

## 4. Controls

- Buttons: h-9 (`px-4`), sm h-8 (`px-3`), lg h-10 (`px-5`); icon+label gap 8;
  icon-only square `size-8`/`size-9`; never fixed widths; `loading` keeps width.
- Inputs/selects h-9, `px-3`, `rounded-lg`, 1px border, focus = border swap.
- Cards: `rounded-xl border border-viewerborder bg-viewerwhite p-6` with
  `gap-4` inside; card title `text-base font-semibold text-viewerblack`, card
  description `text-sm text-viewertext`.
- Section headings inside a page: `text-sm font-medium text-viewerblack` with
  optional `text-sm text-viewertext` helper, `mb-3`.
- Forms: field = Label (`text-sm font-medium text-viewerblack`) + control +
  optional one-line hint (`text-xs text-viewertext`) only if it adds
  information; error line reserved (`min-h-5 text-xs text-viewertextred`).
  Fields stack with `gap-4`. Two-column field grids use `grid gap-4 sm:grid-cols-2`.

## 5. Dialogs and menus

- Dialog: `max-w-md` (forms) / `max-w-lg` (wide), `rounded-xl`, header
  `px-6 pt-5 pb-4 pr-12` (title `text-base font-semibold`, description
  `text-sm text-viewertext`), body `px-6 py-4`, footer `px-6 pb-5 pt-2
justify-end gap-2`. **Every dialog body must be wrapped in `DialogBody`** —
  a DialogContent with bare children has zero padding and is a bug.
- One primary action, right-aligned. No Cancel next to the X. Destructive
  confirms: hide X, Cancel + destructive button.
- Dialogs never animate. Menus, selects, popovers and tooltips fade in over
  120ms (`animate-fade-in` utility, opacity + 2px rise) and disappear
  instantly. Hover states use `transition-colors duration-150`.
- Menu: `min-w-[12rem] rounded-lg p-1 shadow-md`; item `h-9 rounded-md px-2.5
gap-2 text-sm`; label `px-2.5 py-1.5 text-[11px] uppercase tracking-wide
text-viewerlighttext`; separator `-mx-1 my-1`; destructive item red.
- Submenus (DropdownMenuSub): open on hover after 150ms intent delay AND on
  click/→ key; a `ChevronRight` `size-4 text-viewerlighttext` at the row end;
  submenu content aligned to the trigger row (`sideOffset 4`, `alignOffset -4`)
  with the same menu styling. Moving the pointer diagonally into the submenu
  must not close it (Radix handles this — do not add manual pointer handlers).
- Shortcut hints: `DropdownMenuShortcut` renders `Kbd` at the row end
  (`ml-auto`), muted.

## 6. Keyboard

Global (not in inputs): `/` focus filter, `n` new bucket (dashboard), `u`
upload (bucket page), `r` refresh, `⌘K`-free (no palette yet), `?` opens
"Keyboard shortcuts" dialog, `Esc` closes. `g` then `d` dashboard, `g` then
`s` settings. Every shortcut is discoverable: shown in the tooltip of the
button it triggers (`SimpleTooltip shortcut="…"`) and in the `?` dialog.
Tooltips appear on every icon-only button (label + shortcut when any).

## 7. Pages

- Dashboard `/dashboard`: header "Buckets" + provider/role chips; toolbar;
  buckets table card.
- Bucket `/buckets/[name]/…`: breadcrumb header; toolbar; objects table card.
- Share `/servers/[serverId]/share`: full page (no modal). Header = back
  chevron (`size-9` ghost, tooltip "Back", `Esc` also goes back) + "Share
  {server}" + description. Sections as cards with `gap-6`: **Invite people**
  (emails input, role select, bucket access list, Send invite), **Members**
  (table: avatar+name+email, role select, bucket summary, remove), **Pending
  invites** (table: email, role, sent by, expires, revoke — expiry is relative
  with the full date in a tooltip). Uses the Table primitive; both tables are
  `table-fixed` with a min width so they scroll inside the card below `lg`.
- Settings `/settings` with a left sub-nav (`w-48`, rows like the sidebar) and
  routes `/settings/profile` (avatar + name editable, email read-only, danger
  zone: delete account) and `/settings/invites` (received invites with
  accept/decline, sent invites with revoke, "Invite people" → share page).
  `/invites` redirects to `/settings/invites`.
- Profile menu: name/email header, Settings (`g s`), Support, separator, Sign
  out. Delete account lives only in settings.

## 8. Copy

Sentence case. Short verbs on buttons ("Send invite", "Save", "Remove").
Descriptions are one sentence and only when they add information. No
exclamation marks, no "please".
