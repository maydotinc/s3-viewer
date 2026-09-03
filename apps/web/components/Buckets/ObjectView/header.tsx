import { useBucketContext } from "@/components/Buckets/Context";
import useObjectCommands from "@/components/Buckets/useObjectCommands";
import { PageHeader } from "@/components/Layout/page";
import { folderHref, objectHref } from "@/lib/utils/s3/paths";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { toast } from "@s3-viewer/ui/components/toast";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import {
   Check,
   ChevronLeft,
   Copy,
   Download,
   FilePen,
   Link2,
   Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

type ObjectHeaderProps = {
   bucketName: string;
   objectKey: string;
   path: string[];
};

const ObjectHeader = ({ bucketName, objectKey, path }: ObjectHeaderProps) => {
   const router = useRouter();
   const { isLoading } = useBucketContext();
   const commands = useObjectCommands(bucketName);
   const [busy, setBusy] = useState<"download" | "link" | null>(null);
   const [copied, setCopied] = useState(false);
   const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const backHref = folderHref(bucketName, path.slice(0, -1));

   useEffect(
      () => () => {
         if (copiedTimer.current) clearTimeout(copiedTimer.current);
      },
      []
   );

   const copyKey = async () => {
      try {
         await navigator.clipboard.writeText(objectKey);
         setCopied(true);
         if (copiedTimer.current) clearTimeout(copiedTimer.current);
         copiedTimer.current = setTimeout(() => setCopied(false), 1500);
      } catch {
         toast.error("Could not copy the object key.");
      }
   };

   const run = async (kind: "download" | "link") => {
      setBusy(kind);
      try {
         await (kind === "download"
            ? commands.download(objectKey)
            : commands.copyLink(objectKey));
      } finally {
         setBusy(null);
      }
   };

   const { can } = commands;

   const actions = isLoading ? (
      <div className="flex h-9 items-center gap-2" aria-busy="true">
         <Skeleton className="h-9 w-32 rounded-lg" />
         <Skeleton className="h-9 w-28 rounded-lg" />
         <Skeleton className="h-9 w-28 rounded-lg" />
         <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
   ) : (
      <>
         {can.download && (
            <>
               <Button
                  variant="outline"
                  loading={busy === "download"}
                  disabled={busy !== null}
                  onClick={() => void run("download")}
               >
                  <Download aria-hidden="true" />
                  Download
               </Button>
               <Button
                  variant="outline"
                  loading={busy === "link"}
                  disabled={busy !== null}
                  onClick={() => void run("link")}
               >
                  <Link2 aria-hidden="true" />
                  Copy link
               </Button>
            </>
         )}
         {can.rename && (
            <Button
               variant="outline"
               onClick={() =>
                  commands.rename(
                     objectKey,
                     (newObjectKey) =>
                        void router.replace(
                           objectHref(bucketName, newObjectKey)
                        )
                  )
               }
            >
               <FilePen aria-hidden="true" />
               Rename
            </Button>
         )}
         {can.delete && (
            <Button
               variant="destructive"
               onClick={() =>
                  commands.remove(
                     [objectKey],
                     () => void router.replace(backHref)
                  )
               }
            >
               <Trash2 aria-hidden="true" />
               Delete
            </Button>
         )}
      </>
   );

   return (
      <PageHeader actions={actions}>
         <div className="flex min-w-0 items-center gap-2">
            <SimpleTooltip label="Back">
               <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={backHref} aria-label="Back">
                     <ChevronLeft aria-hidden="true" />
                  </Link>
               </Button>
            </SimpleTooltip>
            <h1
               className="min-w-0 truncate text-xl font-semibold tracking-tight text-viewerblack"
               title={objectKey}
            >
               {objectKey}
            </h1>
            <SimpleTooltip label={copied ? "Copied" : "Copy object key"}>
               <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy object key"
                  onClick={() => void copyKey()}
               >
                  {copied ? (
                     <Check className="text-viewerblue" aria-hidden="true" />
                  ) : (
                     <Copy aria-hidden="true" />
                  )}
               </Button>
            </SimpleTooltip>
         </div>
      </PageHeader>
   );
};

export default ObjectHeader;
