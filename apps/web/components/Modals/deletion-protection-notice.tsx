import useServer from "@/components/use-server";

type DeletionProtectionNoticeProps = {
   serverId: string;
   action: "delete" | "move" | "rename";
};

const DeletionProtectionNotice = ({
   serverId,
   action,
}: DeletionProtectionNoticeProps) => {
   const capabilities = useServer(serverId)?.capabilities;
   if (capabilities?.deleteProtection !== "checked") return null;

   return (
      <p className="text-sm text-viewertext" role="note">
         {action !== "delete" &&
            `${action === "move" ? "Moving" : "Renaming"} deletes originals after copying. `}
         Files are checked before deletion, but a file changed during deletion
         could also be removed. Pause other writers before continuing.
      </p>
   );
};

export default DeletionProtectionNotice;
