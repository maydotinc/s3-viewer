import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { hasPermissions, Permission } from "@s3-viewer/permissions";
import { DropdownMenuItem } from "@s3-viewer/ui/components/dropdown-menu";
import { ICellRendererParams } from "ag-grid-community";
import { Trash2 } from "lucide-react";

type DeleteObjectProps = {
   params: ICellRendererParams;
};

const DeleteObject = ({ params }: DeleteObjectProps) => {
   const { openConfirmDeleteModal } = useModalContext();
   const userRole = useServers().currentServer?.userRole;
   const serverId = useSessionStore((state) => state.serverId);
   const bucketName = params.context?.bucketName;
   const fileName = params.data?.Key;

   const handleDelete = async () => {
      openConfirmDeleteModal({
         serverId,
         bucketName,
         fileNames: [fileName],
         gridApi: params.api,
      });
   };

   return (
      <DropdownMenuItem
         variant="destructive"
         onSelect={handleDelete}
         disabled={
            !userRole || !hasPermissions(userRole, [Permission.DELETE_OBJECT])
         }
      >
         <Trash2 className="size-4 text-inherit" />
         Delete
      </DropdownMenuItem>
   );
};

export default DeleteObject;
