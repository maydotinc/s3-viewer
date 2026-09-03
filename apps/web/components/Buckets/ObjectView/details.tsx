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

/** Reserved so the card keeps its size while the metadata loads. */
const BODY_HEIGHT = "min-h-[228px]";

const ObjectDetails = ({ metadata, isLoading, error }: ObjectDetailsProps) => (
   <aside
      className="flex w-full shrink-0 flex-col gap-4 self-start rounded-xl border border-viewerborder bg-viewerwhite p-6 lg:w-80"
      aria-busy={isLoading || undefined}
   >
      <h2 className="text-base font-semibold text-viewerblack">Details</h2>
      {error ? (
         <div className={`${BODY_HEIGHT} text-sm`} role="alert">
            <p className="font-medium text-viewertextred">
               Couldn&apos;t load details
            </p>
            <p className="mt-1 text-viewertext">{error.message}</p>
         </div>
      ) : isLoading || !metadata ? (
         <div className={`${BODY_HEIGHT} flex items-center justify-center`}>
            <Spinner label="Loading details" />
         </div>
      ) : (
         <dl
            className={`${BODY_HEIGHT} grid grid-cols-[8rem_1fr] gap-y-3 text-sm`}
         >
            {ROWS.map(({ label, value }) => (
               <div key={label} className="contents">
                  <dt className="text-viewertext">{label}</dt>
                  <dd className="min-w-0 break-all font-medium text-viewerblack">
                     {value(metadata)}
                  </dd>
               </div>
            ))}
         </dl>
      )}
   </aside>
);

export default ObjectDetails;
