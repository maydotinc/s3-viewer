import { Button } from "@s3-viewer/ui/components/button";
import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import { LoaderCircle } from "lucide-react";
import { useShareContext } from "../context/ShareContext";

const InviteButton = () => {
   const { emails, selectedRole, invalidEmails, isLoading, setIsLoading, setInvalidEmails } =
      useShareContext();

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
         // TODO: Implement API call to invite users with selectedRole
         console.log("Inviting users:", emailList, "with role:", selectedRole);

         // Simulate API call
         await new Promise((resolve) => setTimeout(resolve, 1000));

         // TODO: Handle success/error states
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
