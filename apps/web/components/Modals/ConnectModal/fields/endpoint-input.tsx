import useConnectStore from "@/lib/stores/connectStore";
import { Input } from "@s3-viewer/ui/components/input";

const EndpointInput = () => {
   const { endpoint, setEndpoint } = useConnectStore();

   return <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />;
};

export default EndpointInput;
