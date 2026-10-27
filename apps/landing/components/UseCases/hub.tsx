import BasicBlock, { PageTitle } from "@/components/basic-block";
import PageHero from "@/components/page-hero";
import LinkCard from "@/components/link-card";
import { USE_CASES } from "./data";

const Hub = () => {
   return (
      <main className="w-full overflow-x-clip">
         <PageHero current="Use cases">
            <div className="flex flex-col gap-5 max-w-[760px]">
               <PageTitle>
                  One viewer.
                  <br />
                  Every S3 workflow.
               </PageTitle>
               <p className="text-viewertext max-w-[600px]">
                  S3 Viewer is a developer-first dashboard for AWS S3,
                  Cloudflare R2, MinIO, Backblaze B2, and Wasabi — built to
                  replace the AWS console for the things you do every day. Pick
                  the workflow that matches yours.
               </p>
            </div>
         </PageHero>

         <BasicBlock sectionClassName="bg-viewergray">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {USE_CASES.map((u) => (
                  <LinkCard
                     key={u.slug}
                     href={`/use-cases/${u.slug}`}
                     heading="h2"
                     title={u.title}
                     description={u.tagline}
                     titleClassName="text-xl"
                     className="h-full p-6"
                  />
               ))}
            </div>
         </BasicBlock>
      </main>
   );
};

export default Hub;
