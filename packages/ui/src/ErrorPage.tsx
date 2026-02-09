import { Button } from "@s3-viewer/ui/components/button";

type ErrorPageProps = { statusCode: number; errorTitle: string };

const ErrorPage = ({ statusCode, errorTitle }: ErrorPageProps) => {
   return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center px-4">
         <h1 className="text-8xl font-bold text-black">{statusCode}</h1>
         <p className="mt-4 text-center text-2xl text-gray-600">{errorTitle}</p>
         <Button asChild variant="secondary" size="lg" className="mt-4 w-fit">
            <a href="/dashboard">Go to dashboard</a>
         </Button>
      </div>
   );
};

export default ErrorPage;
