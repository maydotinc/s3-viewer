import { useBucketContext } from "@/components/Buckets/Context";
import useObjectCommands from "@/components/Buckets/useObjectCommands";
import { folderHref, objectHref } from "@/lib/utils/s3/paths";
import { Button } from "@s3-viewer/ui/components/button";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { toast } from "@s3-viewer/ui/components/toast";
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

   return (
      <div className="flex w-full flex-wrap items-center justify-between gap-4 pb-6">
         <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
               <Link href={backHref} aria-label="Back">
                  <ChevronLeft className="size-5" aria-hidden="true" />
               </Link>
            </Button>
            <h1
               className="min-w-0 truncate text-lg font-semibold text-viewerblack"
               title={objectKey}
            >
               {objectKey}
            </h1>
            <Button
               variant="ghost"
               size="icon"
               className="size-7"
               aria-label="Copy object key"
               onClick={() => void copyKey()}
            >
               {copied ? (
                  <Check
                     className="size-3.5 text-viewerblue"
                     aria-hidden="true"
                  />
               ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
               )}
            </Button>
         </div>

         <div className="flex min-h-9 flex-wrap items-center justify-end gap-2 lg:min-w-[440px]">
            {isLoading ? (
               <Spinner size="sm" label="Loading actions" />
            ) : (
               <div className="fade-in flex flex-wrap items-center justify-end gap-2">
                  {can.download && (
                     <>
                        <Button
                           variant="outline"
                           loading={busy === "download"}
                           disabled={busy !== null}
                           onClick={() => void run("download")}
                        >
                           {busy !== "download" && (
                              <Download aria-hidden="true" />
                           )}
                           {busy === "download" ? "Preparing…" : "Download"}
                        </Button>
                        <Button
                           variant="outline"
                           loading={busy === "link"}
                           disabled={busy !== null}
                           onClick={() => void run("link")}
                        >
                           {busy !== "link" && <Link2 aria-hidden="true" />}
                           {busy === "link" ? "Copying…" : "Copy link"}
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
               </div>
            )}
         </div>
      </div>
   );
};

export default ObjectHeader;
