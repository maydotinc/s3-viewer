import { FOUNDER_PROFILE_URL } from "@/lib/site-config";

export type TeamMember = {
   name: string;
   role: string;
   shortName: string;
   profile: string;
   github?: string;
   twitter?: string;
   linkedin?: string;
   website?: string;
   // canonical profile url, used as the Person's url in structured data
   profileUrl?: string;
   // extra sameAs links that have no social icon on the About page
   alsoKnownAt?: string[];
   schemaId?: string;
   jobTitle?: string;
   description?: string;
};

const aleem = {
   name: "Aleem Rehmtulla",
   role: "Founder @ May Inc.",
   shortName: "Aleem",
   profile: "aleem",
   github: "https://github.com/aleemrehmtulla",
   twitter: "https://x.com/aleemrehmtulla",
   linkedin: "https://linkedin.com/in/aleemrehmtulla",
   website: "https://aleemrehmtulla.com",
   profileUrl: FOUNDER_PROFILE_URL,
   alsoKnownAt: ["https://medium.com/@aleemrehmtulla"],
   schemaId: `${FOUNDER_PROFILE_URL}#person`,
   jobTitle: "Founder & Director of Technology",
   description:
      "Aleem Rehmtulla is the founder and Director of Technology of May Inc., the Toronto software company that builds and maintains S3 Viewer.",
} satisfies TeamMember;

export const founder = aleem;

export const team: TeamMember[] = [
   {
      name: "Michael Papadopoulos",
      role: "Engineering @ May Inc.",
      shortName: "Mike",
      profile: "mike",
      jobTitle: "Engineering",
      github: "https://github.com/michaelnpapadopoulos",
      twitter: "https://x.com/maikulol",
   },
   {
      name: "Vinit Ghelani",
      role: "Design @ May Inc.",
      shortName: "Vinit",
      profile: "vinit",
      jobTitle: "Design",
      github: "https://github.com/heyvinit",
      twitter: "https://x.com/vinit_zupit",
      linkedin: "https://www.linkedin.com/in/heyvinit/",
   },
   aleem,
   {
      name: "Noah Gomes",
      role: "Engineering @ May Inc.",
      shortName: "Noah",
      profile: "noah",
      jobTitle: "Engineering",
      github: "https://github.com/NoahGdev",
      twitter: "https://x.com/NoxhDevs",
      linkedin: "https://www.linkedin.com/in/noah-gomes/",
      website: "https://inoah.dev",
   },
];
