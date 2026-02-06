const InvitesHeader = () => {
   return (
      <div className="w-full box-border border-b flex border-viewerborder bg-viewerwhite px-8 py-4 gap-4 justify-between items-center min-h-[var(--header-height)]">
         <div className="flex flex-col max-md:hidden">
            <span className="text-viewerblack text-lg font-semibold leading-none">
               Manage Invites
            </span>
            <span className="text-viewertext text-md">
               Manage all of your sent and recieved server invites.
            </span>
         </div>
      </div>
   );
};

export default InvitesHeader;
