import BasicBlock, { PageTitle } from "@/components/basic-block";
import PageHero from "@/components/page-hero";
import LinkCard from "@/components/link-card";
import { HOW_TOS, HOW_TO_CATEGORIES } from "./data";

const Hub = () => {
   return (
      <main className="w-full overflow-x-clip">
         <PageHero current="How-to">
            <div className="flex flex-col gap-5 max-w-[760px]">
               <PageTitle>How-to guides for S3.</PageTitle>
               <p className="text-viewertext max-w-[600px]">
                  Direct answers to the questions developers Google about AWS
                  S3, Cloudflare R2, and S3-compatible storage. AWS CLI and SDK
                  snippets included; one-click equivalents in S3 Viewer where
                  they exist.
               </p>
            </div>
         </PageHero>

         <BasicBlock
            sectionClassName="bg-viewergray"
            className="flex flex-col gap-14"
         >
            {HOW_TO_CATEGORIES.map((cat) => {
               const items = HOW_TOS.filter((h) => h.category === cat);
               return (
                  <div key={cat} className="flex flex-col gap-5">
                     <div className="flex items-end justify-between gap-4">
                        <h2 className="text-2xl font-semibold tracking-tight text-viewerblack">
                           {cat}
                        </h2>
                        <span className="text-xs text-viewerlighttext">
                           {items.length} guides
                        </span>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map((h) => (
                           <LinkCard
                              key={h.slug}
                              href={`/how-to/${h.slug}`}
                              title={h.title}
                              description={h.tagline}
                              className="sm:p-6"
                           />
                        ))}
                     </div>
                  </div>
               );
            })}
         </BasicBlock>
      </main>
   );
};

export default Hub;
