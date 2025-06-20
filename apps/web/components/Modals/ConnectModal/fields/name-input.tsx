import useConnectStore from "@/lib/stores/connectStore";
import { Input } from "@s3-viewer/ui/components/input";

const NameInput = () => {
   const { serverName, setServerName } = useConnectStore();

   return (
      <div className="flex flex-col">
         <label
            htmlFor="serverName"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Server Name<span className="text-lg text-viewerblue">*</span>
         </label>
         <Input
            id="serverName"
            type="text"
            placeholder="My S3 Server"
            className="w-full transition-colors duration-300 text-black"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
         />
      </div>
   );
};

export default NameInput;
