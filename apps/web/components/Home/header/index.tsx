import ServerInfo from "./server-info";

const ServerHeader = () => (
   <header className="flex min-h-[var(--header-height)] w-full items-center justify-between gap-4 border-b border-viewerborder bg-viewerwhite px-8 py-4">
      <div className="flex flex-col max-md:hidden">
         <h1 className="text-lg font-semibold leading-none text-viewerblack">
            Buckets
         </h1>
         <p className="hidden text-sm text-viewertext xl:block">
            Browse the buckets on this server and open one to see its objects.
         </p>
      </div>
      <ServerInfo />
   </header>
);

export default ServerHeader;
