import AuthHeader from "./auth-header";
import AuthFooter from "./auth-footer";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
   return (
      <div className="flex h-[100dvh] flex-col bg-white">
         <AuthHeader />
         <main className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
            {children}
         </main>
         <AuthFooter />
      </div>
   );
};

export default AuthLayout;
