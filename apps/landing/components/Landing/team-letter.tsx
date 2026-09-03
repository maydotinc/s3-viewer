import Image from "next/image";
import BasicBlock from "../basic-block";

const TEAM = [
   { profile: "mike", name: "Michael Papadopoulos" },
   { profile: "vinit", name: "Vinit Ghelani" },
   { profile: "aleem", name: "Aleem Rehmtulla" },
   { profile: "noah", name: "Noah Gomes" },
];

const TeamLetter = () => {
   return (
      <BasicBlock className="px-50 py-28">
         <div className="flex flex-1 items-center justify-center border-4 border-viewerblue/10 md:p-4 p-1 relative rounded-sm">
            <div className="absolute bottom-0 left-0 size-2 bg-viewerwhite -translate-x-1/2 translate-y-1/2" />
            <div className="absolute top-0 right-0 size-2 bg-viewerwhite translate-x-1/2 -translate-y-1/2" />
            <div className="flex flex-col size-full bg-viewergray border border-viewerborder p-6 gap-4 relative">
               <div className="absolute bottom-0 right-0 md:translate-x-1/2 md:translate-y-1/2 max-md:size-25 max-xl:size-30 select-none">
                  <Image
                     src="/landing/builtbymay.svg"
                     alt=""
                     width={150}
                     height={150}
                     draggable={false}
                  />
               </div>
               <span className="text-xs text-viewertext">A LETTER</span>
               <h2 className="text-3xl text-viewerblue font-semibold">
                  From the team
               </h2>
               <p className="text-base text-viewertext md:max-w-1/2">
                  We built S3 Viewer because we were tired of being locked into
                  provider-specific interfaces. AWS won&apos;t let you view your
                  R2 buckets. Cloudflare won&apos;t show your S3 data. And other
                  providers keep your data siloed in their own dashboards. We
                  wanted one viewer that works everywhere - a single interface
                  for all your object storage, regardless of where it lives.
               </p>
               <div className="h-[1px] w-1/2 bg-viewerborder my-2 max-md:hidden" />
               <span className="text-base text-viewertext md:max-w-1/2">
                  Our mission is to make object storage as accessible, fast and
                  simple as your local file system, regardless of your technical
                  background.
               </span>
               <div className="md:absolute md:top-0 max-md:size-10 md:right-0 md:-translate-x-1/2 md:translate-y-1/2 select-none">
                  <Image
                     src="/landing/viewercubegray.svg"
                     alt=""
                     width={63}
                     height={78}
                     draggable={false}
                     className="select-none"
                  />
               </div>
               <div className="flex flex-col gap-2 mt-5">
                  <div className="flex items-center -space-x-2">
                     {TEAM.map((member, i) => (
                        <Image
                           key={member.profile}
                           src={`/landing/profiles/${member.profile}.png`}
                           alt={member.name}
                           width={40}
                           height={40}
                           style={{
                              zIndex: 10 - i,
                           }}
                           className="border border-viewerwhite rounded-full select-none"
                           quality={100}
                           draggable={false}
                        />
                     ))}
                  </div>
                  <h3 className="text-base leading-none font-semibold text-viewerblack">
                     S3 Viewer
                  </h3>
                  <span className="text-xs leading-none text-viewertext">
                     Mike, Vinit, Aleem, Noah
                  </span>
               </div>
            </div>
         </div>
      </BasicBlock>
   );
};

export default TeamLetter;
