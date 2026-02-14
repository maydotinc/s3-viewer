import { createContext, ReactNode, useContext, useState } from "react";
import useSessionStore from "@/lib/stores/sessionStore";
import { BucketAccessEntry, Role } from "@s3-viewer/types";

type ShareContextType = {
   serverId: string;
   emails: string;
   setEmails: (emails: string) => void;
   selectedRole: Role;
   setSelectedRole: (role: Role) => void;
   invalidEmails: string[];
   setInvalidEmails: (emails: string[]) => void;
   bucketAccessList: BucketAccessEntry[];
   setBucketAccessList: (list: BucketAccessEntry[]) => void;
   selectAllBuckets: boolean;
   onClose: () => void;
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
   selectAllBuckets?: boolean;
   onClose: () => void;
};

export const ShareProvider = ({
   children,
   serverId,
   selectAllBuckets = false,
   onClose,
}: ShareProviderProps) => {
   const currServerId = useSessionStore((state) => state.serverId);
   const [emails, setEmails] = useState("");
   const [selectedRole, setSelectedRole] = useState<Role>(Role.VIEWER);
   const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
   const [bucketAccessList, setBucketAccessList] = useState<
      BucketAccessEntry[]
   >([]);

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
            bucketAccessList,
            setBucketAccessList,
            selectAllBuckets,
            onClose,
         }}
      >
         {children}
      </ShareContext.Provider>
   );
};
