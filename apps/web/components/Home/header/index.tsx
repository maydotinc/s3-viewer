import ServerInfo from "./server-info";

const ServerHeader = () => {
   return (
      <div className="w-full box-border border-b flex border-viewerborder bg-viewerwhite px-8 py-4 gap-4 justify-between items-center min-h-[var(--header-height)]">
         <div className="flex flex-col max-md:hidden">
            <span className="text-viewerblack text-lg font-semibold leading-none">
               Buckets Overview
            </span>
            <span className="text-viewertext text-md">
               Navigate through your buckets and view their contents
            </span>
         </div>

         <ServerInfo />
      </div>
   );
};

export default ServerHeader;
