import {
   CONTACT_EMAIL,
   GITHUB_URL,
   LICENSE_URL,
   MAY_FOUNDING_YEAR,
   MAY_GITHUB_URL,
   MAY_LEGAL_NAME,
   MAY_LINKEDIN_URL,
   MAY_LOCATION,
   MAY_LOGO_URL,
   MAY_NAME,
   MAY_S3_VIEWER_URL,
   MAY_URL,
   OG_IMAGE_URL,
   SITE_URL,
} from "@/lib/site-config";
import { founder, team, type TeamMember } from "@/lib/team";
import type { Faq } from "@/lib/types";

type JsonLdNode = Record<string, unknown>;
type Crumb = { name: string; url: string };
type PageCrumb = { name: string; path: string };

// match the @ids used on may.inc so both sites describe the same entities.
const ORGANIZATION_ID = `${MAY_URL}#organization`;
const WEBSITE_ID = `${SITE_URL}#website`;
const APP_ID = `${SITE_URL}#app`;
const SOURCE_ID = `${GITHUB_URL}#code`;

const organizationRef = { "@id": ORGANIZATION_ID };
const websiteRef = { "@id": WEBSITE_ID };
const appRef = { "@id": APP_ID };

const personId = (member: TeamMember) =>
   member.schemaId ?? `${SITE_URL}/about#${member.profile}`;

const personRef = (member: TeamMember) => ({ "@id": personId(member) });

const personNode = (member: TeamMember) => ({
   "@type": "Person",
   "@id": personId(member),
   name: member.name,
   jobTitle: member.jobTitle ?? member.role,
   ...(member.description ? { description: member.description } : {}),
   image: `${SITE_URL}/landing/profiles/${member.profile}.png`,
   ...((member.profileUrl ?? member.website)
      ? { url: member.profileUrl ?? member.website }
      : {}),
   worksFor: organizationRef,
   sameAs: [
      member.website,
      member.github,
      member.twitter,
      member.linkedin,
      ...(member.alsoKnownAt ?? []),
   ].filter((url): url is string => Boolean(url)),
});

// the founder is credited through Organization.founder (schema.org has no
// inverse `founderOf`), never as the author of the product itself: S3 Viewer
// is May's work, not one person's. bylined guides are the exception.
const founderNode = () => ({
   ...personNode(founder),
   alternateName: "Aleem",
});

const organizationNode = () => ({
   "@type": "Organization",
   "@id": ORGANIZATION_ID,
   name: MAY_NAME,
   legalName: MAY_LEGAL_NAME,
   alternateName: ["May", "May Inc", "may.inc"],
   url: MAY_URL,
   logo: MAY_LOGO_URL,
   image: MAY_LOGO_URL,
   description: `${MAY_NAME} is the software company behind S3 Viewer. Based in ${MAY_LOCATION}, May builds products, open-source developer tools and technical consulting.`,
   foundingDate: MAY_FOUNDING_YEAR,
   foundingLocation: { "@type": "Place", name: MAY_LOCATION },
   founder: { "@id": founder.schemaId },
   knowsAbout: [
      "Object storage",
      "Amazon S3",
      "S3-compatible storage",
      "Open source",
      "Developer tools",
   ],
   sameAs: [MAY_GITHUB_URL, MAY_LINKEDIN_URL],
   contactPoint: [
      {
         "@type": "ContactPoint",
         contactType: "customer support",
         email: CONTACT_EMAIL,
         url: `${SITE_URL}/contact`,
         availableLanguage: "English",
      },
   ],
});

const websiteNode = () => ({
   "@type": "WebSite",
   "@id": WEBSITE_ID,
   name: "S3 Viewer",
   alternateName: "S3 Viewer by May Inc.",
   url: SITE_URL,
   inLanguage: "en-US",
   publisher: organizationRef,
   copyrightHolder: organizationRef,
});

const softwareSourceCodeNode = () => ({
   "@type": "SoftwareSourceCode",
   "@id": SOURCE_ID,
   name: "maydotinc/s3-viewer",
   codeRepository: GITHUB_URL,
   programmingLanguage: "TypeScript",
   runtimePlatform: "Node.js",
   license: LICENSE_URL,
   author: organizationRef,
   copyrightHolder: organizationRef,
   maintainer: organizationRef,
   targetProduct: appRef,
});

const softwareApplicationNode = (description: string) => ({
   "@type": ["SoftwareApplication", "WebApplication"],
   "@id": APP_ID,
   name: "S3 Viewer",
   alternateName: ["S3 Viewer by May", "s3-viewer"],
   description,
   url: SITE_URL,
   image: OG_IMAGE_URL,
   applicationCategory: "DeveloperApplication",
   operatingSystem: "Web",
   isAccessibleForFree: true,
   license: LICENSE_URL,
   offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
   sameAs: [GITHUB_URL, MAY_S3_VIEWER_URL],
   author: organizationRef,
   creator: organizationRef,
   publisher: organizationRef,
   maintainer: organizationRef,
   copyrightHolder: organizationRef,
   brand: organizationRef,
});

type WebPage = {
   type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage";
   name: string;
   path: string;
   description?: string;
};

const webPageNode = ({
   type = "WebPage",
   name,
   path,
   description,
}: WebPage) => ({
   "@type": type,
   name,
   url: `${SITE_URL}${path}`,
   ...(description ? { description } : {}),
   isPartOf: websiteRef,
});

const breadcrumbList = (trail: Crumb[]) => ({
   "@type": "BreadcrumbList",
   itemListElement: [{ name: "Home", url: SITE_URL }, ...trail].map(
      ({ name, url }, i) => ({
         "@type": "ListItem",
         position: i + 1,
         name,
         item: url,
      })
   ),
});

const crumbUrls = (trail: PageCrumb[]): Crumb[] =>
   trail.map(({ name, path }) => ({ name, url: `${SITE_URL}${path}` }));

// on-page anchors for numbered steps; HowToStep urls point at them.
const stepId = (index: number) => `step-${index + 1}`;

const aboutThing = (name: string) => ({ "@type": "Thing", name });

const howToNode = ({
   name,
   description,
   url,
   image,
   steps,
}: {
   name: string;
   description: string;
   url: string;
   image?: string;
   steps: { name: string; text: string }[];
}) => ({
   "@type": "HowTo",
   name,
   description,
   ...(image ? { image } : {}),
   step: steps.map(({ name: stepName, text }, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: stepName,
      text,
      url: `${url}#${stepId(i)}`,
   })),
});

const faqPage = (faqs: Faq[]) => ({
   "@type": "FAQPage",
   mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
   })),
});

const dedupeById = (nodes: JsonLdNode[]) => {
   const seen = new Set<string>();
   return nodes.filter((node) => {
      const id = node["@id"];
      if (typeof id !== "string") return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
   });
};

// every page carries the site, the organization and its founder so that
// author/publisher/worksFor references always resolve within the page.
const graph = (nodes: JsonLdNode[]) => ({
   "@context": "https://schema.org",
   "@graph": dedupeById([
      ...nodes,
      websiteNode(),
      organizationNode(),
      founderNode(),
   ]),
});

const pageJsonLd = ({
   crumbs,
   extra,
   nodes = [],
   ...page
}: WebPage & {
   crumbs: string | PageCrumb[];
   extra?: JsonLdNode;
   nodes?: JsonLdNode[];
}) =>
   graph([
      { ...webPageNode(page), ...extra },
      breadcrumbList(
         crumbUrls(
            typeof crumbs === "string"
               ? [{ name: crumbs, path: page.path }]
               : crumbs
         )
      ),
      ...nodes,
   ]);

const guideGraph = ({
   main,
   section,
   name,
   url,
   howTo,
   faqs,
}: {
   main: JsonLdNode;
   section: PageCrumb;
   name: string;
   url: string;
   howTo: JsonLdNode;
   faqs: Faq[];
}) =>
   graph([
      main,
      breadcrumbList([...crumbUrls([section]), { name, url }]),
      howTo,
      ...(faqs.length > 0 ? [faqPage(faqs)] : []),
   ]);

const homeJsonLd = (description: string) =>
   graph([softwareApplicationNode(description), softwareSourceCodeNode()]);

const aboutJsonLd = (description: string) =>
   pageJsonLd({
      type: "AboutPage",
      name: "About S3 Viewer",
      path: "/about",
      description,
      crumbs: "About",
      extra: { about: organizationRef },
      nodes: [
         {
            ...organizationNode(),
            member: team.map(personRef),
         },
         ...team.map((member) =>
            member === founder ? founderNode() : personNode(member)
         ),
      ],
   });

const contactJsonLd = (description: string) =>
   pageJsonLd({
      type: "ContactPage",
      name: "Contact S3 Viewer",
      path: "/contact",
      description,
      crumbs: "Contact",
      extra: { about: organizationRef },
   });

const legalJsonLd = (name: string, slug: string) =>
   pageJsonLd({
      name,
      path: `/legal/${slug}`,
      crumbs: [
         { name: "Legal", path: "/legal" },
         { name, path: `/legal/${slug}` },
      ],
   });

export {
   ORGANIZATION_ID,
   WEBSITE_ID,
   aboutJsonLd,
   aboutThing,
   breadcrumbList,
   contactJsonLd,
   graph,
   guideGraph,
   homeJsonLd,
   howToNode,
   legalJsonLd,
   organizationRef,
   pageJsonLd,
   personRef,
   stepId,
   webPageNode,
   websiteRef,
};
export type { JsonLdNode };
