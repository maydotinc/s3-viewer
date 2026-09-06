import BasicBlock, { SectionHeading } from "../basic-block";
import { ConnectServerFigure } from "./figures/connect-server";
import { ObjectsBrowserFigure } from "./figures/objects-browser";
import { ServerSwitcherFigure } from "./figures/server-switcher";

const DemoBlock = () => (
   <BasicBlock sectionClassName="border-y border-viewerborder bg-viewergray">
      <SectionHeading
         eyebrow="Product"
         title="An S3 client that works like a file browser"
         description="Navigate your buckets with the familiar file explorer interface you already know — folders, search, drag and drop."
      />

      <div className="mt-10 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite shadow-sm">
         <ObjectsBrowserFigure />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
         <div className="flex flex-col gap-5 rounded-xl border border-viewerborder bg-viewerwhite p-6">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-viewergray">
               <ConnectServerFigure />
            </div>
            <div className="flex flex-col gap-1.5">
               <h3 className="text-lg font-semibold tracking-tight text-viewerblack">
                  Connect a server in one step
               </h3>
               <p className="text-sm text-viewertext">
                  Add any S3-compatible provider from the sidebar — enter the
                  region and endpoint once and your buckets appear.
               </p>
            </div>
         </div>

         <div className="flex flex-col gap-5 rounded-xl border border-viewerborder bg-viewerwhite p-6">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-viewergray">
               <ServerSwitcherFigure />
            </div>
            <div className="flex flex-col gap-1.5">
               <h3 className="text-lg font-semibold tracking-tight text-viewerblack">
                  Switch between servers
               </h3>
               <p className="text-sm text-viewertext">
                  Manage AWS S3, Cloudflare R2, MinIO and more from one sidebar,
                  without changing tabs.
               </p>
            </div>
         </div>
      </div>
   </BasicBlock>
);

export default DemoBlock;
