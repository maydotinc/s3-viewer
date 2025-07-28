const TosContentItem = ({
   title,
   children,
}: {
   title: string;
   children: React.ReactNode;
}) => {
   return (
      <div className="flex flex-col gap-4 items-start">
         <h3 className="text-2xl font-semibold text-viewerblack">{title}</h3>
         <span className="flex flex-col gap-2 text-viewertext">{children}</span>
      </div>
   );
};

const TosContent = () => {
   return (
      <div className="flex flex-col gap-10 sm:px-40">
         <TosContentItem title="Acceptance of Terms">
            By accessing and using the services provided by Crayo AI, you agree
            to be bound by these Terms of Service ("TOS"). If you do not agree
            to these terms, please do not use our services.
         </TosContentItem>
         <TosContentItem title="Description of Service">
            Crayo AI provides AI-powered editing tools designed to assist users
            in creating and editing content. Our services are subject to the
            terms and conditions outlined in this TOS.
         </TosContentItem>
         <TosContentItem title="Use of Service">
            You agree to use our services only for lawful purposes and in a
            manner that does not infringe on the rights of others or restrict
            their use of the service.
         </TosContentItem>
         <TosContentItem title="User Conduct">
            You agree to use our services only for lawful purposes and in a
            manner that does not infringe on the rights of others or restrict
            their use of the service.
         </TosContentItem>
         <TosContentItem title="Intellectual Property">
            You agree to use our services only for lawful purposes and in a
            manner that does not infringe on the rights of others or restrict
            their use of the service.
         </TosContentItem>
         <TosContentItem title="Termination">
            Our services are provided "as is" and without warranties of any
            kind, either express or implied. We do not guarantee the accuracy,
            reliability, or availability of our services.
         </TosContentItem>
         <TosContentItem title="Refund Policy">
            We do not offer refunds for any purchases made through our service.
            However, we may offer partial refunds in certain cases, such as when
            a service is not as described or when a service is not delivered as
            expected.
         </TosContentItem>
         <TosContentItem title="Disclaimer of Warranties">
            We do not offer refunds for any purchases made through our service.
            However, we may offer partial refunds in certain cases, such as when
            a service is not as described or when a service is not delivered as
            expected.
         </TosContentItem>
         <TosContentItem title="Age Restriction">
            We do not offer refunds for any purchases made through our service.
            However, we may offer partial refunds in certain cases, such as when
            a service is not as described or when a service is not delivered as
            expected.
         </TosContentItem>
         <TosContentItem title="Limitation of Liability">
            We do not offer refunds for any purchases made through our service.
            However, we may offer partial refunds in certain cases, such as when
            a service is not as described or when a service is not delivered as
            expected.
         </TosContentItem>
         <TosContentItem title="Changes to Terms">
            We do not offer refunds for any purchases made through our service.
            However, we may offer partial refunds in certain cases, such as when
            a service is not as described or when a service is not delivered as
            expected.
         </TosContentItem>
         <TosContentItem title="Governing Law">
            We do not offer refunds for any purchases made through our service.
            However, we may offer partial refunds in certain cases, such as when
            a service is not as described or when a service is not delivered as
            expected.
         </TosContentItem>
         <TosContentItem title="Contact Information">
            We do not offer refunds for any purchases made through our service.
            However, we may offer partial refunds in certain cases, such as when
            a service is not as described or when a service is not delivered as
            expected.
         </TosContentItem>
      </div>
   );
};

export default TosContent;
