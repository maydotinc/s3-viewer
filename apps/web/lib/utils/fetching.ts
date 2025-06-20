import { ServerInfo } from "@s3-viewer/types";
import useSessionStore from "../stores/sessionStore";
import { Bucket, BucketFolder } from "./types";

const fetchFolders = async () => {
   try {
      const serverId = useSessionStore.getState().serverId;
      const response = await fetch(
         `${process.env.NEXT_PUBLIC_API_URL}/bucket/list?serverId=${serverId}`
      );
      const data = await response.json();
      if (!response.ok) {
         return [];
      }
      const folders: BucketFolder[] = data.map((bucket: Bucket) => ({
         Name: bucket.Name,
         CreationDate: bucket.CreationDate,
         Files: 0,
         Folders: 0,
         TotalSize: 0,
      }));
      return folders;
   } catch (error: any) {
      console.error("Error fetching folders:", error);
      return [];
   }
};

const fetchObjects = async (bucketName: string) => {
   try {
      const response = await fetch(
         `${process.env.NEXT_PUBLIC_API_URL}/api/object/list?bucketName=${bucketName}`
      );
      const data = await response.json();

      if (!response.ok || !data.objects) {
         console.log("No objects found in response");
         return [];
      }

      // Map the objects to just their keys
      return data.objects.map((object: { key: string }) => object.key);
   } catch (error: any) {
      console.error("Error fetching objects:", error);
      return [];
   }
};

const fetchServers = async () => {
   try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/retrieve/get-servers`, {
         credentials: "include",
         headers: {
            "Content-Type": "application/json",
         },
      });

      if (!response.ok) {
         console.error("Failed to fetch servers:", response.statusText);
         return [];
      }

      const data = await response.json();
      return data.serversList as ServerInfo[];
   } catch (error: any) {
      console.error("Error fetching servers:", error);
      return [];
   }
};

export { fetchFolders, fetchObjects, fetchServers };
