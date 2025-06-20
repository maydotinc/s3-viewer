import useConnectStore from "@/lib/stores/connectStore";
import { Input } from "@s3-viewer/ui/components/input";

const EndpointInput = () => {
   const { endpoint, setEndpoint } = useConnectStore();

   return (
      <div className="flex flex-col">
         <label
            htmlFor="endpoint"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Endpoint<span className="text-lg text-viewerblue">*</span>
         </label>
         <Input
            id="endpoint"
            type="url"
            placeholder="https://s3.amazonaws.com"
            className="w-full transition-colors duration-300 text-black"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
         />
      </div>
   );
};

export default EndpointInput;
