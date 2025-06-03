import SignInForm from "@/components/Connect/signInForm";
import SignUpForm from "@/components/Connect/signUpForm";
import ViewerBanner from "@/components/ViewerLayout/viewerBanner";
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
                    <SignInForm />
                </TabsContent>
                <TabsContent value="SignUp">
                    <SignUpForm />
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