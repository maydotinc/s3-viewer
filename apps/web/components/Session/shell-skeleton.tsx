// mirrors ViewerLayout's header and sidebar so the signed-in shell mounts without shifting
const ShellSkeleton = () => (
   <div
      aria-busy="true"
      className="flex h-dvh w-full flex-col overflow-hidden bg-viewerwhite"
   >
      <div className="h-16 w-full shrink-0 border-b border-viewerborder" />
      <div className="flex min-h-0 flex-1">
         <div className="hidden w-64 shrink-0 border-r border-viewerborder lg:block" />
      </div>
   </div>
);

export default ShellSkeleton;
