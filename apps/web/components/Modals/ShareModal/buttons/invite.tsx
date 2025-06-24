import { useServerOperations } from "@/lib/hooks/useServerOperations";
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
      isLoading,
      setIsLoading,
      setInvalidEmails,
   } = useShareContext();
   const { sendInvitation } = useServerOperations();

   const handleInvite = async () => {
      if (!emails.trim()) {
         return;
      }

      const emailList = emails
         .split(",")
         .map((email) => email.trim())
         .filter((email) => email.length > 0);

      const invalidEmailList = emailList.filter((email) => !isValidEmail(email));

      if (invalidEmailList.length > 0) {
         setInvalidEmails(invalidEmailList);
         return;
      }

      setIsLoading(true);
      try {
         const result = await sendInvitation(serverId, emailList, selectedRole);
         if (result.success) {
            setInvalidEmails([]);
         } else {
            console.error("Invitation failed:", result.message);
         }
      } catch (error) {
         console.error("Failed to invite users:", error);
      } finally {
         setIsLoading(false);
      }
   };

   const isDisabled = !emails.trim() || invalidEmails.length > 0 || isLoading;

   return (
      <Button variant="secondary" className="w-full" onClick={handleInvite} disabled={isDisabled}>
         {isLoading ? (
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
