import useSessionStore from "@/lib/stores/sessionStore";
import { Role } from "@s3-viewer/types";
import { createContext, ReactNode, useContext, useState } from "react";

type ShareContextType = {
   serverId: string;
   emails: string;
   setEmails: (emails: string) => void;
   selectedRole: Role;
   setSelectedRole: (role: Role) => void;
   invalidEmails: string[];
   setInvalidEmails: (emails: string[]) => void;
   isLoading: boolean;
   setIsLoading: (loading: boolean) => void;
   error: string | null;
   setError: (error: string | null) => void;
};

const ShareContext = createContext<ShareContextType | undefined>(undefined);

export const useShareContext = () => {
   const context = useContext(ShareContext);
   if (!context) {
      throw new Error("useShareContext must be used within a ShareProvider");
   }
   return context;
};

type ShareProviderProps = {
   children: ReactNode;
   serverId?: string;
};

export const ShareProvider = ({ children, serverId }: ShareProviderProps) => {
   const currServerId = useSessionStore((state) => state.serverId);
   const [emails, setEmails] = useState("");
   const [selectedRole, setSelectedRole] = useState<Role>(Role.VIEWER);
   const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   return (
      <ShareContext.Provider
         value={{
            serverId: serverId || currServerId,
            emails,
            setEmails,
            selectedRole,
            setSelectedRole,
            invalidEmails,
            setInvalidEmails,
            isLoading,
            setIsLoading,
            error,
            setError,
         }}
      >
         {children}
      </ShareContext.Provider>
   );
};
