import useAuthStore from "@/lib/authStore";
import { Button } from "@s3-viewer/ui/components/button";
import { Link } from "lucide-react";

const SubmitButton = () => {
   const { authType } = useAuthStore();
   const buttonText = authType === "signin" ? "Sign in" : "Sign up";

   // TODO: Implement Google sign in later
   const signInWithGoogle = () => {
      console.log("signInWithGoogle");
   };

   return (
      <div className="flex flex-col gap-0">
         <Button
            variant="outline"
            className="w-full rounded-[12px] flex items-center justify-center gap-2"
            onClick={signInWithGoogle}
         >
            <Link />
            {buttonText} with Google
         </Button>
      </div>
   );
};

export default SubmitButton;
