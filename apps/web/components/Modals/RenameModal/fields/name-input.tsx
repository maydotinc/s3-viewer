import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";

type NameInputProps = {
   serverName: string;
   setServerName: (serverName: string) => void;
   setError: (error: string | null) => void;
};

const NameInput = ({ serverName, setServerName, setError }: NameInputProps) => {
   return (
      <div className="flex flex-col">
         <label
            htmlFor="serverName"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Server Name<span className="text-viewerblue text-lg">*</span>
         </label>
         <Input
            id="serverName"
            type="text"
            placeholder="My S3 Server"
            className={cn("w-full transition-colors duration-300 text-black")}
            value={serverName}
            onChange={(e) => {
               setServerName(e.target.value);
               setError(null);
            }}
         />
      </div>
   );
};

export default NameInput;
