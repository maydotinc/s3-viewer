import BasicBlock, { PageTitle } from "@/components/basic-block";
import { ExternalLink, isExternalHref } from "@/components/external-link";
import { IconBadge, type IconComponent } from "@/components/icon-card";
import LinkCard from "@/components/link-card";
import PageHero from "@/components/page-hero";
import { GitHubMark } from "@/components/social-marks";
import {
   CONTACT_EMAIL,
   GITHUB_ISSUES_URL,
   GITHUB_URL,
   MAY_HOST,
   MAY_NAME,
   MAY_URL,
} from "@/lib/site-config";
import { PRODUCT_NAME } from "@s3-viewer/shared/constants";
import { Building2, Mail } from "lucide-react";

type Channel = {
   href: string;
   title: string;
   description: string;
   cta: string;
   icon: IconComponent;
};

const CHANNELS: Channel[] = [
   {
      href: `mailto:${CONTACT_EMAIL}?subject=S3%20Viewer`,
      title: "Email",
      description:
         "For account questions, security reports and anything private.",
      cta: CONTACT_EMAIL,
      icon: Mail,
   },
   {
      href: GITHUB_ISSUES_URL,
      title: "GitHub issues",
      description:
         "Bugs and feature requests. The code is open source; issues and pull requests are welcome.",
      cta: "Open an issue",
      icon: GitHubMark,
   },
   {
      href: MAY_URL,
      title: MAY_NAME,
      description: `The studio behind ${PRODUCT_NAME}. See what else we build.`,
      cta: MAY_HOST,
      icon: Building2,
   },
];

const Contact = () => {
   return (
      <main className="bg-viewerwhite w-full overflow-x-clip">
         <PageHero current="Contact">
            <div className="flex flex-col gap-4 max-w-[760px]">
               <PageTitle>Contact</PageTitle>
               <p className="text-viewertext max-w-[620px]">
                  {PRODUCT_NAME} is built by {MAY_NAME}. Email us, open an
                  issue, or read about the studio.
               </p>
            </div>
         </PageHero>

         <BasicBlock sectionClassName="bg-viewergray">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
               {CHANNELS.map((channel) => (
                  <LinkCard
                     key={channel.href}
                     href={channel.href}
                     showArrow={isExternalHref(channel.href)}
                     aria-label={`${channel.title}: ${channel.cta}`}
                     heading="h2"
                     title={channel.title}
                     description={channel.description}
                     titleClassName="text-xl leading-snug"
                     className="h-full gap-4 p-6"
                     media={
                        <IconBadge icon={channel.icon} iconClassName="size-5" />
                     }
                     footer={
                        <span className="mt-2 text-sm font-medium text-viewerblack underline decoration-viewerborder underline-offset-[3px] group-hover:decoration-viewerblack">
                           {channel.cta}
                        </span>
                     }
                  />
               ))}
            </div>

            <p className="mt-10 text-sm text-viewertext max-w-[640px]">
               Email us instead of opening a public issue for security reports.
               See{" "}
               <ExternalLink
                  href={`${GITHUB_URL}/blob/main/SECURITY.md`}
                  className="text-viewerblack font-medium underline decoration-viewerborder underline-offset-[3px] hover:decoration-viewerblack"
               >
                  SECURITY.md
               </ExternalLink>
               .
            </p>
         </BasicBlock>
      </main>
   );
};

export default Contact;
