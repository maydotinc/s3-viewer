import { Input } from "@s3-viewer/ui/components/input";

type NameInputProps = {
   serverName: string;
   setServerName: (serverName: string) => void;
};

const NameInput = ({ serverName, setServerName }: NameInputProps) => {
   return (
      <div className="flex flex-col">
         <label
            htmlFor="serverName"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Server Name
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
