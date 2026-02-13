import useSendInvite from "@/lib/hooks/mutations/invites/useSendInvite";
import { Button } from "@s3-viewer/ui/components/button";
import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import { LoaderCircle } from "lucide-react";
import { useShareContext } from "../context/ShareContext";

const InviteButton = () => {
   const {
      serverId,
      emails,
      selectedRole,
      invalidEmails,
      setInvalidEmails,
      bucketAccessList,
      onClose,
   } = useShareContext();
   const sendInviteMutation = useSendInvite();

   const handleInvite = () => {
      if (!emails.trim()) {
         return;
      }

      if (bucketAccessList.length === 0) {
         return;
      }

      const emailList = emails
         .split(",")
         .map((email) => email.trim())
         .filter((email) => email.length > 0);

      const invalidEmailList = emailList.filter(
         (email) => !isValidEmail(email)
      );

      if (invalidEmailList.length > 0) {
         setInvalidEmails(invalidEmailList);
         return;
      }

      sendInviteMutation.mutate(
         {
            serverId,
            emails: emailList,
            role: selectedRole,
            bucketAccess: bucketAccessList,
         },
         {
            onSuccess: () => {
               setInvalidEmails([]);
               onClose();
            },
         }
      );
   };

   const isDisabled =
      !emails.trim() ||
      invalidEmails.length > 0 ||
      bucketAccessList.length === 0 ||
      sendInviteMutation.isPending;

   return (
      <Button
         variant="secondary"
         className="w-full"
         onClick={handleInvite}
         disabled={isDisabled}
      >
         {sendInviteMutation.isPending ? (
            <>
               <LoaderCircle className="animate-spin size-4" />
               <span>Inviting</span>
            </>
         ) : (
            "Invite"
         )}
      </Button>
   );
};

export default InviteButton;
