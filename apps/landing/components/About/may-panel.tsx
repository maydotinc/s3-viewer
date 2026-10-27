import { ExternalLink } from "@/components/external-link";
import { GitHubMark, LinkedInMark } from "@/components/social-marks";
import {
   MAY_GITHUB_URL,
   MAY_HOST,
   MAY_LINKEDIN_URL,
   MAY_NAME,
   MAY_URL,
} from "@/lib/site-config";
import { Globe } from "lucide-react";

// may's mark, the same path may.inc draws in on load
const MAY_MARK_PATH =
   "M262.506 696V563.904L0 434.029V296.383L262.506 434.029V296.383L131.253 230.89V97.6842L262.506 162.067V32.1914L325.375 0V132.096L262.506 162.067V296.383L459.937 197.589V329.684L262.506 434.029V563.904L590.087 396.287V528.383L262.506 696Z";

const LINK =
   "inline-flex items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-3 py-2 text-sm font-medium whitespace-nowrap text-viewerblack transition-colors hover:bg-viewergray";

// fills the hero's right column at the text column's height; the mark takes the
// right of the band above the links and is bounded by width so it never meets the text.
export const MayPanel = () => (
   <div className="flex h-full min-h-[300px] flex-col gap-6 rounded-2xl border border-viewerborder bg-viewergray p-6 sm:p-8">
      <div className="relative flex-1">
         <div className="flex max-w-[55%] flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-viewerlighttext uppercase">
               Built by
            </span>
            <span className="text-2xl font-semibold tracking-tight text-viewerblack">
               {MAY_NAME}
            </span>
            <p className="text-sm text-viewertext">
               Built for the love of building.
            </p>
         </div>
         <svg
            viewBox="0 0 591 696"
            aria-hidden
            className="absolute inset-y-0 right-0 h-full w-auto max-w-[42%] overflow-visible text-[#003539]"
         >
            <path
               d={MAY_MARK_PATH}
               fill="currentColor"
               stroke="currentColor"
               strokeWidth={5}
               className="animate-may-mark"
            />
         </svg>
      </div>

      <div className="flex flex-wrap gap-2">
         <ExternalLink href={MAY_URL} className={LINK}>
            <Globe className="size-3.5" />
            {MAY_HOST}
         </ExternalLink>
         <ExternalLink href={MAY_GITHUB_URL} className={LINK}>
            <GitHubMark className="size-3.5" />
            GitHub
         </ExternalLink>
         <ExternalLink href={MAY_LINKEDIN_URL} className={LINK}>
            <LinkedInMark className="size-3.5" />
            LinkedIn
         </ExternalLink>
      </div>
   </div>
);
