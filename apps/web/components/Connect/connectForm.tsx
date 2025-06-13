import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@s3-viewer/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@s3-viewer/ui/components/form";
import { Input } from "@s3-viewer/ui/components/input";
import { Loader } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

const formSchema = z.object({
    endpoint: z.string().url("Invalid server URL"),
    accessKey: z.string().min(4, "Access key must be at least 4 characters"),
    secretKey: z.string().min(4, "Secret key must be at least 4 characters"),
});

type ConnectFormData = z.infer<typeof formSchema>;

const ConnectForm = () => {
    const [connectionStatus, setConnectionStatus] = useState<"Searching" | "Connected" | "Waiting">("Waiting");

    const form = useForm<ConnectFormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
          endpoint: "",
          accessKey: "",
          secretKey: "",
        },
    });

    const onSubmit = async (data: ConnectFormData) => {
        console.log(data);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="endpoint"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-semibold">Server URL</FormLabel>
                        <FormControl>
                            <Input placeholder="AWS_S3_ENDPOINT" className="bg-viewergray" {...field} />
                        </FormControl>
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
                            <Input placeholder="your-access-key" className="bg-viewergray" {...field} />
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
                            <Input type="password" placeholder="your-secret-key" className="bg-viewergray" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                {connectionStatus === "Searching" && <Button variant="secondary" type="button" className="w-full"><Loader className="animate-spin" /> Searching</Button>}
                {connectionStatus === "Connected" && <Button variant="secondary" type="submit" className="w-full">Connect</Button>}
                {connectionStatus === "Waiting" && <Button variant="secondary" type="button" className="w-full">Establish Connection</Button>}
            </form>
        </Form>
    )
}

export default ConnectForm;