import useUploadFiles from "@/lib/hooks/mutations/object/useUploadFiles";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import useUploadStore from "@/lib/stores/uploadStore";
import { authClient } from "@s3-viewer/auth/client";
import { useRouter } from "next/router";
import { useEffect } from "react";

const SessionManager = () => {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();
   const { servers } = useServers();
   const { serverId, setUserId, setServerId, clearSession } = useSessionStore();
   const uploadMutation = useUploadFiles();
   const { init } = useUploadStore();

   // Initialize the upload store with the mutate function
   useEffect(() => {
      init(uploadMutation.mutate);
   }, [uploadMutation.mutate, init]);

   // Initialize the user id
   useEffect(() => {
      if (isPending) return;

      if (session?.user) {
         setUserId(session.user.id);
      } else {
         clearSession();
      }
   }, [session, isPending, clearSession]);

   // Ensure serverId is always set
   useEffect(() => {
      if (!session?.user) return;

      if (servers.length === 0) {
         if (serverId !== "") {
            setServerId("");
         }
         return;
      }

      const currentServer = servers.find((server) => server.id === serverId);
      if (!serverId || !currentServer) {
         const firstServer = servers[0];
         if (firstServer) {
            setServerId(firstServer.id);
         }
      }
   }, [servers.length]);

   // Redirect to home dashboard whenever serverId changes
   useEffect(() => {
      if (serverId) router.push("/home");
   }, [serverId]);

   return null;
};

export default SessionManager;
