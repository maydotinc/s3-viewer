import Image from "next/image";

const ROWS = [
   { name: "w-28", meta: "w-12" },
   { name: "w-36", meta: "w-10" },
   { name: "w-24", meta: "w-14" },
   { name: "w-32", meta: "w-12" },
   { name: "w-20", meta: "w-10" },
];

const BrandPanel = () => (
   <aside
      aria-hidden="true"
      className="relative hidden select-none overflow-hidden bg-viewerdarkblue lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12"
   >
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]">
         <defs>
            <pattern
               id="auth-grid"
               width="32"
               height="32"
               patternUnits="userSpaceOnUse"
            >
               <path
                  d="M32 0H0V32"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1"
               />
            </pattern>
         </defs>
         <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      <div className="relative flex w-full max-w-sm flex-col items-center gap-10">
         <Image
            src="/icons/whiteviewer.svg"
            alt=""
            width={208}
            height={47}
            priority
            draggable={false}
            className="h-9 w-auto"
         />

         <div className="w-full rounded-xl border border-white/15 bg-white/5 p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] motion-fade-up">
            <div className="mb-4 flex items-center gap-2">
               <span className="size-2 rounded-full bg-white/30" />
               <span className="h-2 w-24 rounded bg-white/30" />
            </div>
            <ul className="flex flex-col divide-y divide-white/10">
               {ROWS.map((row, index) => (
                  <li key={index} className="flex items-center gap-3 py-3">
                     <span className="size-4 rounded-sm border border-white/25" />
                     <span className={`h-2 rounded bg-white/25 ${row.name}`} />
                     <span
                        className={`ml-auto h-2 rounded bg-white/15 ${row.meta}`}
                     />
                  </li>
               ))}
            </ul>
         </div>

         <p className="text-balance text-center text-lg font-medium leading-7 text-white/90">
            Browse, upload and share files in any S3-compatible bucket.
         </p>
      </div>
   </aside>
);

export default BrandPanel;
