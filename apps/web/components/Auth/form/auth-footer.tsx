import Link from "next/link";

const AuthFooter = () => {
   return (
      <footer className="flex flex-col items-center justify-between space-y-2 p-4 text-xs text-gray-500 sm:flex-row sm:space-y-0 sm:p-6 sm:text-sm">
         <span>© 2026 May Inc.</span>
         <div className="flex items-center space-x-3 sm:space-x-4">
            <Link
               href="/legal/terms-of-service"
               className="transition-colors hover:text-gray-700 hover:underline"
            >
               Terms of Service
            </Link>
            <Link
               href="/legal/privacy-policy"
               className="transition-colors hover:text-gray-700 hover:underline"
            >
               Privacy Policy
            </Link>
         </div>
      </footer>
   );
};

export default AuthFooter;
