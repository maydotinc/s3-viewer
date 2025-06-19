import { Checkbox } from "@s3-viewer/ui/components/checkbox";

const TermsButton = () => {
   return (
      <div className="flex items-center gap-2">
         <Checkbox id="terms" />
         <label htmlFor="terms" className="text-sm text-black flex items-center gap-1">
            I agree to the
            <span className="hover:text-viewerblue cursor-pointer">
               Terms of Service and Privacy Policy
            </span>
         </label>
      </div>
   );
};

export default TermsButton;
