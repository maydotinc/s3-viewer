import { Toaster as SonnerToaster } from "sonner";

const Toaster = () => {
   return (
      <SonnerToaster
         position="bottom-left"
         toastOptions={{
            duration: 3000,
            style: {
               background: "#FFFFFF",
               color: "#525866",
               border: "1px solid #E2E2E2",
            },
         }}
      />
   );
};

export default Toaster;
export { toast } from "sonner";
