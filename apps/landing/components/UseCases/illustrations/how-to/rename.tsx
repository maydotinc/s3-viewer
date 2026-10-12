import {
   C,
   Card,
   Caret,
   Chip,
   Field,
   HR,
   Icon,
   IllustrationFrame,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";
import { Crumb } from "./parts";

const Step = ({ x, y, n }: { x: number; y: number; n: string }) => (
   <g transform={`translate(${x} ${y})`}>
      <circle r={9} fill={C.white} stroke={C.border} strokeWidth={1.25} />
      <Txt x={0} y={3.5} size={10} weight={600} fill={C.black} anchor="middle">
         {n}
      </Txt>
   </g>
);

const Arrow = ({
   x,
   y,
   w,
   label,
}: {
   x: number;
   y: number;
   w: number;
   label: string;
}) => (
   <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0H${w}`} stroke={C.light} strokeWidth={1.25} />
      <path
         d={`M${w - 4} -4l4 4-4 4`}
         stroke={C.light}
         strokeWidth={1.25}
         strokeLinecap="round"
      />
      <Txt x={w / 2} y={-6} size={9.5} fill={C.blue} mono anchor="middle">
         {label}
      </Txt>
   </g>
);

export const RenameIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.rename}>
      <SVGRoot>
         <Card x={32} y={38} w={416} h={136}>
            <Crumb x={16} y={18} path="media-archive / " current="reports /" />
            <HR x={0} y={28} w={416} />
            <ObjectRow
               x={0}
               y={28}
               w={416}
               name="q3-summary.pdf"
               size="1.2 MB"
               sizeX={300}
            />
            <g transform="translate(0 60)">
               <rect width={416} height={44} fill={C.gray} />
               <Icon name="file" x={12} y={14} color={C.light} sw={1.4} />
               <Field x={34} y={8} w={200} active>
                  <Txt x={10} y={18} fill={C.black} mono>
                     report-2026-09.pdf
                  </Txt>
                  <Caret x={142} y={7} />
               </Field>
               <Txt x={250} y={26} size={10} fill={C.light}>
                  Enter to save · Esc to cancel
               </Txt>
               <HR x={0} y={44} w={416} />
            </g>
            <ObjectRow
               x={0}
               y={104}
               w={416}
               name="slides.key"
               size="48 MB"
               sizeX={300}
            />
         </Card>
         <Card x={32} y={182} w={416} h={136}>
            <Txt x={16} y={24} size={10} fill={C.light} caps>
               UNDER THE HOOD
            </Txt>
            <Step x={25} y={50} n="1" />
            <Chip
               x={44}
               y={40}
               w={112}
               label="report-final.pdf"
               mono
               size={10}
            />
            <Arrow x={164} y={50} w={64} label="CopyObject" />
            <Chip
               x={236}
               y={40}
               w={128}
               label="report-2026-09.pdf"
               mono
               size={10}
               color={C.black}
            />
            <Step x={25} y={90} n="2" />
            <g opacity={0.55}>
               <Chip
                  x={44}
                  y={80}
                  w={112}
                  label="report-final.pdf"
                  mono
                  size={10}
               />
               <line
                  x1={54}
                  y1={90}
                  x2={146}
                  y2={90}
                  stroke={C.text}
                  strokeWidth={1}
               />
            </g>
            <Arrow x={164} y={90} w={64} label="DeleteObject" />
            <Icon name="trash" x={236} y={82} color={C.light} sw={1.4} />
            <Txt x={258} y={94} size={11} fill={C.light}>
               old key removed
            </Txt>
            <Txt x={16} y={122} size={10.5} fill={C.light}>
               Same bytes under a new key. Metadata and tags are preserved.
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
