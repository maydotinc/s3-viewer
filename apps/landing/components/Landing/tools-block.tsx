import Image from "next/image";
import BasicBlock, { SectionHeading } from "../basic-block";

const TOOLS_SVG = "/landing/tools.svg";
const TOOLS_ALT =
   "Next.js, TypeScript, React and the other tools S3 Viewer is built with";

// tile boxes inside tools.svg, in its 953x393 coordinate space. phones get a
// grid of these crops instead of the full diagram, which is unreadable there.
type Tile = { label: string; box: [number, number, number, number] };

const TILES: Tile[] = [
   { label: "PostgreSQL", box: [175, 31, 88, 86] },
   { label: "TanStack Virtual", box: [418, 38, 88, 86] },
   { label: "Better Auth", box: [731, 31, 88, 86] },
   { label: "Next.js", box: [291, 150, 88, 86] },
   { label: "S3 Viewer", box: [411, 141, 103, 104] },
   { label: "TanStack Query", box: [546, 150, 88, 86] },
   { label: "Zustand", box: [105, 269, 88, 86] },
   { label: "Tailwind", box: [418, 269, 88, 86] },
   { label: "Prisma", box: [661, 269, 88, 86] },
];

const TileArt = ({ box }: Pick<Tile, "box">) => (
   <svg
      viewBox={box.join(" ")}
      aria-hidden
      className="size-16 shrink-0 select-none"
   >
      <image href={TOOLS_SVG} width={953} height={393} />
   </svg>
);

const ToolsBlock = () => {
   return (
      <BasicBlock>
         <SectionHeading
            eyebrow="Under the hood"
            title="Built with modern tools"
            description="Next.js, TypeScript and React — a thin client that stays fast as your buckets grow."
         />

         <ul
            aria-label={TOOLS_ALT}
            className="mt-10 grid grid-cols-3 gap-2 rounded-xl border border-viewerborder bg-viewergray p-3 md:hidden"
         >
            {TILES.map(({ label, box }) => (
               <li
                  key={label}
                  className="flex flex-col items-center gap-2 py-3 text-center"
               >
                  <TileArt box={box} />
                  <span className="text-xs font-medium text-viewertext">
                     {label}
                  </span>
               </li>
            ))}
         </ul>

         <div className="mt-10 hidden w-full items-center justify-center rounded-xl border border-viewerborder bg-viewergray p-10 md:flex">
            <Image
               src={TOOLS_SVG}
               alt={TOOLS_ALT}
               width={953}
               height={393}
               sizes="(max-width: 1023px) 90vw, 900px"
               draggable={false}
               className="h-auto w-full max-w-[900px] select-none"
            />
         </div>
      </BasicBlock>
   );
};

export default ToolsBlock;
