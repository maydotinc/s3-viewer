import Image from "next/image";
import BasicBlock, { Eyebrow } from "../basic-block";

const TEAM = [
   { profile: "mike", name: "Michael Papadopoulos" },
   { profile: "vinit", name: "Vinit Ghelani" },
   { profile: "aleem", name: "Aleem Rehmtulla" },
   { profile: "noah", name: "Noah Gomes" },
];

const TeamLetter = () => {
   return (
      <BasicBlock>
         <div className="flex flex-col gap-6 rounded-xl border border-viewerborder bg-viewerwhite p-6 sm:p-10">
            <div className="flex flex-col gap-3">
               <Eyebrow>A letter</Eyebrow>
               <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                  From the team
               </h2>
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

            <div className="flex items-center gap-3 border-t border-viewerborder pt-6">
               <div className="flex items-center -space-x-2">
                  {TEAM.map((member, i) => (
                     <Image
                        key={member.profile}
                        src={`/landing/profiles/${member.profile}.png`}
                        alt={member.name}
                        width={36}
                        height={36}
                        style={{ zIndex: 10 - i }}
                        className="size-9 rounded-full border border-viewerwhite select-none"
                        quality={100}
                        draggable={false}
                     />
                  ))}
               </div>
               <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-viewerblack">
                     S3 Viewer
                  </span>
                  <span className="truncate text-xs text-viewerlighttext">
                     Mike, Vinit, Aleem, Noah
                  </span>
               </div>
            </div>
         </div>
      </BasicBlock>
   );
};

export default TeamLetter;
