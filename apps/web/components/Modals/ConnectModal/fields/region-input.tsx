import useConnectStore from "@/lib/stores/connectStore";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";

const AWS_REGIONS = [
   "us-east-1",
   "us-east-2",
   "us-west-1",
   "us-west-2",
   "af-south-1",
   "ap-east-1",
   "ap-south-1",
   "ap-northeast-1",
   "ap-northeast-2",
   "ap-northeast-3",
   "ap-southeast-1",
   "ap-southeast-2",
   "ap-southeast-3",
   "ca-central-1",
   "eu-central-1",
   "eu-west-1",
   "eu-west-2",
   "eu-west-3",
   "eu-north-1",
   "eu-south-1",
   "me-south-1",
   "sa-east-1",
] as const;

const RegionInput = () => {
   const { region, setRegion } = useConnectStore();

   return (
      <div className="flex flex-col">
         <label htmlFor="region" className="text-sm font-medium text-black flex items-center gap-1">
            Region<span className="text-lg text-viewerblue">*</span>
         </label>
         <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-full transition-colors duration-300 text-black">
               <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
               {AWS_REGIONS.map((regionOption) => (
                  <SelectItem key={regionOption} value={regionOption}>
                     {regionOption}
                  </SelectItem>
               ))}
            </SelectContent>
         </Select>
      </div>
   );
};

export default RegionInput;
