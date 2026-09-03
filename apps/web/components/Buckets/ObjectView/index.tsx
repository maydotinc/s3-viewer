import BucketUnavailable from "@/components/Buckets/unavailable";
import SignInPrompt from "@/components/Session/sign-in-prompt";
import useObjectMetadata from "@/lib/hooks/queries/s3/useObjectMetadata";
import useObjectPreview from "@/lib/hooks/queries/s3/useObjectPreview";
import { authClient } from "@/lib/auth";
import { baseName } from "@s3-viewer/types";
import { useBucketContext } from "../Context";
import ObjectDetails from "./details";
import ObjectHeader from "./header";
import { LazyPreview } from "./lazy-preview";

const ObjectView = () => {
   const { data: session, isPending } = authClient.useSession();
   const { bucketName, path, notFound } = useBucketContext();
   const objectKey = path.join("/");

   const metadata = useObjectMetadata(bucketName, objectKey);
   const preview = useObjectPreview(bucketName, objectKey);

   if (!session && !isPending)
      return <SignInPrompt>Sign in to view this object.</SignInPrompt>;

   if (notFound) return <BucketUnavailable bucketName={bucketName} />;

   return (
      <section className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden p-6">
         <ObjectHeader
            bucketName={bucketName}
            objectKey={objectKey}
            path={path}
         />
         <div className="flex min-h-0 flex-1 gap-6 max-lg:flex-col max-lg:overflow-y-auto">
            <ObjectDetails
               metadata={metadata.data}
               isLoading={metadata.isPending}
               error={metadata.error}
            />
            <LazyPreview
               preview={preview.data}
               isLoading={preview.isPending}
               isError={preview.isError}
               objectKey={objectKey}
               fileName={baseName(objectKey)}
            />
         </div>
      </section>
   );
};

export default ObjectView;
