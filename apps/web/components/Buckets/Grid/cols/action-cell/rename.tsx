import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { hasPermissions, Permission } from "@s3-viewer/permissions";
import { DropdownMenuItem } from "@s3-viewer/ui/components/dropdown-menu";
import { ICellRendererParams } from "ag-grid-community";
import { FilePen } from "lucide-react";

type RenameObjectProps = {
   params: ICellRendererParams;
};

const RenameObject = ({ params }: RenameObjectProps) => {
   const { openRenameObjectModal } = useModalContext();
   const userRole = useServers().currentServer?.userRole;
   const serverId = useSessionStore((state) => state.serverId);
   const bucketName = params.context?.bucketName;
   const fileName = params.data?.Key;

   const handleRename = () => {
      openRenameObjectModal({
         serverId,
         bucketName,
         objectKey: fileName,
         onRenameSuccess: () => {
            params.api?.purgeInfiniteCache();
         },
      });
   };

   return (
      <DropdownMenuItem
         onSelect={handleRename}
         disabled={
            !userRole ||
            !hasPermissions(userRole, [
               Permission.UPLOAD_OBJECT,
               Permission.DELETE_OBJECT,
            ])
         }
      >
         <FilePen className="size-4 text-inherit" />
         Rename
      </DropdownMenuItem>
   );
};

export default RenameObject;
