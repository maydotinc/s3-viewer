import About, { team } from "@/components/About";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { MAY_URL, SITE_URL } from "@/lib/site-config";

// Match the @ids used on may.inc so both sites describe the same entities.
const ORGANIZATION_ID = `${MAY_URL}#organization`;

const people = team.map((member) => ({
   "@context": "https://schema.org",
   "@type": "Person",
   "@id": member.schemaId ?? `${SITE_URL}/about#${member.profile}`,
   name: member.name,
   jobTitle: member.jobTitle ?? member.role,
   image: `${SITE_URL}/landing/profiles/${member.profile}.png`,
   ...(member.website ? { url: member.website } : {}),
   worksFor: { "@id": ORGANIZATION_ID },
   sameAs: [
      member.website,
      member.github,
      member.twitter,
      member.linkedin,
   ].filter(Boolean),
}));

const founder = team.find((member) => member.profile === "aleem");

const AboutPage = () => {
   const jsonLd = [
      {
         "@context": "https://schema.org",
         "@type": "AboutPage",
         name: "About S3 Viewer",
         url: `${SITE_URL}/about`,
         description:
            "S3 Viewer is built by May Inc. — a small studio shipping fast, open-source tools for object storage.",
      },
      {
         "@context": "https://schema.org",
         "@type": "Organization",
         "@id": ORGANIZATION_ID,
         name: "May Inc.",
         url: MAY_URL,
         logo: "https://cdn-may.com/assets/may-square-512x512.png",
         description:
            "May Inc. is the studio behind S3 Viewer and other open-source developer tools.",
         sameAs: ["https://github.com/maydotinc", MAY_URL],
         ...(founder
            ? {
                 founder: {
                    "@type": "Person",
                    "@id": founder.schemaId,
                    name: founder.name,
                 },
              }
            : {}),
         member: people.map((person) => ({
            "@type": "Person",
            "@id": person["@id"],
            name: person.name,
         })),
      },
      ...people,
   ];

   return (
      <>
         <Seo
            title="About S3 Viewer & May Inc."
            description="The story behind S3 Viewer: built by May Inc. as a fast, open-source viewer for any S3-compatible bucket. Meet the team and our values."
            canonical="/about"
            jsonLd={jsonLd}
         />
         <About />
      </>
   );
};

AboutPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default AboutPage;
