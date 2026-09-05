import { GITHUB_URL } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
import {
   ArrowUpRight,
   ChevronRight,
   Globe,
   Heart,
   Sparkles,
   Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { FaLinkedinIn, FaXTwitter } from "react-icons/fa6";

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

export type TeamMember = {
   name: string;
   /** Displayed on the page. */
   role: string;
   profile: string;
   github?: string;
   twitter?: string;
   linkedin?: string;
   website?: string;
   /** Canonical schema.org @id when this person is defined elsewhere (e.g. may.inc). */
   schemaId?: string;
   /** schema.org jobTitle when it differs from the displayed role. */
   jobTitle?: string;
};

export const team: TeamMember[] = [
   {
      name: "Michael Papadopoulos",
      role: "Engineering",
      profile: "mike",
      github: "https://github.com/michaelnpapadopoulos",
      twitter: "https://x.com/maikulol",
   },
   {
      name: "Vinit Ghelani",
      role: "Design",
      profile: "vinit",
      twitter: "https://x.com/vinit_zupit",
      linkedin: "https://www.linkedin.com/in/heyvinit/",
   },
   {
      name: "Aleem Rehmtulla",
      role: "Engineering",
      profile: "aleem",
      github: "https://github.com/aleemrehmtulla",
      twitter: "https://x.com/aleemrehmtulla",
      website: "https://aleemrehmtulla.com",
      schemaId: "https://may.inc/aleem#person",
      jobTitle: "Founder & Director of Technology",
   },
   {
      name: "Noah Gomes",
      role: "Engineering",
      profile: "noah",
      github: "https://github.com/NoahGdev",
      linkedin: "https://www.linkedin.com/in/noah-gomes/",
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
         className="grid place-items-center size-9 sm:size-8 rounded-md border border-viewerborder bg-viewerwhite text-viewertext transition-colors hover:bg-viewerblack hover:text-viewerwhite hover:border-viewerblack"
      >
         <Icon className="size-4 sm:size-3.5" />
      </Link>
   );
};

const About = () => {
   return (
      <main className="w-full overflow-x-clip">
         <section className="border-b border-viewerborder bg-viewergray">
            <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16">
               <nav
                  aria-label="Breadcrumb"
                  className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-viewerlighttext mb-6"
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
                  <div className="lg:col-span-7 flex flex-col gap-6">
                     <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
                        Object storage was
                        <br />
                        never the problem.
                     </h1>
                     <p className="text-lg text-viewertext max-w-[620px]">
                        We built S3 Viewer because the dashboards were the
                        problem. AWS won&apos;t let you see your R2 buckets.
                        Cloudflare won&apos;t show your S3 data. Every provider
                        keeps your files locked inside their own UI.
                        <br />
                        <br />
                        S3 Viewer is one fast interface for any S3-compatible
                        bucket — open source, self-hostable, and built to feel
                        like your local file system.
                     </p>
                     <div className="flex flex-wrap gap-3 pt-2">
                        <Button
                           asChild
                           size="lg"
                           className="h-11 px-6 text-[15px]"
                        >
                           <Link href="/dashboard">
                              Open app
                              <ChevronRight />
                           </Link>
                        </Button>
                        <Button
                           asChild
                           variant="outline"
                           size="lg"
                           className="h-11 px-6 text-[15px]"
                        >
                           <Link
                              href={GITHUB_URL}
                              target="_blank"
                              rel="noreferrer"
                           >
                              <FaGithub />
                              Star on GitHub
                           </Link>
                        </Button>
                     </div>
                  </div>

                  <div className="lg:col-span-5">
                     <div className="relative rounded-xl border border-viewerborder bg-viewerwhite p-6 sm:p-7">
                        <div className="absolute -top-3 left-6 inline-flex items-center gap-2 rounded-full border border-viewerborder bg-viewerwhite px-3 py-1 text-xs font-medium tracking-wide uppercase text-viewertext">
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
                              <h2 className="text-xl font-semibold text-viewerblack">
                                 May Inc.
                              </h2>
                              <p className="text-sm text-viewertext leading-relaxed">
                                 We build tools we wish existed.
                              </p>
                           </div>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                           <Link
                              href="https://may.inc"
                              target="_blank"
                              rel="noreferrer"
                              className="group flex items-center justify-between gap-2 rounded-lg border border-viewerborder bg-viewergray px-3 py-2.5 text-sm font-medium text-viewerblack transition-colors hover:bg-viewerwhite"
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
                              className="group flex items-center justify-between gap-2 rounded-lg border border-viewerborder bg-viewergray px-3 py-2.5 text-sm font-medium text-viewerblack transition-colors hover:bg-viewerwhite"
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
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="flex flex-col gap-3 mb-10 max-w-[680px]">
                  <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                     What we believe
                  </span>
                  <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                     Three rules we don&apos;t break.
                  </h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {values.map((v) => (
                     <div
                        key={v.title}
                        className="flex flex-col gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-6"
                     >
                        <span className="grid place-items-center size-10 rounded-lg bg-viewergray text-viewerblue">
                           <v.icon className="size-4.5" strokeWidth={1.8} />
                        </span>
                        <h3 className="text-lg font-semibold text-viewerblack tracking-tight">
                           {v.title}
                        </h3>
                        <p className="text-sm text-viewertext leading-relaxed">
                           {v.body}
                        </p>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         <section className="border-t border-viewerborder bg-viewergray">
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
                  <div className="lg:col-span-5 flex flex-col gap-5">
                     <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                        Built with love.
                     </h2>
                     <Button asChild variant="outline" className="w-fit">
                        <Link
                           href={`${GITHUB_URL}/issues`}
                           target="_blank"
                           rel="noreferrer"
                        >
                           <FaGithub />
                           Open an issue
                        </Link>
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
                                 <div className="flex items-center gap-1.5">
                                    <SocialLink
                                       href={member.github}
                                       icon={FaGithub}
                                       label={`${member.name} on GitHub`}
                                    />
                                    <SocialLink
                                       href={member.twitter}
                                       icon={FaXTwitter}
                                       label={`${member.name} on X`}
                                    />
                                    <SocialLink
                                       href={member.linkedin}
                                       icon={FaLinkedinIn}
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
            </div>
         </section>

         <section className="border-t border-viewerborder">
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
                  <div className="flex flex-col gap-4">
                     <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                        Get started
                     </span>
                     <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                        Connect a bucket and start browsing.
                     </h2>
                     <p className="text-viewertext max-w-[540px]">
                        Works with AWS S3, Cloudflare R2, MinIO, Backblaze B2,
                        Wasabi, and any S3-compatible API.
                     </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                     <Button
                        asChild
                        size="lg"
                        className="h-11 px-6 text-[15px]"
                     >
                        <Link href="/dashboard">
                           Open app
                           <ChevronRight />
                        </Link>
                     </Button>
                     <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="h-11 px-6 text-[15px]"
                     >
                        <Link href="/use-cases">
                           Explore use cases
                           <ArrowUpRight />
                        </Link>
                     </Button>
                  </div>
               </div>
            </div>
         </section>
      </main>
   );
};

export default About;
