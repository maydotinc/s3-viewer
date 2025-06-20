import useConnectStore from "@/lib/stores/connectStore";
import { Button } from "@s3-viewer/ui/components/button";

const ResetButton = () => {
   const { reset } = useConnectStore();

   return (
      <div className="flex items-center justify-center ">
         <span className="text-sm text-viewerblack">Wrong server or credentials?</span>
         <Button
            variant="link"
            className="cursor-pointer px-1 hover:text-viewerblue"
            onClick={() => reset()}
         >
            Reset
         </Button>
      </div>
   );
};
export default ResetButton;
