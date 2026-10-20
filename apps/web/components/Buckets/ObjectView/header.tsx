import { useBucketContext } from "@/components/Buckets/Context";
import {
   ActionMenuItems,
   type SecondaryAction,
} from "@/components/Buckets/Grid/action-menu";
import useObjectCommands from "@/components/Buckets/useObjectCommands";
import { COMPACT } from "@/components/compact-button";
import { PageHeader, PageTitle } from "@/components/Layout/page";
import RefreshButton from "@/components/refresh-button";
import Reserve from "@/components/reserve";
import useAsyncAction from "@/components/use-async-action";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { visibleText } from "@/lib/utils/format";
import { folderHref, objectHref } from "@/lib/utils/s3/paths";
import { canPresignObjectKey } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   Check,
   ChevronLeft,
   Copy,
   CopyPlus,
   Download,
   Ellipsis,
   FilePen,
   Link2,
   PenLine,
   SlidersHorizontal,
   Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

const { button: COMPACT_BUTTON, label: COMPACT_LABEL } = COMPACT.md;

type ObjectHeaderProps = {
   bucketName: string;
   objectKey: string;
   eTag: string | null;
   metadataPending: boolean;
   onRefresh: (() => void) | null;
   refreshing: boolean;
   path: string[];
   canEdit: boolean;
   editing: boolean;
   onEdit: () => void;
};

const ObjectHeader = ({
   bucketName,
   objectKey,
   path,
   eTag,
   metadataPending,
   onRefresh,
   refreshing,
   canEdit,
   editing,
   onEdit,
}: ObjectHeaderProps) => {
   const router = useRouter();
   const { isLoading } = useBucketContext();
   const commands = useObjectCommands();
   const download = useAsyncAction();
   const link = useAsyncAction();
   const busy = download.pending || link.pending;
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
      const copied = await copyToClipboard(objectKey, {
         failure: "Could not copy the object key.",
      });
      if (!copied) return;
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
   };

   const { can } = commands;
   const shownKey = visibleText(objectKey);
   const browserLink = canPresignObjectKey(objectKey);

   const actionList: (SecondaryAction | false)[] = [
      can.upload && {
         label: "Edit settings",
         icon: SlidersHorizontal,
         disabled: editing || metadataPending,
         onSelect: () => commands.editSettings(objectKey, eTag),
      },
      can.rename && {
         label: "Rename",
         icon: FilePen,
         disabled: editing || metadataPending,
         onSelect: () =>
            commands.rename(
               objectKey,
               eTag,
               (newObjectKey) =>
                  void router.replace(objectHref(bucketName, newObjectKey))
            ),
      },
      can.upload && {
         label: "Copy to…",
         icon: CopyPlus,
         disabled: metadataPending,
         onSelect: () =>
            commands.copy(
               objectKey,
               eTag,
               (newObjectKey) =>
                  void router.push(objectHref(bucketName, newObjectKey))
            ),
      },
      can.delete && {
         label: "Delete",
         icon: Trash2,
         destructive: true,
         disabled: editing || metadataPending,
         onSelect: () =>
            commands.remove(
               [{ key: objectKey, expectedETag: eTag }],
               () => void router.replace(backHref)
            ),
      },
   ];
   const secondary = actionList.filter(
      (action): action is SecondaryAction => Boolean(action)
   );

   const actions = (
      <>
         {/* the details card offers its own retry when the metadata failed */}
         <Reserve show={onRefresh !== null} className="inline-flex">
            <RefreshButton
               spinning={refreshing}
               disabled={metadataPending}
               shortcut="r"
               onClick={() => onRefresh?.()}
            />
         </Reserve>
         {can.download && (
            <>
               <Button
                  variant="outline"
                  loading={
                     download.pending ||
                     (!browserLink && commands.isPreparingZip)
                  }
                  disabled={busy}
                  className={COMPACT_BUTTON}
                  onClick={() =>
                     void download.run(() => commands.download(objectKey))
                  }
               >
                  <Download aria-hidden="true" />
                  <span className={COMPACT_LABEL}>
                     {browserLink ? "Download" : "Download as zip"}
                  </span>
               </Button>
               {browserLink && (
                  <Button
                     variant="outline"
                     loading={link.pending}
                     disabled={busy}
                     className={COMPACT_BUTTON}
                     onClick={() =>
                        void link.run(() => commands.copyLink(objectKey))
                     }
                  >
                     <Link2 aria-hidden="true" />
                     <span className={COMPACT_LABEL}>Copy link</span>
                  </Button>
               )}
            </>
         )}
         {secondary.map(
            ({ label, icon: Icon, destructive, disabled, onSelect }) => (
               <Button
                  key={label}
                  variant={destructive ? "destructive" : "outline"}
                  className="hidden @4xl:inline-flex"
                  disabled={disabled}
                  onClick={onSelect}
               >
                  <Icon aria-hidden="true" />
                  {label}
               </Button>
            )
         )}
         {secondary.length > 0 && (
            <DropdownMenu modal={false}>
               <SimpleTooltip label="More actions">
                  <DropdownMenuTrigger asChild>
                     <Button
                        variant="outline"
                        size="icon"
                        className="@4xl:hidden"
                        aria-label="More actions"
                     >
                        <Ellipsis aria-hidden="true" />
                     </Button>
                  </DropdownMenuTrigger>
               </SimpleTooltip>
               <DropdownMenuContent align="end" className="w-56">
                  <ActionMenuItems actions={secondary} />
               </DropdownMenuContent>
            </DropdownMenu>
         )}
         {/* last so the reserved slot is invisible trailing space when the file can't be edited */}
         <Reserve show={canEdit} className="inline-flex">
            <Button
               variant="outline"
               className={COMPACT_BUTTON}
               disabled={!canEdit}
               onClick={onEdit}
            >
               <PenLine aria-hidden="true" />
               <span className={COMPACT_LABEL}>Edit</span>
            </Button>
         </Reserve>
      </>
   );

   return (
      <PageHeader
         className="[&>div]:basis-full"
         actions={
            <div
               className={cn(
                  "@container flex h-9 w-full min-w-0 items-center gap-2 [&>*]:shrink-0",
                  isLoading && "invisible"
               )}
               aria-busy={isLoading || undefined}
            >
               {actions}
            </div>
         }
      >
         <div className="flex min-w-0 items-center gap-2">
            <SimpleTooltip label="Back">
               <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={backHref} aria-label="Back">
                     <ChevronLeft aria-hidden="true" />
                  </Link>
               </Button>
            </SimpleTooltip>
            <PageTitle title={shownKey}>{shownKey}</PageTitle>
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
