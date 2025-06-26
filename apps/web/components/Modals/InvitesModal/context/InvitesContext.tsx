import { createContext, ReactNode, useContext, useState } from "react";

type InvitesContextType = {
   activeTab: "received" | "sent";
   setActiveTab: (tab: "received" | "sent") => void;
   onClose: () => void;
};

const InvitesContext = createContext<InvitesContextType | undefined>(undefined);

export const useInvitesContext = () => {
   const context = useContext(InvitesContext);
   if (!context) {
      throw new Error(
         "useInvitesContext must be used within an InvitesProvider"
      );
   }
   return context;
};

type InvitesProviderProps = {
   children: ReactNode;
   onClose: () => void;
};

export const InvitesProvider = ({
   children,
   onClose,
}: InvitesProviderProps) => {
   const [activeTab, setActiveTab] = useState<"received" | "sent">("received");

   return (
      <InvitesContext.Provider
         value={{
            activeTab,
            setActiveTab,
            onClose,
         }}
      >
         {children}
      </InvitesContext.Provider>
   );
};
