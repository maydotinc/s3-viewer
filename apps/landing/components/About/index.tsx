import BasicBlock, {
   Eyebrow,
   PageTitle,
   SectionTitle,
} from "@/components/basic-block";
import { blurProps } from "@/components/blur-placeholder";
import CtaButtons from "@/components/cta-buttons";
import { ExternalLink } from "@/components/external-link";
import { MayPanel } from "@/components/About/may-panel";
import IconCard from "@/components/icon-card";
import PageHero from "@/components/page-hero";
import { CtaBand, HeroGrid } from "@/components/page-sections";
import { SocialLink } from "@/components/social-link";
import { GitHubMark, LinkedInMark, XMark } from "@/components/social-marks";
import { GITHUB_ISSUES_URL } from "@/lib/site-config";
import { team } from "@/lib/team";
import { Button } from "@s3-viewer/ui/components/button";
import { ArrowUpRight, Globe, Heart, Sparkles, Zap } from "lucide-react";
import Image from "next/image";

const values = [
   {
      icon: Zap,
      title: "Speed is a feature.",
      body: "Object storage isn't slow — its dashboards are. We keep the interface thin, cache what we can, and cut anything that gets between you and the file you came for.",
   },
   {
      icon: Heart,
      title: "Open by default.",
      body: "S3 Viewer is MIT-licensed. Self-host it. Fork it. Embed it. Our hosted offering exists so you don't have to — but you can always walk away with the code.",
   },
   {
      icon: Sparkles,
      title: "Plain, not flashy.",
      body: "We don't ship gradients, mascots, or marketing buzzwords. The product looks like the file browser you already know, because that's what makes it disappear.",
   },
];

const About = () => {
   return (
      <main className="w-full overflow-x-clip">
         <PageHero current="About" contentClassName="sm:pt-24 sm:pb-24">
            <HeroGrid className="lg:items-stretch" aside={<MayPanel />}>
               <PageTitle>
                  Object storage was
                  <br />
                  never the problem.
               </PageTitle>
               <p className="text-base sm:text-lg text-viewertext max-w-[620px]">
                  We built S3 Viewer because the dashboards were the problem.
                  AWS won&apos;t let you see your R2 buckets. Cloudflare
                  won&apos;t show your S3 data. Every provider keeps your files
                  locked inside their own UI.
                  <br />
                  <br />
                  S3 Viewer is one fast interface for any S3-compatible bucket —
                  open source, self-hostable, and built to feel like your local
                  file system.
               </p>
               <CtaButtons chevron className="pt-2" />
            </HeroGrid>
         </PageHero>

         <BasicBlock sectionClassName="bg-viewergray">
            <div className="flex flex-col gap-3 mb-10 max-w-[680px]">
               <Eyebrow>What we believe</Eyebrow>
               <SectionTitle>Three rules we don&apos;t break.</SectionTitle>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {values.map((v) => (
                  <IconCard
                     key={v.title}
                     icon={v.icon}
                     title={v.title}
                     titleClassName="text-lg"
                  >
                     {v.body}
                  </IconCard>
               ))}
            </div>
         </BasicBlock>

         <BasicBlock sectionClassName="border-t border-viewerborder">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
               <div className="lg:col-span-5 flex flex-col gap-5">
                  <SectionTitle>Built with love.</SectionTitle>
                  <Button asChild variant="outline" className="w-fit">
                     <ExternalLink href={GITHUB_ISSUES_URL}>
                        <GitHubMark />
                        Open an issue
                     </ExternalLink>
                  </Button>
               </div>
               <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {team.map((member) => (
                     <div
                        key={member.profile}
                        className="flex items-center gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-4"
                     >
                        <div className="flex-none size-16 overflow-hidden rounded-xl bg-viewergray">
                           <Image
                              src={`/landing/profiles/${member.profile}.png`}
                              alt=""
                              width={128}
                              height={128}
                              className="size-full object-cover"
                              draggable={false}
                              {...blurProps(
                                 `/landing/profiles/${member.profile}.png`
                              )}
                           />
                        </div>
                        <div className="flex flex-col gap-2 min-w-0 flex-1">
                           <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold text-viewerblack leading-tight">
                                 {member.name}
                              </span>
                              <span className="text-xs text-viewerlighttext leading-tight">
                                 {member.role}
                              </span>
                           </div>
                           {(member.github ||
                              member.twitter ||
                              member.linkedin ||
                              member.website) && (
                              <div className="flex flex-wrap items-center gap-1.5">
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
                                 <SocialLink
                                    href={member.linkedin}
                                    icon={LinkedInMark}
                                    label={`${member.name} on LinkedIn`}
                                 />
                                 <SocialLink
                                    href={member.website}
                                    icon={Globe}
                                    label={`${member.name}'s website`}
                                 />
                              </div>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </BasicBlock>

         <CtaBand
            sectionClassName="bg-viewergray"
            eyebrow="Get started"
            title="Connect a bucket and start browsing."
            text="Works with AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, and any S3-compatible API."
            chevron
            secondary={{ href: "/use-cases", label: "Explore use cases" }}
            secondaryIcon={<ArrowUpRight />}
         />
      </main>
   );
};

export default About;
