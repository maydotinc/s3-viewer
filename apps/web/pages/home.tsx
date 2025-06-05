import BucketInfo from "@/components/Home/bucketInfo";
import Header from "@/components/Home/header";
import ServerInfo from "@/components/Home/serverInfo";
import ViewerDashboard from "@/components/Layout/dashboard";
import { Separator } from "@s3-viewer/ui/components/separator";

const HomePage = () => {
    return (
        <div className="size-full flex flex-col items-center bg-viewerwhite">
            <Header />
            <Separator />
            <ServerInfo />   
            <Separator className="md:!w-[calc(100%-4rem)]"/>
            <BucketInfo />
        </div>
    );
}

HomePage.getLayout = (page: React.ReactNode) => {
    return (
        <ViewerDashboard>
            {page}
        </ViewerDashboard>
    )
}

export default HomePage;