import BasicBlock, { PageTitle } from "@/components/basic-block";
import PageHero from "@/components/page-hero";
import { ExternalLink } from "@/components/external-link";
import LinkCard from "@/components/link-card";
import { formatDate } from "@/lib/format-date";
import { GITHUB_URL } from "@/lib/site-config";
import { FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import privacyPolicyData from "./data/privacy";
import termsOfServiceData from "./data/terms";

type Doc = {
   href: string;
   title: string;
   description: string;
   icon: typeof FileText;
   lastUpdated: string;
};

const DOCS: Doc[] = [
   {
      href: "/legal/terms-of-service",
      title: "Terms of Service",
      description:
         "The ground rules for using S3 Viewer — the license, acceptable use, and how accounts work.",
      icon: FileText,
      lastUpdated: termsOfServiceData.lastUpdated,
   },
   {
      href: "/legal/privacy-policy",
      title: "Privacy Policy",
      description:
         "What information we collect, why we collect it, who we share it with, and the rights you have over it.",
      icon: ShieldCheck,
      lastUpdated: privacyPolicyData.lastUpdated,
   },
];

const LegalHub = () => {
   return (
      <main className="bg-viewerwhite w-full overflow-x-clip">
         <PageHero current="Legal">
            <div className="flex flex-col gap-4 max-w-[760px]">
               <PageTitle>Legal documents</PageTitle>
               <p className="text-viewertext max-w-[620px]">
                  The plain-English ground rules for using S3 Viewer. We try to
                  keep these short and honest.
               </p>
            </div>
         </PageHero>

         <BasicBlock sectionClassName="bg-viewergray">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
               {DOCS.map((doc) => (
                  <LinkCard
                     key={doc.href}
                     href={doc.href}
                     aria-label={`Read the ${doc.title}`}
                     heading="h2"
                     title={doc.title}
                     description={doc.description}
                     titleClassName="text-xl"
                     className="h-full gap-4 p-6"
                     media={
                        <span className="grid size-10 place-items-center rounded-lg bg-viewergray text-viewerblue">
                           <doc.icon className="size-5" strokeWidth={1.8} />
                        </span>
                     }
                     footer={
                        <span className="mt-2 text-xs font-medium text-viewerlighttext">
                           Updated {formatDate(doc.lastUpdated, "long")}
                        </span>
                     }
                  />
               ))}
            </div>

            <p className="mt-10 text-xs text-viewerlighttext max-w-[640px]">
               Questions about any of these policies?{" "}
               <Link
                  href="/contact"
                  className="text-viewerblack font-medium underline decoration-viewerborder underline-offset-[3px] hover:decoration-viewerblack"
               >
                  Contact us
               </Link>{" "}
               or open an issue on our{" "}
               <ExternalLink
                  href={GITHUB_URL}
                  className="text-viewerblack font-medium underline decoration-viewerborder underline-offset-[3px] hover:decoration-viewerblack"
               >
                  GitHub repository
               </ExternalLink>
               .
            </p>
         </BasicBlock>
      </main>
   );
};

export default LegalHub;
