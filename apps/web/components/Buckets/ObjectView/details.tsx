import QueryStatus from "@/components/query-status";
import { formatBytes, formatDate } from "@/lib/utils/format";
import type { S3ObjectMetadata, S3ObjectSettings } from "@s3-viewer/types";
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

const DETAIL_LIST =
   "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm";

const Row = ({ label, value }: { label: string; value: string }) => (
   <div className="contents">
      <dt className="min-w-0 break-all text-viewertext">{label}</dt>
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
         className="flex h-80 min-w-0 w-full shrink-0 flex-col gap-4 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite p-4 sm:p-6 lg:h-full lg:w-80"
         aria-busy={isLoading || undefined}
      >
         <h2 className="shrink-0 text-base font-semibold text-viewerblack">
            Details
         </h2>
         <QueryStatus
            error={error}
            loading={isLoading || !details}
            loadingLabel="Loading details"
            loadingClassName="min-h-0 flex-1"
            icon={onRetry ? CircleAlert : Lock}
            tone={onRetry ? "error" : "neutral"}
            title={onRetry ? "Couldn't load details" : "Details unavailable"}
            className="px-0 py-4"
            retrying={retrying}
            onRetry={onRetry}
         >
            {details && (
               <div className="min-h-0 flex-1 space-y-4 overflow-y-auto [scrollbar-gutter:stable]">
                  <dl className={DETAIL_LIST}>
                     {ROWS.map(({ label, value }) => (
                        <Row key={label} label={label} value={value(details)} />
                     ))}
                     {headers.map((row) => (
                        <Row key={row.label} {...row} />
                     ))}
                  </dl>
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
            )}
         </QueryStatus>
      </aside>
   );
};

export default ObjectDetails;
