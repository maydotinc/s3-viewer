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
import { UserRoundPlus } from "lucide-react";
import Link from "next/link";

const AuthPage = () => {
    return (
        <AlertDialog defaultOpen={true}>
            <AlertDialogContent>
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
                        <span className="text-sm">Already have an account? </span>
                        <Link href="/connect" className="text-viewerblue text-sm">Log in</Link>
                    </AlertDialogDescription>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
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