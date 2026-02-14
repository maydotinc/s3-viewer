import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { S3Bucket } from "@s3-viewer/types";
import { createContext, useContext } from "react";

type BucketContextType = {
   bucket: S3Bucket | null;
   path: string[];
   isLoading: boolean;
   notFound: boolean;
};

const BucketContext = createContext<BucketContextType | null>(null);

type BucketProviderProps = {
   bucketName: string;
   path: string[];
   children: React.ReactNode;
};

const BucketProvider = ({
   bucketName,
   path,
   children,
}: BucketProviderProps) => {
   const { currentBucket, isBucketsLoading } = useBuckets(
      undefined,
      bucketName
   );
   const notFound = !isBucketsLoading && !!bucketName && !currentBucket;

   return (
      <BucketContext.Provider
         value={{
            bucket: currentBucket ?? null,
            path,
            isLoading: isBucketsLoading,
            notFound,
         }}
      >
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
