import { SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";

type ErrorPageProps = {
   title: string;
   description: string;
   href?: string;
   linkLabel?: string;
};

const ErrorPage = ({
   title,
   description,
   href = SITE_PATHS.dashboard,
   linkLabel = "Go to dashboard",
}: ErrorPageProps) => (
   <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-title">{title}</h1>
      <p className="mt-3 max-w-md text-body">{description}</p>
      <Button asChild size="lg" className="mt-8 w-fit">
         <a href={href}>{linkLabel}</a>
      </Button>
   </main>
);

export default ErrorPage;
