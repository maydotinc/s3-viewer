import { cn } from "@s3-viewer/ui/lib/utils";
import {
   Check,
   Download,
   EllipsisVertical,
   File,
   FilePen,
   Folder,
   Link2,
   Search,
   Trash2,
   Upload,
} from "lucide-react";

type MockRow = {
   name: string;
   isFolder?: boolean;
   size: string;
   modified: string;
   selected?: boolean;
   menuOpen?: boolean;
};

const BUCKET_NAME = "acme-assets";

const ROWS: MockRow[] = [
   { name: "invoices/", isFolder: true, size: "—", modified: "Aug 12, 2026" },
   {
      name: "product-photos/",
      isFolder: true,
      size: "—",
      modified: "Aug 9, 2026",
   },
   {
      name: "2026-08-report.pdf",
      size: "1.2 MB",
      modified: "Aug 28, 2026",
      selected: true,
      menuOpen: true,
   },
   { name: "hero-banner.png", size: "840 KB", modified: "Aug 21, 2026" },
   { name: "customers.csv", size: "96 KB", modified: "Aug 3, 2026" },
   { name: "backup-2026-07.zip", size: "4.8 GB", modified: "Jul 31, 2026" },
];

const MENU_ITEMS = [
   { icon: Download, label: "Download" },
   { icon: Link2, label: "Copy link", active: true },
   { icon: FilePen, label: "Rename" },
   { icon: Trash2, label: "Delete", destructive: true },
];

const ROW_GRID = "grid grid-cols-[16px_1fr_64px_92px_28px] items-center gap-3";

const MockCheckbox = ({ checked }: { checked?: boolean }) => (
   <span
      className={cn(
         "flex size-4 items-center justify-center rounded-[4px] border",
         checked
            ? "border-viewerblue bg-viewerblue text-viewerwhite"
            : "border-viewerborder bg-viewerwhite"
      )}
   >
      {checked && <Check className="size-3" strokeWidth={3} />}
   </span>
);

const RowMenu = () => (
   <div className="absolute right-3 top-9 z-10 w-40 rounded-lg border border-viewerborder bg-viewerwhite p-1 text-left shadow-[0_12px_32px_-12px_rgba(14,18,27,0.35)]">
      {MENU_ITEMS.map(({ icon: Icon, label, active, destructive }, index) => (
         <div key={label}>
            {destructive && <div className="my-1 h-px bg-viewerborder" />}
            <div
               className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-2 text-[13px]",
                  active && "bg-viewergray text-viewerblack",
                  destructive ? "text-viewertextred" : "text-viewertext",
                  index === 0 && !active && "text-viewertext"
               )}
            >
               <Icon
                  className={cn(
                     "size-3.5",
                     destructive ? "text-viewertextred" : "text-viewerlighttext"
                  )}
               />
               {label}
            </div>
         </div>
      ))}
   </div>
);

const Row = ({ row }: { row: MockRow }) => (
   <li
      className={cn(
         "relative h-10 border-t border-viewerborder px-3 text-[13px]",
         ROW_GRID,
         row.selected ? "bg-viewerblue/5" : "bg-viewerwhite"
      )}
   >
      <MockCheckbox checked={row.selected} />
      <span className="flex min-w-0 items-center gap-2">
         {row.isFolder ? (
            <Folder className="size-4 shrink-0 text-viewerblue" />
         ) : (
            <File className="size-4 shrink-0 text-viewerlighttext" />
         )}
         <span
            className={cn(
               "truncate",
               row.selected ? "font-medium text-viewerblack" : "text-viewertext"
            )}
         >
            {row.name}
         </span>
      </span>
      <span className="text-right text-viewertext tabular-nums">
         {row.size}
      </span>
      <span className="whitespace-nowrap text-viewertext tabular-nums">
         {row.modified}
      </span>
      <span
         className={cn(
            "flex size-7 items-center justify-center rounded-md",
            row.menuOpen ? "bg-viewergray text-viewerblack" : "text-viewertext"
         )}
      >
         <EllipsisVertical className="size-4" />
      </span>
      {row.menuOpen && <RowMenu />}
   </li>
);

const BrowserMock = () => (
   <div className="relative w-[520px] rounded-xl border border-white/15 bg-viewerwhite shadow-[0_32px_80px_-32px_rgba(0,0,0,0.7)] motion-fade-up">
      <div className="flex h-14 items-center gap-3 border-b border-viewerborder px-4">
         <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-viewerblack">
            <Folder className="size-4 shrink-0 text-viewerblue" />
            <span className="truncate">{BUCKET_NAME}</span>
         </span>
         <span className="ml-auto flex h-8 w-44 items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-2.5 text-[13px] text-viewerlighttext">
            <Search className="size-3.5 shrink-0" />
            Filter by prefix…
         </span>
         <span className="flex h-8 items-center gap-1.5 rounded-lg bg-viewerblue px-3 text-[13px] font-medium text-viewerwhite">
            <Upload className="size-3.5" />
            Upload
         </span>
      </div>

      <div
         className={cn(
            "h-9 bg-viewergray px-3 text-xs font-medium text-viewertext",
            ROW_GRID
         )}
      >
         <MockCheckbox />
         <span>Name</span>
         <span className="text-right">Size</span>
         <span>Modified</span>
         <span />
      </div>

      <ul className="overflow-visible rounded-b-xl">
         {ROWS.map((row) => (
            <Row key={row.name} row={row} />
         ))}
      </ul>

      <div className="flex h-11 items-center justify-between rounded-b-xl border-t border-viewerborder px-4 text-xs text-viewertext">
         <span>1 of 6 selected</span>
         <span className="tabular-nums">Page 1 of 3</span>
      </div>

      <div className="absolute -bottom-6 right-6 flex h-11 items-center gap-2.5 rounded-lg border border-viewerborder bg-viewerwhite pl-3 pr-4 text-[13px] text-viewerblack shadow-[0_12px_32px_-12px_rgba(14,18,27,0.4)]">
         <span className="flex size-5 items-center justify-center rounded-full bg-viewerblue text-viewerwhite">
            <Check className="size-3" strokeWidth={3} />
         </span>
         <span className="whitespace-nowrap">
            Link copied. It expires in 15 minutes.
         </span>
      </div>
   </div>
);

const BrandPanel = () => (
   <aside
      aria-hidden="true"
      className="relative hidden select-none overflow-hidden bg-viewerdarkblue lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12"
   >
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]">
         <defs>
            <pattern
               id="auth-grid"
               width="32"
               height="32"
               patternUnits="userSpaceOnUse"
            >
               <path
                  d="M32 0H0V32"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1"
               />
            </pattern>
         </defs>
         <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      <div className="relative flex w-full max-w-[520px] flex-col items-center gap-14">
         <BrowserMock />
         <p className="text-balance text-center text-lg font-medium leading-7 text-white/90">
            Browse, upload and share files in any S3-compatible bucket.
         </p>
      </div>
   </aside>
);

export default BrandPanel;
