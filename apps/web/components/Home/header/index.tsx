import ServerInfo from "./server-info";

const ServerHeader = () => (
   <header className="flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-viewerborder bg-viewerwhite px-6">
      <h1 className="text-base font-semibold text-viewerblack">Buckets</h1>
      <ServerInfo />
   </header>
);

export default ServerHeader;
