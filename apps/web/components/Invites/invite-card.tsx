import { useHydrated } from "@/lib/hooks/useHydrated";
import { formatDay, pluralize } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { ServerInvite } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { MailOpen } from "lucide-react";
import { ReactNode } from "react";

type InviteCardProps = {
   invite: ServerInvite;
   subtitle: string;
   actions: ReactNode;
};

const InviteCard = ({ invite, subtitle, actions }: InviteCardProps) => {
   const hydrated = useHydrated();
   const isExpired =
      hydrated && new Date(invite.expiresAt).getTime() <= Date.now();

   return (
      <li className="flex flex-col gap-2 rounded-lg border border-viewerborder p-3">
         <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate font-medium text-viewerblack">
               {invite.server.name}
            </span>
            <Badge variant="outline">{ROLE_LABELS[invite.role]}</Badge>
         </div>
         <div className="flex flex-col text-sm text-viewertext">
            <span className="truncate">{subtitle}</span>
            <span>{pluralize(invite.bucketAccess.length, "bucket")}</span>
            <span
               className={
                  isExpired ? "text-viewertextred" : "text-viewerlighttext"
               }
            >
               {hydrated
                  ? `${isExpired ? "Expired" : "Expires"} ${formatDay(invite.expiresAt)}`
                  : " "}
            </span>
         </div>
         <div className="flex gap-2">{actions}</div>
      </li>
   );
};

const LIST_HEIGHT = "min-h-[138px]";

const InviteListLoading = () => (
   <div className={`${LIST_HEIGHT} flex flex-col gap-2`} aria-busy="true">
      <Skeleton className="h-[138px] w-full rounded-lg" />
   </div>
);

const InviteEmpty = ({ children }: { children: ReactNode }) => (
   <div
      className={`${LIST_HEIGHT} flex flex-col items-center justify-center gap-3 text-center`}
   >
      <span className="flex size-10 items-center justify-center rounded-lg bg-viewergray">
         <MailOpen className="size-5 text-viewerlighttext" aria-hidden="true" />
      </span>
      <p className="text-sm text-viewertext">{children}</p>
   </div>
);

export default InviteCard;
export { InviteEmpty, InviteListLoading, LIST_HEIGHT };
