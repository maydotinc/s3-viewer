import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";
import BasicBlock, { SectionHeading } from "../basic-block";
import { ConnectServerFigure } from "./figures/connect-server";
import { FolderAccessFigure } from "./figures/folder-access";
import { ObjectsBrowserFigure } from "./figures/objects-browser";
import { ServerSwitcherFigure } from "./figures/server-switcher";

const DemoCard = ({
   figure,
   title,
   children,
   className,
   figureClassName,
   bodyClassName,
}: {
   figure: ReactNode;
   title: string;
   children: ReactNode;
   className?: string;
   figureClassName?: string;
   bodyClassName?: string;
}) => (
   <div
      className={cn(
         "flex flex-col gap-5 rounded-xl border border-viewerborder bg-viewerwhite p-6",
         className
      )}
   >
      <div
         className={cn(
            "aspect-[4/3] w-full overflow-hidden rounded-lg bg-viewergray",
            figureClassName
         )}
      >
         {figure}
      </div>
      <div className={cn("flex flex-col gap-1.5", bodyClassName)}>
         <h3 className="text-lg font-semibold tracking-tight text-viewerblack">
            {title}
         </h3>
         <p className="text-sm text-viewertext">{children}</p>
      </div>
   </div>
);

const DemoBlock = () => (
   <BasicBlock sectionClassName="border-y border-viewerborder bg-viewergray">
      <SectionHeading
         eyebrow="Product"
         title="An S3 client that works like a file browser"
         description="Navigate your buckets with the familiar file explorer interface you already know — folders, search, drag and drop."
      />

      <div className="2xl:-mx-16">
         <div className="mt-10 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite shadow-sm">
            <ObjectsBrowserFigure />
         </div>

         <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <DemoCard
               figure={<ConnectServerFigure />}
               title="Connect a server in one step"
            >
               Add any S3-compatible provider from the sidebar — enter the
               region and endpoint once and your buckets appear.
            </DemoCard>

            <DemoCard
               figure={<ServerSwitcherFigure />}
               title="Switch between servers"
            >
               Manage AWS S3, Cloudflare R2, MinIO and more from one sidebar,
               without changing tabs.
            </DemoCard>

            <DemoCard
               figure={<FolderAccessFigure />}
               title="Share one folder, not the whole bucket"
               className="md:col-span-2 md:flex-row md:items-center md:gap-8"
               figureClassName="md:w-1/2"
               bodyClassName="md:w-1/2"
            >
               Invite a contractor to <code>landing/</code> and nothing else.
               They can browse, upload, rename and delete inside it, and
               can&apos;t open or even list the rest of the bucket. No IAM
               policy to write, and it works on every provider.
            </DemoCard>
         </div>
      </div>
   </BasicBlock>
);

export default DemoBlock;
