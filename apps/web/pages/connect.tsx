import ViewerBanner from "@/components/Layout/Banner/banner";
import ConnectForm from "@/components/Servers/Forms/connectForm";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@s3-viewer/ui/components/card";
import { Server } from "lucide-react";

const ConnectPage = () => {
    return (
        <div className="absolute inset-0 flex justify-center items-center">
            <Card className="bg-viewerwhite rounded-2xl w-full max-w-[calc(100%-2rem)] sm:max-w-lg">
                <CardHeader className="flex flex-col gap-2 items-center text-center">
                    <div className="bg-viewergray border border-viewerborder rounded-2xl p-3">
                        <Server className="size-10 text-viewerblue" />
                    </div>
                    <CardTitle className="text-lg">
                        Connect server to get started
                    </CardTitle>
                    <CardDescription>
                        Enter credetials to link the server
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ConnectForm />
                </CardContent>
            </Card>
        </div>
    )
}

ConnectPage.getLayout = (page: React.ReactNode) => {
    return (
        <ViewerBanner>
            {page}
        </ViewerBanner>
    );
}

export default ConnectPage;