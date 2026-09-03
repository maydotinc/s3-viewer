import { useHydrated } from "@/lib/hooks/useHydrated";
import { formatDay, pluralize } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { ServerInvite } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Spinner } from "@s3-viewer/ui/components/spinner";
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
            <span className="truncate font-medium text-viewerblack">
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
   <div className={`${LIST_HEIGHT} flex items-center justify-center`}>
      <Spinner label="Loading invites" />
   </div>
);

const InviteEmpty = ({ children }: { children: ReactNode }) => (
   <p
      className={`${LIST_HEIGHT} fade-in flex items-center justify-center text-center text-sm text-viewerlighttext`}
   >
      {children}
   </p>
);

export default InviteCard;
export { InviteEmpty, InviteListLoading, LIST_HEIGHT };
