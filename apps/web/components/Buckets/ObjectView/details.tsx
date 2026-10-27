import { CellBar } from "@/components/DataGrid/skeleton";
import QueryStatus from "@/components/query-status";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { S3ObjectMetadata, S3ObjectSettings } from "@s3-viewer/shared";
import { CircleAlert, Lock } from "lucide-react";

type ObjectDetailsProps = {
   details: S3ObjectSettings | undefined;
   isLoading: boolean;
   error: Error | null;
   onRetry?: () => void;
   retrying?: boolean;
};

const ROWS: { label: string; value: (m: S3ObjectMetadata) => string }[] = [
   { label: "Size", value: (m) => formatBytes(m.contentLength) },
   { label: "Modified", value: (m) => formatDate(m.lastModified) },
   { label: "Content type", value: (m) => m.contentType || "—" },
   { label: "Storage class", value: (m) => m.storageClass ?? "—" },
   { label: "ETag", value: (m) => m.eTag ?? "—" },
];

const HEADER_ROWS: {
   label: string;
   value: (s: S3ObjectSettings) => string | null;
}[] = [
   { label: "Cache-Control", value: (s) => s.cacheControl },
   { label: "Content-Disposition", value: (s) => s.contentDisposition },
   { label: "Content-Encoding", value: (s) => s.contentEncoding },
   { label: "Content-Language", value: (s) => s.contentLanguage },
   {
      label: "Expires",
      value: (s) => (s.expires ? formatDate(s.expires) : null),
   },
   { label: "Encryption", value: (s) => s.serverSideEncryption },
   { label: "KMS key", value: (s) => s.sseKmsKeyId },
   { label: "Version", value: (s) => s.versionId },
];

// a fixed label column keeps the main rows and the metadata rows aligned and leaves dates room to stay on one line
const DETAIL_LIST =
   "grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm";

// one bar per detail row, sized like the values they stand in for, so the loaded rows land where the bars were
const SKELETON_ROWS: [label: string, value: string][] = [
   ["w-8", "w-14"],
   ["w-16", "w-full"],
   ["w-24", "w-28"],
   ["w-24", "w-4"],
   ["w-10", "w-full"],
];

// a quoted MD5 ETag wraps once in the narrow value column, which is only wide enough for one line between sm and lg
const ETAG_WRAP = "sm:max-lg:hidden";

const SkeletonRow = ({
   label,
   value,
   wraps = false,
}: {
   label: string;
   value: string;
   wraps?: boolean;
}) => (
   <div className="contents">
      <div className="flex h-5 items-center">
         <CellBar className={label} />
      </div>
      <div className="flex flex-col">
         <div className="flex h-5 items-center">
            <CellBar className={value} />
         </div>
         {wraps && (
            <div className={cn("flex h-5 items-center", ETAG_WRAP)}>
               <CellBar className="w-1/3" />
            </div>
         )}
      </div>
   </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
   <div className="contents">
      <dt className="min-w-0 text-viewertext [overflow-wrap:anywhere]">
         {label}
      </dt>
      <dd className="min-w-0 break-all font-medium text-viewerblack">
         {value}
      </dd>
   </div>
);

const ObjectDetails = ({
   details,
   isLoading,
   error,
   onRetry,
   retrying,
}: ObjectDetailsProps) => {
   const headers = details
      ? HEADER_ROWS.map(({ label, value }) => ({
           label,
           value: value(details),
        })).filter((row): row is { label: string; value: string } =>
           Boolean(row.value)
        )
      : [];
   const custom = Object.entries(details?.metadata ?? {});

   return (
      <aside
         className="flex h-80 min-w-0 w-full shrink-0 flex-col gap-4 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite p-4 sm:p-6 lg:h-full lg:w-96"
         aria-busy={isLoading || undefined}
      >
         <h2 className="shrink-0 text-base font-semibold text-viewerblack">
            Details
         </h2>
         <QueryStatus
            error={error}
            icon={onRetry ? CircleAlert : Lock}
            tone={onRetry ? "error" : "neutral"}
            title={onRetry ? "Couldn't load details" : "Details unavailable"}
            className="px-0 py-4"
            retrying={retrying}
            onRetry={onRetry}
         >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto [scrollbar-gutter:stable]">
               {details ? (
                  <dl className={DETAIL_LIST}>
                     {ROWS.map(({ label, value }) => (
                        <Row key={label} label={label} value={value(details)} />
                     ))}
                     {headers.map((row) => (
                        <Row key={row.label} {...row} />
                     ))}
                  </dl>
               ) : (
                  <div className={DETAIL_LIST} aria-hidden="true">
                     {SKELETON_ROWS.map(([label, value], index) => (
                        <SkeletonRow
                           key={index}
                           label={label}
                           value={value}
                           wraps={index === SKELETON_ROWS.length - 1}
                        />
                     ))}
                  </div>
               )}
               {custom.length > 0 && (
                  <div className="flex flex-col gap-3 border-t border-viewerborder pt-4">
                     <h3 className="text-sm font-semibold text-viewerblack">
                        Metadata
                     </h3>
                     <dl className={DETAIL_LIST}>
                        {custom.map(([name, value]) => (
                           <Row key={name} label={name} value={value} />
                        ))}
                     </dl>
                  </div>
               )}
            </div>
         </QueryStatus>
      </aside>
   );
};

export default ObjectDetails;
