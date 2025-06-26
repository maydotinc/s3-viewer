import {
   Role,
   ServerCredentials,
   ServerInfo,
   ServerInvite,
   ServerUser,
} from "@s3-viewer/types";
import { QueryFunctionContext } from "@tanstack/react-query";

// ============ FETCH FUNCTIONS (for useQuery) ============ //
const fetchServers = async ({
   signal,
}: QueryFunctionContext): Promise<ServerInfo[]> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/retrieve/get-servers`,
      {
         credentials: "include",
         headers: {
            "Content-Type": "application/json",
         },
         signal,
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(
         message ?? `Failed to fetch servers (${response.status})`
      );
   }

   const { serversList } = (await response.json()) as {
      serversList: ServerInfo[];
   };
   return serversList;
};

const fetchServerUsers = async ({
   queryKey,
   signal,
}: QueryFunctionContext<[string, string]>): Promise<ServerUser[]> => {
   const [, serverId] = queryKey;

   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/retrieve/get-server-users?serverId=${serverId}`,
      {
         credentials: "include",
         headers: {
            "Content-Type": "application/json",
         },
         signal,
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(
         message ?? `Failed to fetch server users (${response.status})`
      );
   }

   const { serverUsers } = (await response.json()) as {
      serverUsers: ServerUser[];
   };
   return serverUsers;
};

const fetchSentInvites = async ({
   signal,
}: QueryFunctionContext): Promise<ServerInvite[]> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/invites/sent`,
      {
         credentials: "include",
         headers: {
            "Content-Type": "application/json",
         },
         signal,
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(
         message ?? `Failed to fetch sent invitations (${response.status})`
      );
   }

   const { sentInvites } = (await response.json()) as {
      sentInvites: ServerInvite[];
   };
   return sentInvites;
};

const fetchReceivedInvites = async ({
   signal,
}: QueryFunctionContext): Promise<ServerInvite[]> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/invites/received`,
      {
         credentials: "include",
         headers: {
            "Content-Type": "application/json",
         },
         signal,
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(
         message ?? `Failed to fetch received invitations (${response.status})`
      );
   }

   const { receivedInvites } = (await response.json()) as {
      receivedInvites: ServerInvite[];
   };
   return receivedInvites;
};

// ============ MUTATION FUNCTIONS (for useMutation - THROW ON ERROR) ============ //
const createServer = async (
   serverCredentials: ServerCredentials,
   serverName: string
): Promise<{ message: string; serverId: string }> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/create`,
      {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverCredentials, serverName }),
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(message ?? "Failed to create server");
   }

   const data = await response.json();
   return { message: data.message, serverId: data.serverId };
};

const deleteServer = async (serverId: string): Promise<{ message: string }> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/delete`,
      {
         method: "DELETE",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverId }),
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(message ?? "Failed to delete server");
   }

   const data = await response.json();
   return { message: data.message };
};

const renameServer = async (
   serverId: string,
   serverName: string
): Promise<{ message: string }> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/rename`,
      {
         method: "PUT",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverId, serverName }),
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(message ?? "Failed to rename server");
   }

   const data = await response.json();
   return { message: data.message };
};

const establishConnection = async (
   credentials: ServerCredentials
): Promise<{ message: string; bucketCount: number }> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/establish`,
      {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify(credentials),
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(message ?? "Failed to establish connection");
   }

   const data = await response.json();
   return { message: data.message, bucketCount: data.bucketCount };
};

const sendInvite = async (
   serverId: string,
   emails: string[],
   role: Role,
   expiresAt: string
): Promise<{ message: string }> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/invites/send`,
      {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ serverId, emails, role, expiresAt }),
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(message ?? "Failed to send invitation");
   }

   const data = await response.json();
   return { message: data.message };
};

const acceptInvite = async (inviteId: string): Promise<{ message: string }> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/invites/accept`,
      {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ inviteId }),
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(message ?? "Failed to accept invitation");
   }

   const data = await response.json();
   return { message: data.message };
};

const revokeInvite = async (inviteId: string): Promise<{ message: string }> => {
   const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/manage/invites/revoke`,
      {
         method: "DELETE",
         headers: {
            "Content-Type": "application/json",
         },
         credentials: "include",
         body: JSON.stringify({ inviteId }),
      }
   );

   if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      throw new Error(message ?? "Failed to revoke invitation");
   }

   const data = await response.json();
   return { message: data.message };
};

export {
   acceptInvite,
   createServer,
   deleteServer,
   establishConnection,
   fetchReceivedInvites,
   fetchSentInvites,
   fetchServers,
   fetchServerUsers,
   renameServer,
   revokeInvite,
   sendInvite,
};
