import { describe, expect, it } from "vitest";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import { buildUseCaseJsonLd } from "@/components/UseCases/jsonld";
import { team } from "@/lib/team";
import { SITE_URL } from "@/lib/site-config";
import { siteTitle } from "@/lib/site-title";
import {
   ORGANIZATION_ID,
   WEBSITE_ID,
   aboutJsonLd,
   breadcrumbList,
   contactJsonLd,
   graph,
   homeJsonLd,
   legalJsonLd,
   webPageNode,
   type JsonLdNode,
} from "./jsonld";

const FOUNDER_ID = "https://may.inc/aleem#person";

type Graph = { "@context": string; "@graph": JsonLdNode[] };

const walk = (value: unknown, visit: (node: JsonLdNode) => void) => {
   if (Array.isArray(value)) {
      value.forEach((v) => walk(v, visit));
   } else if (value && typeof value === "object") {
      visit(value as JsonLdNode);
      Object.values(value).forEach((v) => walk(v, visit));
   }
};

const definedIds = (g: Graph) =>
   new Set(
      g["@graph"]
         .map((node) => node["@id"])
         .filter((id): id is string => typeof id === "string")
   );

const referencedIds = (g: Graph) => {
   const ids = new Set<string>();
   g["@graph"].forEach((node) =>
      walk(node, (n) => {
         if (n !== node && typeof n["@id"] === "string") ids.add(n["@id"]);
      })
   );
   return ids;
};

const nodeById = (g: Graph, id: string) =>
   g["@graph"].find((node) => node["@id"] === id);

const expectWellFormed = (g: Graph) => {
   expect(g["@context"]).toBe("https://schema.org");
   const defined = definedIds(g);
   referencedIds(g).forEach((id) => expect(defined).toContain(id));
   walk(g, (node) => {
      Object.values(node).forEach((v) => expect(v).not.toBeUndefined());
      if (typeof node["@id"] === "string") {
         expect(node["@id"]).toMatch(/^https?:\/\//);
      }
   });
   // JSON.stringify drops undefined, so the emitted output must round-trip.
   expect(JSON.parse(JSON.stringify(g))).toEqual(g);
   expect(new Set(g["@graph"].map((n) => n["@id"]).filter(Boolean)).size).toBe(
      g["@graph"].filter((n) => n["@id"]).length
   );
};

const expectOrganizationAndFounder = (g: Graph) => {
   const org = nodeById(g, ORGANIZATION_ID);
   expect(org).toMatchObject({
      "@type": "Organization",
      name: "May Inc.",
      legalName: "May Software Inc.",
      alternateName: ["May", "May Inc", "may.inc"],
      url: "https://may.inc",
      logo: "https://cdn-may.com/assets/may-square-512x512.png",
      foundingDate: "2024",
      foundingLocation: { "@type": "Place", name: "Toronto, Canada" },
      sameAs: [
         "https://github.com/maydotinc",
         "https://linkedin.com/company/maydotinc",
      ],
      founder: { "@id": FOUNDER_ID },
   });
   expect(org?.description).toContain("behind S3 Viewer");
   expect(org?.contactPoint).toEqual([
      expect.objectContaining({ email: "info@may.inc" }),
   ]);

   const founder = nodeById(g, FOUNDER_ID);
   expect(founder).toEqual({
      "@type": "Person",
      "@id": FOUNDER_ID,
      name: "Aleem Rehmtulla",
      alternateName: "Aleem",
      jobTitle: "Founder & Director of Technology",
      description:
         "Aleem Rehmtulla is the founder and Director of Technology of May Inc., the Toronto software company that builds and maintains S3 Viewer.",
      image: `${SITE_URL}/landing/profiles/aleem.png`,
      url: "https://may.inc/aleem",
      worksFor: { "@id": ORGANIZATION_ID },
      sameAs: [
         "https://aleemrehmtulla.com",
         "https://github.com/aleemrehmtulla",
         "https://x.com/aleemrehmtulla",
         "https://linkedin.com/in/aleemrehmtulla",
         "https://medium.com/@aleemrehmtulla",
      ],
   });

   expect(nodeById(g, WEBSITE_ID)).toMatchObject({
      "@type": "WebSite",
      name: "S3 Viewer",
      url: SITE_URL,
      inLanguage: "en-US",
      publisher: { "@id": ORGANIZATION_ID },
      copyrightHolder: { "@id": ORGANIZATION_ID },
   });

   g["@graph"].forEach((node) => {
      if (node["@type"] === "TechArticle") return;
      ["author", "creator", "publisher", "maintainer"].forEach((key) => {
         if (key in node) expect(node[key]).toEqual({ "@id": ORGANIZATION_ID });
      });
   });
};

describe("homeJsonLd", () => {
   const g = homeJsonLd("A fast S3 browser.");

   it("is a self-contained graph", () => {
      expectWellFormed(g);
      expectOrganizationAndFounder(g);
   });

   it("attributes the application to May Inc.", () => {
      const app = nodeById(g, `${SITE_URL}#app`);
      expect(app).toMatchObject({
         "@type": ["SoftwareApplication", "WebApplication"],
         name: "S3 Viewer",
         description: "A fast S3 browser.",
         image: `${SITE_URL}/landing/bucketview.png`,
         isAccessibleForFree: true,
         license: "https://github.com/maydotinc/s3-viewer/blob/main/LICENSE",
         sameAs: [
            "https://github.com/maydotinc/s3-viewer",
            "https://may.inc/s3-viewer",
         ],
         author: { "@id": ORGANIZATION_ID },
         creator: { "@id": ORGANIZATION_ID },
         publisher: { "@id": ORGANIZATION_ID },
         maintainer: { "@id": ORGANIZATION_ID },
         copyrightHolder: { "@id": ORGANIZATION_ID },
      });
   });

   it("links the source repository to the app and to May Inc.", () => {
      const code = nodeById(g, "https://github.com/maydotinc/s3-viewer#code");
      expect(code).toMatchObject({
         "@type": "SoftwareSourceCode",
         codeRepository: "https://github.com/maydotinc/s3-viewer",
         license: "https://github.com/maydotinc/s3-viewer/blob/main/LICENSE",
         author: { "@id": ORGANIZATION_ID },
         targetProduct: { "@id": `${SITE_URL}#app` },
      });
   });
});

describe("aboutJsonLd", () => {
   const g = aboutJsonLd("About.");

   it("is a self-contained graph", () => {
      expectWellFormed(g);
      expectOrganizationAndFounder(g);
   });

   it("lists every team member once as an Organization member", () => {
      const org = nodeById(g, ORGANIZATION_ID);
      expect(org?.member).toHaveLength(team.length);
      const people = g["@graph"].filter((n) => n["@type"] === "Person");
      expect(people).toHaveLength(team.length);
      expect(people.map((p) => p.name)).toEqual(team.map((m) => m.name));
      people.forEach((p) =>
         expect(p.worksFor).toEqual({ "@id": ORGANIZATION_ID })
      );
   });

   it("has a breadcrumb like the visible one", () => {
      expect(g["@graph"].find((n) => n["@type"] === "BreadcrumbList")).toEqual(
         breadcrumbList([{ name: "About", url: `${SITE_URL}/about` }])
      );
   });
});

describe("contactJsonLd", () => {
   it("is a self-contained graph with a breadcrumb", () => {
      const g = contactJsonLd("Contact.");
      expectWellFormed(g);
      expectOrganizationAndFounder(g);
      expect(g["@graph"].map((n) => n["@type"])).toContain("BreadcrumbList");
   });
});

describe("legalJsonLd", () => {
   it("is a self-contained graph", () => {
      const g = legalJsonLd("Privacy Policy", "privacy-policy");
      expectWellFormed(g);
      expectOrganizationAndFounder(g);
      expect(g["@graph"][0]).toEqual({
         "@type": "WebPage",
         name: "Privacy Policy",
         url: `${SITE_URL}/legal/privacy-policy`,
         isPartOf: { "@id": WEBSITE_ID },
      });
   });
});

describe("graph", () => {
   it("keeps the first node for a repeated @id", () => {
      const g = graph([
         webPageNode({ name: "A", path: "/a" }),
         { "@type": "Thing", "@id": WEBSITE_ID, name: "override" },
      ]);
      expectWellFormed(g);
      expect(nodeById(g, WEBSITE_ID)?.name).toBe("override");
   });

   it("prefixes breadcrumbs with Home", () => {
      expect(breadcrumbList([{ name: "X", url: `${SITE_URL}/x` }])).toEqual({
         "@type": "BreadcrumbList",
         itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            {
               "@type": "ListItem",
               position: 2,
               name: "X",
               item: `${SITE_URL}/x`,
            },
         ],
      });
   });
});

describe("buildHowToJsonLd", () => {
   const g = buildHowToJsonLd({
      slug: "rename-s3-file",
      title: "How to rename a file in S3",
      tldr: "Copy then delete.",
      steps: [{ title: "Copy", body: "Run CopyObject." }],
      faqs: [{ question: "Q?", answer: "A." }],
      keyword: "rename file in S3",
      datePublished: "2026-04-28",
   });

   it("is a self-contained graph", () => {
      expectWellFormed(g);
      expectOrganizationAndFounder(g);
   });

   it("bylines the founder and credits May Inc. as publisher", () => {
      const article = g["@graph"].find((n) => n["@type"] === "TechArticle");
      expect(article).toMatchObject({
         headline: "How to rename a file in S3",
         image: `${SITE_URL}/landing/bucketview.png`,
         author: { "@id": FOUNDER_ID },
         publisher: { "@id": ORGANIZATION_ID },
         copyrightHolder: { "@id": ORGANIZATION_ID },
         isPartOf: { "@id": WEBSITE_ID },
         datePublished: "2026-04-28",
         dateModified: "2026-04-28",
      });
      const howTo = g["@graph"].find((n) => n["@type"] === "HowTo");
      expect(howTo).toMatchObject({
         image: `${SITE_URL}/landing/bucketview.png`,
         step: [
            expect.objectContaining({
               name: "Copy",
               text: "Run CopyObject.",
               url: `${SITE_URL}/how-to/rename-s3-file#step-1`,
            }),
         ],
      });
   });
});

describe("buildUseCaseJsonLd", () => {
   const g = buildUseCaseJsonLd({
      slug: "teams",
      title: "Team Access to S3 Buckets",
      eyebrow: "Teams",
      description: "Share a bucket.",
      steps: [{ title: "Connect", body: "Paste keys." }],
      faqs: [],
      keyword: "S3 bucket team access",
   });

   it("is a self-contained graph", () => {
      expectWellFormed(g);
      expectOrganizationAndFounder(g);
   });

   it("names the page exactly like the <title>", () => {
      const page = g["@graph"].find((n) => n["@type"] === "WebPage");
      expect(page?.name).toBe("Team Access to S3 Buckets | S3 Viewer");
      expect(page?.name).toBe(siteTitle("Team Access to S3 Buckets"));
      expect(page?.headline).toBe(page?.name);
      expect(g["@graph"].map((n) => n["@type"])).not.toContain("FAQPage");
   });
});
