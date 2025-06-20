import useConnectStore from "@/lib/stores/connectStore";
import { Input } from "@s3-viewer/ui/components/input";

const SecretKeyInput = () => {
   const { secretKey, setSecretKey } = useConnectStore();

   return (
      <div className="flex flex-col">
         <label
            htmlFor="secretKey"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Secret Key<span className="text-lg text-viewerblue">*</span>
         </label>
         <Input
            id="secretKey"
            type="password"
            placeholder="your-secret-key"
            className="w-full transition-colors duration-300 text-black"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
         />
      </div>
   );
};

export default SecretKeyInput;
