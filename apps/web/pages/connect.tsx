import ViewerBanner from "@/components/Layout/Banner/banner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@s3-viewer/ui/components/tabs";

const ConnectPage = () => {
    return (
        <div className="size-full flex justify-center items-center">
            <Tabs defaultValue="SignIn" className="w-[400px]">
                <TabsList className="w-full">
                    <TabsTrigger value="SignIn">Sign In</TabsTrigger>
                    <TabsTrigger value="SignUp">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="SignIn">
                    LOL
                </TabsContent>
                <TabsContent value="SignUp">
                    LOL
                </TabsContent>
            </Tabs>
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