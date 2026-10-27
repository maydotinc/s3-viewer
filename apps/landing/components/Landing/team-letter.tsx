import { blurProps } from "@/components/blur-placeholder";
import { SocialLink } from "@/components/social-link";
import { GitHubMark, XMark } from "@/components/social-marks";
import { team } from "@/lib/team";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import BasicBlock, { Eyebrow, SectionTitle } from "../basic-block";

// the letter explains why the product exists and the list credits who built it.
// on wide screens the rows share out the letter's height so both columns end together.
const TeamLetter = () => {
   return (
      <BasicBlock>
         <div className="grid grid-cols-1 gap-8 rounded-xl border border-viewerborder bg-viewerwhite p-6 sm:p-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-x-12">
            <div className="flex flex-col gap-6">
               <div className="flex flex-col gap-3">
                  <Eyebrow>From the team</Eyebrow>
                  <SectionTitle className="text-balance">
                     Why we built S3 Viewer
                  </SectionTitle>
               </div>
               <div className="flex flex-col gap-4 text-viewertext lg:text-lg lg:leading-7">
                  <p>
                     We were tired of being locked into provider-specific
                     interfaces. AWS won&apos;t let you view your R2 buckets.
                     Cloudflare won&apos;t show your S3 data. And other
                     providers keep your data siloed in their own dashboards. We
                     wanted one viewer that works everywhere — a single
                     interface for all your object storage, regardless of where
                     it lives.
                  </p>
                  <p>
                     Our mission is to make object storage as accessible, fast
                     and simple as your local file system, whatever your
                     technical background.
                  </p>
               </div>
               <Link
                  href="/about"
                  className="inline-flex w-fit items-center gap-1 text-sm font-medium text-viewerblue hover:underline"
               >
                  More about S3 Viewer
                  <ArrowUpRight className="size-3.5" />
               </Link>
            </div>

            <div className="flex flex-col gap-3">
               <Eyebrow>Built by</Eyebrow>
               <ul className="flex flex-1 flex-col divide-y divide-viewerborder">
                  {team.map((member) => (
                     <li
                        key={member.profile}
                        className="flex flex-1 items-center gap-3 py-3 first:pt-0 last:pb-0"
                     >
                        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-viewergray sm:size-12">
                           <Image
                              src={`/landing/profiles/${member.profile}.png`}
                              alt=""
                              width={96}
                              height={96}
                              className="size-full object-cover"
                              draggable={false}
                              {...blurProps(
                                 `/landing/profiles/${member.profile}.png`
                              )}
                           />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                           <span className="text-sm font-semibold text-viewerblack sm:truncate">
                              {member.name}
                           </span>
                           <span className="truncate text-xs text-viewerlighttext">
                              {member.role}
                           </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                           <SocialLink
                              href={member.github}
                              icon={GitHubMark}
                              label={`${member.name} on GitHub`}
                           />
                           <SocialLink
                              href={member.twitter}
                              icon={XMark}
                              label={`${member.name} on X`}
                           />
                        </div>
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      </BasicBlock>
   );
};

export default TeamLetter;
