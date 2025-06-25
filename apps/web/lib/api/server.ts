import { Role, ServerCredentials, ServerInfo, ServerUser } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";

const fetchServersAPI = async (): Promise<ServerInfo[]> => {
   try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/retrieve/get-servers`, {
         credentials: "include",
         headers: {
            "Content-Type": "application/json",
         },
      });

      if (!response.ok) {
         return [];
      }

      const data = await response.json();
      return data.serversList as ServerInfo[];
   } catch (error: any) {
      console.error("Error fetching servers:", error);
      return [];
   }
};

const fetchServerUsersAPI = async (serverId: string) => {
   try {
      const response = await fetch(
         `${process.env.NEXT_PUBLIC_API_URL}/retrieve/get-server-users?serverId=${serverId}`,
         {
            credentials: "include",
            headers: {
               "Content-Type": "application/json",
            },
         }
      );

      if (!response.ok) {
         return [];
      }

      const data = await response.json();
      return data.serverUsers as ServerUser[];
   } catch (error: any) {
      console.error("Error fetching server users:", error);
      return [];
   }
};

const establishConnectionAPI = async (credentials: ServerCredentials) => {
   try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/manage/establish`, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify(credentials),
      });
      if (!response.ok) {
         toast.error("Failed to establish connection");
         return { success: false, error: (await response.json()).message };
      }
      const data = await response.json();
      return { success: true, message: data.message, bucketCount: data.bucketCount };
   } catch (error: any) {
      console.error("Error establishing connection:", error);
      return { success: false, error: error.message };
   }
};

const createServerAPI = async (serverCredentials: ServerCredentials, serverName: string) => {
   try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/manage/create`, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverCredentials, serverName }),
      });
      if (!response.ok) {
         toast.error("Failed to create server");
         return { success: false, error: (await response.json()).message };
      }
      toast.success("Server connected successfully");
      const data = await response.json();
      return {
         success: true,
         message: data.message,
         serverId: data.serverId,
      };
   } catch (error: any) {
      console.error("Error connecting server:", error);
      return { success: false, error: error.message };
   }
};

const deleteServerAPI = async (serverId: string) => {
   try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/manage/delete`, {
         method: "DELETE",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverId }),
      });
      if (!response.ok) {
         toast.error("Failed to delete server");
         return { success: false, error: (await response.json()).message };
      }
      toast.success("Server deleted successfully");
      return { success: true, message: (await response.json()).message };
   } catch (error: any) {
      console.error("Error deleting server:", error);
      return { success: false, error: error.message };
   }
};

const renameServerAPI = async (serverId: string, serverName: string) => {
   try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/manage/rename`, {
         method: "PUT",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverId, serverName }),
      });
      if (!response.ok) {
         toast.error("Failed to rename server");
         return { success: false, error: (await response.json()).message };
      }
      toast.success("Server renamed successfully");
      return { success: true, message: (await response.json()).message };
   } catch (error: any) {
      console.error("Error renaming server:", error);
      return { success: false, error: error.message };
   }
};

const sendInvitationAPI = async (
   serverId: string,
   emails: string[],
   role: Role,
   expiresAt: Date
) => {
   try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/manage/invites/send`, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverId, emails, role, expiresAt }),
      });
      if (!response.ok) {
         toast.error("Failed to send invitation");
         const { message } = await response.json();
         return { success: false, error: message };
      }
      toast.success("Invitation sent successfully");
      return { success: true, message: (await response.json()).message };
   } catch (error: any) {
      console.error("Error sending invitation:", error);
      return { success: false, error: error.message };
   }
};

export {
   createServerAPI,
   deleteServerAPI,
   establishConnectionAPI,
   fetchServersAPI,
   fetchServerUsersAPI,
   renameServerAPI,
   sendInvitationAPI,
};
