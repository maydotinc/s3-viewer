import {
   Btn,
   C,
   Card,
   Chip,
   HR,
   Icon,
   IllustrationFrame,
   Motion,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";
import { Crumb } from "./parts";

const Landing = () => (
   <g>
      <Icon name="file" x={-8} y={-8} color={C.blue} sw={1.5} />
   </g>
);

export const DownloadIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.download}>
      <SVGRoot>
         <Card x={24} y={52} w={288} h={140}>
            <Crumb x={16} y={18} path="media-archive / " current="exports /" />
            <HR x={0} y={28} w={288} />
            <ObjectRow
               x={0}
               y={28}
               w={288}
               h={40}
               name="report-2026-09.pdf"
               hover
            >
               <Btn
                  x={176}
                  y={6}
                  w={100}
                  label="Download"
                  kind="ghost"
                  icon="download"
               />
            </ObjectRow>
            <ObjectRow
               x={0}
               y={68}
               w={288}
               name="report-2026-08.pdf"
               size="1.1 MB"
               sizeX={176}
            />
            <ObjectRow
               x={0}
               y={100}
               w={288}
               name="summary.csv"
               size="84 KB"
               sizeX={176}
            />
         </Card>
         <path
            d="M300 100C372 100 342 150 342 232"
            stroke={C.border}
            strokeWidth={1.25}
            strokeDasharray="3 4"
         />
         <Chip
            x={24}
            y={216}
            w={204}
            label="Content-Disposition: attachment"
            mono
            size={10}
         />
         <Chip
            x={24}
            y={244}
            w={188}
            label='filename="report-2026-09.pdf"'
            mono
            size={10}
         />
         <Txt x={24} y={288} size={10.5} fill={C.light}>
            The object&apos;s own filename.
         </Txt>
         <Txt x={24} y={304} size={10.5} fill={C.light}>
            Keys never reach the browser.
         </Txt>
         <rect
            x={320}
            y={188}
            width={144}
            height={88}
            rx={6}
            fill={C.white}
            stroke={C.text}
            strokeWidth={1.5}
         />
         <path
            d="M310 284H474"
            stroke={C.text}
            strokeWidth={1.5}
            strokeLinecap="round"
         />
         <Txt x={332} y={208} size={10} fill={C.light} caps>
            DOWNLOADS
         </Txt>
         <rect x={326} y={218} width={132} height={28} rx={4} fill={C.gray} />
         <Txt x={358} y={236} size={8.5} fill={C.black} mono>
            report-2026-09.pdf
         </Txt>
         <Motion
            still={
               <g transform="translate(342 232)">
                  <Landing />
               </g>
            }
         >
            <g>
               <animateMotion
                  path="M300 100C372 100 342 150 342 232"
                  keyPoints="0;1;1"
                  keyTimes="0;.6;1"
                  calcMode="linear"
                  dur="4s"
                  repeatCount="indefinite"
               />
               <Landing />
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);
