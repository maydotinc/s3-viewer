import { cn } from "@s3-viewer/ui/lib/utils";

// both live regions are rendered while empty so each exists before it speaks, and a message never shifts the form
const StatusLine = ({
   id,
   error,
   status,
}: {
   id?: string;
   error: string | null;
   status: string | null;
}) => (
   <p
      id={id}
      className={cn(
         "min-h-5 break-words leading-5",
         error ? "text-viewerstrongred" : "text-viewertext"
      )}
   >
      <span role="alert">{error ?? ""}</span>
      <span role="status">{error ? "" : (status ?? "")}</span>
   </p>
);

export default StatusLine;
