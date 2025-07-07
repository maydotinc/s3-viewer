import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { S3Bucket } from "@s3-viewer/types";
import { createContext, useContext } from "react";

type BucketContextType = {
   bucket: S3Bucket | null;
};

const BucketContext = createContext<BucketContextType | null>(null);

type BucketProviderProps = {
   bucketName: string;
   children: React.ReactNode;
};

const BucketProvider = ({ bucketName, children }: BucketProviderProps) => {
   const { currentBucket } = useBuckets(undefined, bucketName);

   return (
      <BucketContext.Provider value={{ bucket: currentBucket ?? null }}>
         {children}
      </BucketContext.Provider>
   );
};

const useBucketContext = () => {
   const context = useContext(BucketContext);
   if (!context) {
      throw new Error("useBucketContext must be used within a BucketProvider");
   }
   return context;
};

export { BucketContext, BucketProvider, useBucketContext };
