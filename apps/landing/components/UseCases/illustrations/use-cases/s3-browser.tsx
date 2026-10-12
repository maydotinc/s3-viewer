import {
   Btn,
   C,
   Card,
   Cursor,
   Glide,
   HR,
   HeaderRow,
   Icon,
   IllustrationFrame,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";
import { SearchBox } from "./parts";

const FILES: [string, string][] = [
   ["animated.gif", "1.88 MB"],
   ["clip.mp4", "15.95 MB"],
   ["compressed.zip", "487.53 KB"],
   ["export.mp4", "80.25 MB"],
   ["image.png", "93.03 KB"],
   ["laughing.gif", "122.3 KB"],
];

const MenuItem = ({
   y,
   icon,
   label,
   danger,
}: {
   y: number;
   icon: "pencil" | "link" | "download" | "trash";
   label: string;
   danger?: boolean;
}) => (
   <g transform={`translate(0 ${y})`}>
      <Icon
         name={icon}
         x={12}
         y={6}
         size={14}
         color={danger ? C.red : C.text}
      />
      <Txt x={34} y={18} size={12} fill={danger ? C.red : C.black}>
         {label}
      </Txt>
   </g>
);

export const S3BrowserIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.s3Browser}>
      <SVGRoot>
         <Card x={24} y={28} w={432} h={304}>
            <SearchBox x={12} y={12} w={144} />
            <Btn x={164} y={12} w={96} label="Rows (100)" kind="ghost" />
            <Icon name="chevronDown" x={240} y={18} size={14} color={C.light} />
            <Btn x={356} y={12} w={64} label="New" kind="primary" icon="plus" />
            <HeaderRow
               x={0}
               y={52}
               w={432}
               check="none"
               cols={[
                  { label: "Name", x: 56 },
                  { label: "Size", x: 232 },
                  { label: "Modified", x: 312 },
               ]}
            />
            <ObjectRow
               x={0}
               y={76}
               w={432}
               name="backup/"
               kind="folder"
               sizeX={232}
            />
            {FILES.map(([n, s], i) => (
               <ObjectRow
                  key={n}
                  x={0}
                  y={108 + i * 32}
                  w={432}
                  name={n}
                  size={s}
                  date="2026-09-05"
                  sizeX={232}
                  dateX={312}
                  check={i === 1}
                  selected={i === 1}
                  menu
               />
            ))}
            <Card x={216} y={152} w={140} h={130} shadow>
               <g>
                  <Glide
                     values="0 0;0 0;0 28;0 28;0 56;0 56;0 0"
                     keyTimes="0;.3;.36;.6;.66;.92;1"
                     dur="6s"
                  />
                  <rect
                     x={4}
                     y={6}
                     width={132}
                     height={28}
                     rx={6}
                     fill={C.gray}
                  />
               </g>

               <MenuItem y={6} icon="pencil" label="Rename" />
               <MenuItem y={34} icon="link" label="Copy link" />
               <MenuItem y={62} icon="download" label="Download" />
               <HR x={0} y={94} w={140} />
               <MenuItem y={98} icon="trash" label="Delete" danger />
            </Card>
         </Card>
         <g>
            <Glide
               values="0 0;0 0;0 28;0 28;0 56;0 56;0 0"
               keyTimes="0;.3;.36;.6;.66;.92;1"
               dur="6s"
            />
            <Cursor x={324} y={194} />
         </g>
      </SVGRoot>
   </IllustrationFrame>
);
