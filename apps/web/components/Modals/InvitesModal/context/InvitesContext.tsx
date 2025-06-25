import { createContext, ReactNode, useContext, useState } from "react";

type InviteData = {
   id: string;
   email: string;
   role: string;
   expiresAt: string;
   accepted: boolean;
   createdAt: string;
   server: {
      id: string;
      name: string;
   };
   invitedBy?: {
      id: string;
      name: string;
      email: string;
   };
};

type InvitesContextType = {
   activeTab: "received" | "sent";
   setActiveTab: (tab: "received" | "sent") => void;
   receivedInvites: InviteData[];
   setReceivedInvites: (invites: InviteData[]) => void;
   sentInvites: InviteData[];
   setSentInvites: (invites: InviteData[]) => void;
   isLoading: boolean;
   setIsLoading: (loading: boolean) => void;
   onClose: () => void;
   acceptInvite: (inviteId: string) => Promise<void>;
   revokeInvite: (inviteId: string) => Promise<void>;
   refreshInvites: () => Promise<void>;
};

const InvitesContext = createContext<InvitesContextType | undefined>(undefined);

export const useInvitesContext = () => {
   const context = useContext(InvitesContext);
   if (!context) {
      throw new Error("useInvitesContext must be used within an InvitesProvider");
   }
   return context;
};

type InvitesProviderProps = {
   children: ReactNode;
   onClose: () => void;
};

export const InvitesProvider = ({ children, onClose }: InvitesProviderProps) => {
   const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
   const [receivedInvites, setReceivedInvites] = useState<InviteData[]>([]);
   const [sentInvites, setSentInvites] = useState<InviteData[]>([]);
   const [isLoading, setIsLoading] = useState(false);

   const acceptInvite = async (inviteId: string) => {
      setIsLoading(true);
      try {
         const response = await fetch(`/api/manage/invites/accept`, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ inviteId }),
         });

         if (!response.ok) {
            throw new Error("Failed to accept invite");
         }

         // Remove the accepted invite from the received invites list
         setReceivedInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      } catch (error) {
         console.error("Error accepting invite:", error);
         throw error;
      } finally {
         setIsLoading(false);
      }
   };

   const revokeInvite = async (inviteId: string) => {
      setIsLoading(true);
      try {
         const response = await fetch(`/api/manage/invites/revoke`, {
            method: "DELETE",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ inviteId }),
         });

         if (!response.ok) {
            throw new Error("Failed to revoke invite");
         }

         // Remove the revoked invite from the sent invites list
         setSentInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      } catch (error) {
         console.error("Error revoking invite:", error);
         throw error;
      } finally {
         setIsLoading(false);
      }
   };

   const refreshInvites = async () => {
      setIsLoading(true);
      try {
         // Fetch received invites
         const receivedResponse = await fetch("/api/manage/invites/received");
         if (receivedResponse.ok) {
            const receivedData = await receivedResponse.json();
            setReceivedInvites(receivedData.invites || []);
         }

         // Fetch sent invites
         const sentResponse = await fetch("/api/manage/invites/sent");
         if (sentResponse.ok) {
            const sentData = await sentResponse.json();
            setSentInvites(sentData.invites || []);
         }
      } catch (error) {
         console.error("Error fetching invites:", error);
      } finally {
         setIsLoading(false);
      }
   };

   return (
      <InvitesContext.Provider
         value={{
            activeTab,
            setActiveTab,
            receivedInvites,
            setReceivedInvites,
            sentInvites,
            setSentInvites,
            isLoading,
            setIsLoading,
            onClose,
            acceptInvite,
            revokeInvite,
            refreshInvites,
         }}
      >
         {children}
      </InvitesContext.Provider>
   );
};
