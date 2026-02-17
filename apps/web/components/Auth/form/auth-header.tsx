import Link from "next/link";
import useAuthStore from "@/lib/stores/authStore";

const AuthHeader = () => {
   const { authType } = useAuthStore();

   return (
      <>
         <header className="relative mx-auto flex w-[95%] items-center justify-between px-5 pb-4 pt-6 xl:max-w-screen-2xl">
            <Link href="/" className="select-none pointer-events-auto touch-auto">
               <img
                  src="/icons/viewer.svg"
                  alt="S3 Viewer Logo"
                  draggable={false}
                  loading="lazy"
                  width={120}
                  height={40}
                  className="pointer-events-none select-none h-7 w-auto"
               />
            </Link>

            <div className="flex items-center space-x-2 text-xs sm:space-x-4 sm:text-sm">
               <span className="hidden text-gray-600 sm:inline">
                  {authType === "signin"
                     ? "Don't have an account?"
                     : "Already have an account?"}
               </span>
               <span className="text-gray-600 sm:hidden">
                  {authType === "signin" ? "Need account?" : "Have an account?"}
               </span>
               <Link
                  href={authType === "signin" ? "/signup" : "/login"}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 sm:px-3 sm:text-sm"
               >
                  {authType === "signin" ? "Sign up" : "Login"}
               </Link>
            </div>
         </header>
      </>
   );
};

export default AuthHeader;
