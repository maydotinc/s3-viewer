import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import getPresignedDownloadUrl from "@/lib/utils/s3/getPresignedDownloadUrl";
import { hasPermissions, Permission } from "@s3-viewer/permissions";
import { DropdownMenuItem } from "@s3-viewer/ui/components/dropdown-menu";
import { ICellRendererParams } from "ag-grid-community";
import { Download } from "lucide-react";

type DownloadObjectProps = {
   params: ICellRendererParams;
   setIsLoading: (isLoading: boolean) => void;
};

const DownloadObject = ({ params, setIsLoading }: DownloadObjectProps) => {
   const userRole = useServers().currentServer?.userRole;
   const serverId = useSessionStore((state) => state.serverId);
   const fileName = params.data?.Key;
   const bucketName = params.context?.bucketName;

   const handleDownload = async () => {
      setIsLoading(true);
      console.log("Downloading file", fileName);
      if (!bucketName || !serverId || !fileName) {
         console.error(
            "Missing bucket name, server ID, file name, or file size"
         );
         setIsLoading(false);
         return;
      }
      try {
         const { url } = await getPresignedDownloadUrl(
            bucketName,
            fileName,
            serverId
         );
         if (!url) {
            console.error("No URL returned from presigned download URL");
            setIsLoading(false);
            return;
         }

         window.open(url, "_blank");
      } catch (error) {
         console.error("Unable to download file", error);
      } finally {
         setIsLoading(false);
      }
   };

   return (
      <DropdownMenuItem
         onSelect={handleDownload}
         disabled={
            !userRole || !hasPermissions(userRole, [Permission.DOWNLOAD_OBJECT])
         }
      >
         <Download className="size-4 text-inherit" />
         Download
      </DropdownMenuItem>
   );
};

export default DownloadObject;
