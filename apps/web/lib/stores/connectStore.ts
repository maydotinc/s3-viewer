import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type AWSRegion =
   | "auto"
   | "us-east-1"
   | "us-east-2"
   | "us-west-1"
   | "us-west-2"
   | "af-south-1"
   | "ap-east-1"
   | "ap-south-1"
   | "ap-northeast-1"
   | "ap-northeast-2"
   | "ap-northeast-3"
   | "ap-southeast-1"
   | "ap-southeast-2"
   | "ap-southeast-3"
   | "ca-central-1"
   | "eu-central-1"
   | "eu-west-1"
   | "eu-west-2"
   | "eu-west-3"
   | "eu-north-1"
   | "eu-south-1"
   | "me-south-1"
   | "sa-east-1";

type ConnectState = {
   endpoint: string;
   serverName: string;
   region: AWSRegion;
   accessKey: string;
   secretKey: string;
   searching: boolean;
   error: string | null;
   serverFound: boolean;
   bucketCount: number;
   listBucketsAllowed: boolean;
   manualBucketNames: string;
};

type ConnectActions = {
   setEndpoint: (endpoint: string) => void;
   setServerName: (serverName: string) => void;
   setRegion: (region: AWSRegion) => void;
   setAccessKey: (accessKey: string) => void;
   setSecretKey: (secretKey: string) => void;
   setSearching: (searching: boolean) => void;
   setError: (error: string | null) => void;
   setServerFound: (serverFound: boolean) => void;
   setBucketCount: (bucketCount: number) => void;
   setListBucketsAllowed: (allowed: boolean) => void;
   setManualBucketNames: (names: string) => void;
   reset: () => void;
};

type ConnectStore = ConnectState & ConnectActions;

const useConnectStore = create<ConnectStore>()(
   immer((set) => ({
      endpoint: "",
      serverName: "",
      region: "us-east-1",
      accessKey: "",
      secretKey: "",
      searching: false,
      error: null,
      serverFound: false,
      bucketCount: 0,
      listBucketsAllowed: true,
      manualBucketNames: "",
      setEndpoint: (endpoint) => set({ endpoint }),
      setServerName: (serverName) => set({ serverName }),
      setRegion: (region) => set({ region }),
      setAccessKey: (accessKey) => set({ accessKey }),
      setSecretKey: (secretKey) => set({ secretKey }),
      setSearching: (searching) => set({ searching }),
      setError: (error) => set({ error }),
      setServerFound: (serverFound) => set({ serverFound }),
      setBucketCount: (bucketCount) => set({ bucketCount }),
      setListBucketsAllowed: (allowed) => set({ listBucketsAllowed: allowed }),
      setManualBucketNames: (names) => set({ manualBucketNames: names }),
      reset: () =>
         set({
            endpoint: "",
            serverName: "",
            region: "us-east-1",
            accessKey: "",
            secretKey: "",
            searching: false,
            error: null,
            serverFound: false,
            bucketCount: 0,
            listBucketsAllowed: true,
            manualBucketNames: "",
         }),
   }))
);

export default useConnectStore;
