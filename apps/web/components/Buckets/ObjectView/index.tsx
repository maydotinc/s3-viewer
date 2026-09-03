import BucketUnavailable from "@/components/Buckets/unavailable";
import { Page } from "@/components/Layout/page";
import SignInPrompt from "@/components/Session/sign-in-prompt";
import { authClient } from "@/lib/auth";
import useObjectMetadata from "@/lib/hooks/queries/s3/useObjectMetadata";
import useObjectPreview from "@/lib/hooks/queries/s3/useObjectPreview";
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
      <Page>
         <ObjectHeader
            bucketName={bucketName}
            objectKey={objectKey}
            path={path}
         />
         <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
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
      </Page>
   );
};

export default ObjectView;
