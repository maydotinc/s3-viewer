import { formatBytes, formatDate } from "@/lib/utils/format";
import type { S3ObjectMetadata } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";

type ObjectDetailsProps = {
   metadata: S3ObjectMetadata | undefined;
   isLoading: boolean;
   error: Error | null;
};

const ROWS: { label: string; value: (m: S3ObjectMetadata) => string }[] = [
   { label: "Size", value: (m) => formatBytes(m.contentLength) },
   { label: "Modified", value: (m) => formatDate(m.lastModified) },
   { label: "Content type", value: (m) => m.contentType || "—" },
   { label: "Storage class", value: (m) => m.storageClass ?? "—" },
   { label: "ETag", value: (m) => m.eTag ?? "—" },
];

const DETAILS_HEIGHT = "min-h-[264px]";

const ObjectDetails = ({ metadata, isLoading, error }: ObjectDetailsProps) => (
   <aside
      className="w-full shrink-0 lg:w-72"
      aria-busy={isLoading || undefined}
   >
      <h2 className="mb-4 text-sm font-semibold text-viewerblack">Details</h2>
      {error ? (
         <div className={`${DETAILS_HEIGHT} text-sm`} role="alert">
            <p className="font-medium text-viewertextred">
               Couldn&apos;t load details
            </p>
            <p className="mt-1 text-viewertext">{error.message}</p>
         </div>
      ) : isLoading || !metadata ? (
         <div className={`${DETAILS_HEIGHT} flex items-center justify-center`}>
            <Spinner label="Loading details" />
         </div>
      ) : (
         <dl className={`${DETAILS_HEIGHT} fade-in space-y-4`}>
            {ROWS.map(({ label, value }) => (
               <div key={label} className="flex flex-col gap-1">
                  <dt className="text-xs leading-4 text-viewerlighttext">
                     {label}
                  </dt>
                  <dd className="break-all text-sm font-medium leading-5 text-viewerblack">
                     {value(metadata)}
                  </dd>
               </div>
            ))}
         </dl>
      )}
   </aside>
);

export default ObjectDetails;
