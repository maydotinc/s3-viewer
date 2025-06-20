import useSessionStore from "@/lib/stores/sessionStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { ServerCredentials } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Form,
   FormControl,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from "@s3-viewer/ui/components/form";
import { Input } from "@s3-viewer/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Loader } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

type EditFormProps = {
   setIsOpen: (isOpen: boolean) => void;
};

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

const formSchema = z.object({
   endpoint: z.string().url("Invalid endpoint URL"),
   name: z.string().min(3, "Name is required"),
   accessKey: z.string().min(4, "Access key must be at least 4 characters"),
   secretKey: z.string().min(4, "Secret key must be at least 4 characters"),
   region: z.enum(AWS_REGIONS, {
      message: "Please select a region",
   }),
});

type EditFormData = z.infer<typeof formSchema>;

const EditForm = ({ setIsOpen }: EditFormProps) => {
   const [connectionStatus, setConnectionStatus] = useState<
      "Establishing" | "Connected" | "Waiting"
   >("Waiting");
   const [error, setError] = useState<string | null>(null);
   const [connectedServerCreds, setConnectedServerCreds] = useState<ServerCredentials | null>(null);
   const setServerId = useSessionStore((state) => state.setServerId);
   const serverId = useSessionStore((state) => state.serverId);
   const router = useRouter();

   const form = useForm<EditFormData>({
      resolver: zodResolver(formSchema),
      defaultValues: {
         endpoint: "",
         name: "",
         accessKey: "",
         secretKey: "",
         region: "us-east-1",
      },
   });

   const onEstablishConnection = async (data: EditFormData) => {
      setError(null);
      setConnectionStatus("Establishing");
      const credentials: ServerCredentials = {
         accessKey: data.accessKey,
         secretKey: data.secretKey,
         endpoint: data.endpoint,
         region: data.region,
      };

      try {
         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/manage/establish`, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(credentials),
         });

         console.log("Response status:", response.status);
         console.log("Response headers:", response.headers);

         if (response.ok) {
            const responseData = await response.json();
            console.log("Success response:", responseData);
            setConnectionStatus("Connected");
            setConnectedServerCreds(credentials);
         } else {
            setConnectionStatus("Waiting");
            const responseText = await response.text();
            console.log("Error response text:", responseText);
            setError(`Unable to establish connection. Status: ${response.status}`);
         }
      } catch (error) {
         console.error("Fetch error:", error);
         setConnectionStatus("Waiting");
         setError("Network error occurred.");
      }
   };

   const onSubmit = async (data: EditFormData) => {
      setError(null);
      if (!connectedServerCreds) {
         setError("No server credentials found.");
         return;
      }
      try {
         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/manage/update`, {
            method: "PUT",
            headers: {
               "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
               serverId: serverId,
               newServerCredentials: connectedServerCreds,
               newServerName: data.name,
            }),
         });

         console.log("Response status:", response.status);

         if (response.ok) {
            const responseData = await response.json();
            console.log("Success response:", responseData);
            setIsOpen(false);
         } else {
            setConnectionStatus("Waiting");
            const responseText = await response.text();
            console.log("Error response text:", responseText);
            setError(`Unable to edit server. Status: ${response.status}`);
         }
      } catch (error) {
         console.error("Fetch error:", error);
         setConnectionStatus("Waiting");
         setError("Network error occurred.");
      }
   };

   return (
      <Form {...form}>
         <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex gap-2">
               <FormField
                  control={form.control}
                  name="endpoint"
                  render={({ field }) => (
                     <FormItem className="flex-[2]">
                        <FormLabel className="font-semibold">Server URL</FormLabel>
                        <FormControl>
                           <Input
                              placeholder="AWS_S3_ENDPOINT"
                              className="bg-viewergray"
                              {...field}
                           />
                        </FormControl>
                        <FormMessage />
                     </FormItem>
                  )}
               />
               <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                     <FormItem className="flex-1">
                        <FormLabel className="font-semibold">Server Name</FormLabel>
                        <FormControl>
                           <Input placeholder="New Server" className="bg-viewergray" {...field} />
                        </FormControl>
                        <FormMessage />
                     </FormItem>
                  )}
               />
            </div>
            <div className="flex gap-2">
               <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                     <FormItem>
                        <FormLabel className="font-semibold">Region</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                           <FormControl>
                              <SelectTrigger className="bg-viewergray">
                                 <SelectValue placeholder="Select a region" />
                              </SelectTrigger>
                           </FormControl>
                           <SelectContent className="max-h-[200px]">
                              {AWS_REGIONS.map((region) => (
                                 <SelectItem key={region} value={region}>
                                    {region}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                        <FormMessage />
                     </FormItem>
                  )}
               />
               <FormField
                  control={form.control}
                  name="accessKey"
                  render={({ field }) => (
                     <FormItem>
                        <FormLabel className="font-semibold">Access Key</FormLabel>
                        <FormControl>
                           <Input
                              placeholder="your-access-key"
                              className="bg-viewergray"
                              {...field}
                           />
                        </FormControl>
                        <FormMessage />
                     </FormItem>
                  )}
               />
               <FormField
                  control={form.control}
                  name="secretKey"
                  render={({ field }) => (
                     <FormItem>
                        <FormLabel className="font-semibold">Secret Key</FormLabel>
                        <FormControl>
                           <Input
                              type="password"
                              placeholder="your-secret-key"
                              className="bg-viewergray"
                              {...field}
                           />
                        </FormControl>
                        <FormMessage />
                     </FormItem>
                  )}
               />
            </div>
            <div className="flex gap-2 w-full">
               <Button type="button" className="flex-1" onClick={() => setIsOpen(false)}>
                  Discard
               </Button>
               {connectionStatus === "Establishing" && (
                  <Button variant="outline" type="button" className="flex-1" disabled>
                     <Loader className="animate-spin" /> Establishing
                  </Button>
               )}
               {connectionStatus === "Connected" && (
                  <Button variant="secondary" type="submit" className="flex-1">
                     Connect
                  </Button>
               )}
               {connectionStatus === "Waiting" && (
                  <Button
                     variant="secondary"
                     type="button"
                     className="flex-1"
                     onClick={form.handleSubmit(onEstablishConnection)}
                  >
                     Establish Connection
                  </Button>
               )}
               {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
         </form>
      </Form>
   );
};

export default EditForm;
