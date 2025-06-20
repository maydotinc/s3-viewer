import useConnectStore from "@/lib/stores/connectStore";
import { Input } from "@s3-viewer/ui/components/input";

const AccessKeyInput = () => {
   const { accessKey, setAccessKey } = useConnectStore();

   return (
      <div className="flex flex-col">
         <label
            htmlFor="accessKey"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Access Key<span className="text-lg text-viewerblue">*</span>
         </label>
         <Input
            id="accessKey"
            type="text"
            placeholder="your-access-key"
            className="w-full transition-colors duration-300 text-black"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
         />
      </div>
   );
};

export default AccessKeyInput;
