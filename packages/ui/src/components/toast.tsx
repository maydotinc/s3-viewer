import { Toaster as SonnerToaster } from "sonner";

const Toaster = () => {
   return (
      <SonnerToaster
         position="bottom-left"
         toastOptions={{
            style: {
               background: "#FFFFFF",
               color: "#545454",
               border: "1px solid #E2E2E2",
            },
            className: "font-medium",
         }}
      />
   );
};

export default Toaster;
export { toast } from "sonner";
