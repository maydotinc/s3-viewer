import { blurProps } from "@/components/blur-placeholder";
import { MAY_NAME } from "@/lib/site-config";
import { team } from "@/lib/team";
import Image from "next/image";
import BasicBlock, { Eyebrow, SectionTitle } from "../basic-block";

const TeamLetter = () => {
   return (
      <BasicBlock>
         <div className="flex flex-col gap-6 rounded-xl border border-viewerborder bg-viewerwhite p-6 sm:p-10">
            <div className="flex flex-col gap-3">
               <Eyebrow>A letter</Eyebrow>
               <SectionTitle>From the team</SectionTitle>
            </div>

            <div className="flex max-w-2xl flex-col gap-4 text-viewertext">
               <p>
                  We built S3 Viewer because we were tired of being locked into
                  provider-specific interfaces. AWS won&apos;t let you view your
                  R2 buckets. Cloudflare won&apos;t show your S3 data. And other
                  providers keep your data siloed in their own dashboards. We
                  wanted one viewer that works everywhere — a single interface
                  for all your object storage, regardless of where it lives.
               </p>
               <p>
                  Our mission is to make object storage as accessible, fast and
                  simple as your local file system, regardless of your technical
                  background.
               </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-viewerborder pt-6">
               <div className="flex shrink-0 items-center -space-x-2">
                  {team.map((member, i) => {
                     const src = `/landing/profiles/${member.profile}.png`;
                     return (
                        <Image
                           key={member.profile}
                           src={src}
                           alt={member.name}
                           width={36}
                           height={36}
                           style={{ zIndex: 10 - i }}
                           className="size-9 shrink-0 rounded-full border border-viewerwhite select-none"
                           {...blurProps(src)}
                           draggable={false}
                        />
                     );
                  })}
               </div>
               <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-viewerblack">
                     The S3 Viewer team at {MAY_NAME}
                  </span>
                  <span className="text-xs text-viewerlighttext">
                     {team.map((member) => member.shortName).join(", ")}
                  </span>
               </div>
            </div>
         </div>
      </BasicBlock>
   );
};

export default TeamLetter;
