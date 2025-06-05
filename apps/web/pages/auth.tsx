import SignInForm from "@/components/Auth/signInForm";
import SignUpForm from "@/components/Auth/signUpForm";
import ViewerBanner from "@/components/Layout/Banner/banner";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@s3-viewer/ui/components/alert-dialog";
import { Button } from "@s3-viewer/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@s3-viewer/ui/components/card";
import { UserRoundPlus } from "lucide-react";
import { useState } from "react";

const AuthPage = () => {
    const [isOpen, setIsOpen] = useState(true)

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <Card className="bg-viewerwhite rounded-2xl w-full max-w-[calc(100%-2rem)] sm:max-w-lg">
                <CardHeader className="text-center">
                    <CardTitle>
                        Sign in to your account
                    </CardTitle>
                    <CardDescription>
                        Enter your details to sign in.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SignInForm />
                </CardContent>
                <CardFooter>
                    <span className="text-sm">Don't have an account? </span>
                    <Button variant="link" className="px-1 hover:pointer" onClick={() => setIsOpen(true)}>Sign up</Button>
                </CardFooter>
            </Card>
            <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
                <AlertDialogContent className="bg-viewerwhite rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <div className="bg-gray-100 rounded-2xl p-2">
                            <UserRoundPlus className="size-10 text-viewerblue" />
                        </div>
                        <AlertDialogTitle>
                            Create a new account
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter your details to register.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <SignUpForm />
                    <AlertDialogFooter>
                        <AlertDialogDescription>
                            <span className="text-sm">Already have an account?</span>
                            <Button variant="link" className="px-1 hover:pointer" onClick={() => setIsOpen(false)}>Log in</Button>
                        </AlertDialogDescription>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

AuthPage.getLayout = (page: React.ReactNode) => {
    return (
        <ViewerBanner>
            {page}
        </ViewerBanner>
    );
}

export default AuthPage;