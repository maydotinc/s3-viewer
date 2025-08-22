import BasicBlock from "@/components/basic-block";
import Layout from "@/components/Layout";
import LegalLayout from "@/components/Legal/legal-layout";

const tosContent = [
   {
      title: "Acceptance of Terms",
      content:
         'By accessing and using the services provided by Crayo AI, you agree to be bound by these Terms of Service ("TOS"). If you do not agree to these terms, please do not use our services.',
   },
   {
      title: "Description of Service",
      content:
         "Crayo AI provides AI-powered editing tools designed to assist users in creating and editing content. Our services are subject to the terms and conditions outlined in this TOS.",
   },
   {
      title: "Use of Service",
      content:
         "You agree to use our services only for lawful purposes and in a manner that does not infringe on the rights of others or restrict their use of the service.",
   },
   {
      title: "User Conduct",
      content:
         "You agree to use our services only for lawful purposes and in a manner that does not infringe on the rights of others or restrict their use of the service.",
   },
   {
      title: "Intellectual Property",
      content:
         "You agree to use our services only for lawful purposes and in a manner that does not infringe on the rights of others or restrict their use of the service.",
   },
   {
      title: "Termination",
      content:
         'Our services are provided "as is" and without warranties of any kind, either express or implied. We do not guarantee the accuracy, reliability, or availability of our services.',
   },
   {
      title: "Refund Policy",
      content:
         "We do not offer refunds for any purchases made through our service. However, we may offer partial refunds in certain cases, such as when a service is not as described or when a service is not delivered as expected.",
   },
   {
      title: "Disclaimer of Warranties",
      content:
         "We do not offer refunds for any purchases made through our service. However, we may offer partial refunds in certain cases, such as when a service is not as described or when a service is not delivered as expected.",
   },
   {
      title: "Age Restriction",
      content:
         "We do not offer refunds for any purchases made through our service. However, we may offer partial refunds in certain cases, such as when a service is not as described or when a service is not delivered as expected.",
   },
   {
      title: "Limitation of Liability",
      content:
         "We do not offer refunds for any purchases made through our service. However, we may offer partial refunds in certain cases, such as when a service is not as described or when a service is not delivered as expected.",
   },
   {
      title: "Changes to Terms",
      content:
         "We do not offer refunds for any purchases made through our service. However, we may offer partial refunds in certain cases, such as when a service is not as described or when a service is not delivered as expected.",
   },
   {
      title: "Governing Law",
      content:
         "We do not offer refunds for any purchases made through our service. However, we may offer partial refunds in certain cases, such as when a service is not as described or when a service is not delivered as expected.",
   },
   {
      title: "Contact Information",
      content:
         "We do not offer refunds for any purchases made through our service. However, we may offer partial refunds in certain cases, such as when a service is not as described or when a service is not delivered as expected.",
   },
];

const TosPage = () => {
   return (
      <BasicBlock className="gap-30 max-md:gap-15 max-xl:gap-20">
         <LegalLayout
            title="Terms of Service"
            description="Please read these terms carefully before using S3-Viewer services"
            content={tosContent}
         />
      </BasicBlock>
   );
};

TosPage.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default TosPage;
