import { Button } from "@s3-viewer/ui/components/button";
import {
   ArrowUpRight,
   ChevronRight,
   Globe,
   Heart,
   Linkedin,
   Sparkles,
   Twitter,
   Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const values = [
   {
      icon: Zap,
      title: "Speed is a feature.",
      body: "Object stores are slow because their dashboards are slow. We measure every interaction in milliseconds and ship aggressive caching so the viewer feels local even when your bucket isn't.",
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

type TeamMember = {
   name: string;
   role: string;
   profile: string;
   github?: string;
   twitter?: string;
   linkedin?: string;
};

const team: TeamMember[] = [
   {
      name: "Mike",
      role: "Engineering",
      profile: "mike",
      github: "",
      twitter: "",
      linkedin: "",
   },
   {
      name: "Vinit",
      role: "Design",
      profile: "vinit",
      github: "",
      twitter: "",
      linkedin: "",
   },
   {
      name: "Aleem",
      role: "Engineering",
      profile: "aleem",
      github: "",
      twitter: "",
      linkedin: "",
   },
   {
      name: "Noah",
      role: "Engineering",
      profile: "noah",
      github: "",
      twitter: "",
      linkedin: "",
   },
];

const SocialLink = ({
   href,
   icon: Icon,
   label,
}: {
   href?: string;
   icon: React.ComponentType<{ className?: string }>;
   label: string;
}) => {
   if (!href) return null;
   return (
      <Link
         href={href}
         target="_blank"
         rel="noreferrer"
         aria-label={label}
         className="grid place-items-center size-7 rounded-md border border-viewerborder bg-viewerwhite text-viewertext transition-colors hover:bg-viewerblack hover:text-viewerwhite hover:border-viewerblack"
      >
         <Icon className="size-3.5" />
      </Link>
   );
};

const About = () => {
   return (
      <main className="w-full overflow-x-clip">
         <section className="border-b border-viewerborder bg-viewergray">
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-18 lg:pt-20 pb-14 md:pb-20">
               <nav
                  aria-label="Breadcrumb"
                  className="flex items-center gap-1.5 text-[12px] text-viewerlighttext mb-6"
               >
                  <Link
                     href="/"
                     className="transition-colors hover:text-viewerblack"
                  >
                     Home
                  </Link>
                  <ChevronRight
                     className="size-3"
                     strokeWidth={2.5}
                     aria-hidden
                  />
                  <span className="font-medium text-viewerblack">About</span>
               </nav>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
                  <div className="lg:col-span-7 flex flex-col gap-6 motion-fade-up">
                     <h1 className="text-[40px] sm:text-[56px] lg:text-[68px] font-semibold tracking-[-0.02em] leading-[1.02] text-viewerblack">
                        Object storage was
                        <br />
                        never the problem.
                     </h1>
                     <p className="text-[17px] sm:text-[18px] text-viewertext leading-[1.6] max-w-[620px]">
                        We built S3 Viewer because the dashboards were. AWS
                        won&apos;t let you see your R2 buckets. Cloudflare
                        won&apos;t show your S3 data. Every provider keeps
                        your files locked inside their own UI.
                        <br />
                        <br />
                        S3 Viewer is one fast interface for any S3-compatible
                        bucket — open source, self-hostable, and built to
                        feel like your local file system.
                     </p>
                     <div className="flex flex-wrap gap-3 pt-2">
                        <Button
                           variant="secondary"
                           size="lg"
                           className="h-12"
                           asChild
                        >
                           <Link href="/dashboard">
                              Open Viewer
                              <ChevronRight className="size-4" />
                           </Link>
                        </Button>
                        <Button
                           variant="outline"
                           size="lg"
                           className="h-12 !bg-viewerwhite"
                           asChild
                        >
                           <Link
                              href="https://github.com/maydotinc/s3-viewer"
                              target="_blank"
                              rel="noreferrer"
                           >
                              <FaGithub className="size-4" />
                              Star on GitHub
                           </Link>
                        </Button>
                     </div>
                  </div>

                  <div className="lg:col-span-5 motion-fade-up motion-delay-150">
                     <div className="relative rounded-2xl border border-viewerborder bg-viewerwhite p-6 sm:p-7">
                        <div className="absolute -top-3 left-6 inline-flex items-center gap-2 rounded-full border border-viewerborder bg-viewerwhite px-3 py-1 text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewertext">
                           Built by
                        </div>
                        <div className="flex items-start gap-4">
                           <Image
                              src="https://cdn-may.com/assets/may-square-512x512.png"
                              alt="May Inc."
                              width={56}
                              height={56}
                              className="rounded-xl"
                              draggable={false}
                              unoptimized
                           />
                           <div className="flex flex-col gap-1.5">
                              <h2 className="text-[22px] font-semibold text-viewerblack">
                                 May Inc
                              </h2>
                              <p className="text-[14px] text-viewertext leading-relaxed">
                                 We build tools we wish existed.
                              </p>
                           </div>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                           <Link
                              href="https://may.inc"
                              target="_blank"
                              rel="noreferrer"
                              className="group flex items-center justify-between gap-2 rounded-lg border border-viewerborder bg-viewergray px-3 py-2.5 text-[13px] font-medium text-viewerblack transition-colors hover:bg-viewerwhite hover:border-viewerblue/30"
                           >
                              <span className="inline-flex items-center gap-2">
                                 <Globe className="size-3.5" />
                                 may.inc
                              </span>
                              <ArrowUpRight className="size-3.5 text-viewertext" />
                           </Link>
                           <Link
                              href="https://github.com/maydotinc"
                              target="_blank"
                              rel="noreferrer"
                              className="group flex items-center justify-between gap-2 rounded-lg border border-viewerborder bg-viewergray px-3 py-2.5 text-[13px] font-medium text-viewerblack transition-colors hover:bg-viewerwhite hover:border-viewerblue/30"
                           >
                              <span className="inline-flex items-center gap-2">
                                 <FaGithub className="size-3.5" />
                                 maydotinc
                              </span>
                              <ArrowUpRight className="size-3.5 text-viewertext" />
                           </Link>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </section>

         <section>
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
               <div className="flex flex-col gap-3 mb-10 max-w-[680px]">
                  <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                     What we believe
                  </span>
                  <h2 className="text-[28px] sm:text-[34px] lg:text-[40px] font-semibold tracking-[-0.01em] leading-[1.1] text-viewerblack">
                     Three rules we don&apos;t break.
                  </h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {values.map((v, i) => (
                     <div
                        key={v.title}
                        className="motion-fade-up flex flex-col gap-4 rounded-2xl border border-viewerborder bg-viewerwhite p-6 hover:border-viewerblue/30 transition-colors"
                        style={{ animationDelay: `${i * 100}ms` }}
                     >
                        <span className="grid place-items-center size-10 rounded-[10px] border border-viewerborder bg-viewergray text-viewerblue">
                           <v.icon className="size-4.5" strokeWidth={1.8} />
                        </span>
                        <h3 className="text-[18px] font-semibold text-viewerblack tracking-tight">
                           {v.title}
                        </h3>
                        <p className="text-[14px] text-viewertext leading-[1.65]">
                           {v.body}
                        </p>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         <section className="border-t border-viewerborder bg-viewergray">
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
                  <div className="lg:col-span-5 flex flex-col gap-5">
                     <h2 className="text-[28px] sm:text-[34px] lg:text-[40px] font-semibold tracking-[-0.01em] leading-[1.1] text-viewerblack">
                        Four people built this.
                     </h2>
                     <Link
                        href="https://github.com/maydotinc/s3-viewer/issues"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-viewerborder bg-viewerwhite hover:bg-viewergray transition-colors w-fit overflow-hidden"
                     >
                        <span className="flex items-center gap-2 px-4 h-11 text-[13.5px] font-medium text-viewerblack">
                           <FaGithub className="size-4" />
                           Help us out
                        </span>
                        <span className="flex items-center px-3 h-11 border-l border-viewerborder bg-viewergray text-[12.5px] text-viewertext">
                           Open an issue
                        </span>
                     </Link>
                  </div>
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {team.map((member, i) => (
                        <div
                           key={member.profile}
                           className="motion-fade-up flex items-center gap-4 rounded-2xl border border-viewerborder bg-viewerwhite p-4 transition-colors hover:border-viewerblue/30"
                           style={{ animationDelay: `${i * 70}ms` }}
                        >
                           <div className="flex-none size-16 overflow-hidden rounded-xl bg-viewergray">
                              <Image
                                 src={`/landing/profiles/${member.profile}.png`}
                                 alt={member.name}
                                 width={128}
                                 height={128}
                                 quality={100}
                                 className="size-full object-cover"
                                 draggable={false}
                              />
                           </div>
                           <div className="flex flex-col gap-2 min-w-0 flex-1">
                              <div className="flex flex-col gap-0.5">
                                 <span className="text-[15px] font-semibold text-viewerblack leading-tight">
                                    {member.name}
                                 </span>
                                 <span className="text-[12px] text-viewerlighttext leading-tight">
                                    {member.role}
                                 </span>
                              </div>
                              {(member.github ||
                                 member.twitter ||
                                 member.linkedin) && (
                                 <div className="flex items-center gap-1.5">
                                    <SocialLink
                                       href={member.github}
                                       icon={FaGithub}
                                       label={`${member.name} on GitHub`}
                                    />
                                    <SocialLink
                                       href={member.twitter}
                                       icon={Twitter}
                                       label={`${member.name} on Twitter`}
                                    />
                                    <SocialLink
                                       href={member.linkedin}
                                       icon={Linkedin}
                                       label={`${member.name} on LinkedIn`}
                                    />
                                 </div>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </section>

         <section className="border-t border-viewerborder">
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
               <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
                  <div className="flex flex-col gap-4">
                     <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                        Get started
                     </span>
                     <h2 className="text-[30px] sm:text-[38px] lg:text-[44px] font-semibold tracking-[-0.01em] leading-[1.08] text-viewerblack">
                        Connect a bucket in under thirty seconds.
                     </h2>
                     <p className="text-[15.5px] text-viewertext leading-[1.6] max-w-[540px]">
                        Works with AWS S3, Cloudflare R2, MinIO, Backblaze B2,
                        Wasabi, and any S3-compatible API.
                     </p>
                  </div>
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-stretch">
                     <Link
                        href="/dashboard"
                        className="group flex items-center justify-between gap-3 rounded-xl border border-viewerblack bg-viewerblack px-5 py-4 text-[14.5px] font-semibold text-viewerwhite transition-colors hover:bg-viewerblack/85"
                     >
                        Open Viewer
                        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                     </Link>
                     <Link
                        href="/use-cases"
                        className="group flex items-center justify-between gap-3 rounded-xl border border-viewerborder bg-viewerwhite px-5 py-4 text-[14.5px] font-semibold text-viewerblack transition-colors hover:border-viewerblue/40"
                     >
                        Explore use cases
                        <ArrowUpRight className="size-4 text-viewertext" />
                     </Link>
                  </div>
               </div>
            </div>
         </section>
      </main>
   );
};

export default About;
