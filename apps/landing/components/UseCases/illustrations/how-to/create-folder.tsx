import {
   Btn,
   C,
   Card,
   Chip,
   Fade,
   FlowLine,
   Glide,
   HR,
   HeaderRow,
   Icon,
   IllustrationFrame,
   MONO,
   Motion,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";
import { Crumb } from "./parts";

const FLAT_KEYS: [
   prefix: string,
   rest: string,
   hot: boolean,
   placeholder: boolean,
][] = [
   ["reports/", "", false, true],
   ["reports/2026/", "q3.pdf", true, false],
   ["reports/2026/", "q4.pdf", true, false],
   ["reports/2025/", "q4.pdf", false, false],
   ["reports/", "index.csv", false, false],
];

export const CreateFolderIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.createFolder}>
      <SVGRoot>
         <FlowLine d="M256 112C266 112 266 133 276 133" />
         <circle cx={256} cy={112} r={3} fill={C.blue} />
         <circle cx={276} cy={133} r={3} fill={C.blue} />
         <Card x={24} y={36} w={232} h={288}>
            <Crumb x={16} y={20} path="media-archive / " current="reports /" />
            <Btn x={160} y={8} w={64} h={24} label="Upload" />
            <HR x={0} y={36} w={232} />
            <HeaderRow
               x={0}
               y={36}
               w={232}
               cols={[
                  { label: "Name", x: 34 },
                  { label: "Size", x: 168 },
               ]}
            />
            <ObjectRow
               x={0}
               y={60}
               w={232}
               name="2026/"
               kind="folder"
               size="—"
               sizeX={168}
               selected
            />
            <ObjectRow
               x={0}
               y={92}
               w={232}
               name="2025/"
               kind="folder"
               size="—"
               sizeX={168}
            />
            <ObjectRow
               x={0}
               y={124}
               w={232}
               name="index.csv"
               size="12 KB"
               sizeX={168}
            />
            <g transform="translate(16 176)">
               <rect
                  width={200}
                  height={84}
                  rx={8}
                  fill={C.white}
                  stroke={C.blue}
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                  opacity={0.7}
               />
               <Icon
                  name="upload"
                  x={92}
                  y={22}
                  size={16}
                  color={C.blue}
                  sw={1.4}
               />
               <Txt x={100} y={58} size={10.5} fill={C.text} anchor="middle">
                  Drop a folder to create it
               </Txt>
            </g>
            <Motion
               still={
                  <Chip
                     x={72}
                     y={66}
                     w={88}
                     label="q3.pdf"
                     mono
                     size={10}
                     fill={C.white}
                     color={C.black}
                  />
               }
            >
               <g>
                  <Glide
                     values="72 214;72 214;72 66;72 66"
                     keyTimes="0;.15;.5;1"
                     dur="5s"
                  />
                  <g>
                     <Fade
                        values="0;1;1;1;0"
                        keyTimes="0;.1;.5;.9;1"
                        dur="5s"
                     />
                     <rect
                        width={88}
                        height={20}
                        rx={4}
                        fill={C.white}
                        stroke={C.border}
                        strokeWidth={1.25}
                     />
                     <Icon
                        name="file"
                        x={6}
                        y={2}
                        size={14}
                        color={C.light}
                        sw={1.4}
                     />
                     <Txt x={24} y={14} size={10} fill={C.black} mono>
                        q3.pdf
                     </Txt>
                  </g>
               </g>
            </Motion>
            <Txt x={16} y={278} size={10.5} fill={C.light}>
               Folders appear when a key needs them.
            </Txt>
         </Card>
         <Card x={276} y={36} w={180} h={288}>
            <Txt x={12} y={24} size={10} fill={C.light} caps>
               WHAT S3 STORES
            </Txt>
            <Chip x={128} y={10} w={40} label="flat" mono size={10} />
            <HR x={0} y={36} w={180} />
            {FLAT_KEYS.map(([prefix, rest, hot, placeholder], i) => (
               <g key={prefix + rest} transform={`translate(0 ${58 + i * 26})`}>
                  {hot && (
                     <rect
                        x={6}
                        y={-14}
                        width={168}
                        height={22}
                        rx={4}
                        fill={C.blue}
                        opacity={0.08}
                     />
                  )}
                  <text
                     x={12}
                     y={0}
                     fontSize={10}
                     fontWeight={500}
                     fontFamily={MONO}
                     fill={placeholder ? C.light : C.text}
                  >
                     <tspan
                        fill={hot ? C.blue : placeholder ? C.light : C.text}
                        fontWeight={hot ? 600 : 500}
                     >
                        {prefix}
                     </tspan>
                     <tspan fill={placeholder ? C.light : C.black}>
                        {rest}
                     </tspan>
                  </text>
                  {placeholder && (
                     <Txt x={130} y={0} size={9.5} fill={C.light} mono>
                        0 B
                     </Txt>
                  )}
               </g>
            ))}
            <Motion
               still={
                  <g transform="translate(0 84)">
                     <rect
                        x={6}
                        y={-14}
                        width={168}
                        height={22}
                        rx={4}
                        fill={C.blue}
                        opacity={0.08}
                     />
                  </g>
               }
            >
               <g transform="translate(0 84)">
                  <Fade values="0;0;1;1;0" keyTimes="0;.5;.56;.9;1" dur="5s" />
                  <rect
                     x={6}
                     y={-14}
                     width={168}
                     height={22}
                     rx={4}
                     fill="none"
                     stroke={C.blue}
                     strokeWidth={1.25}
                  />
               </g>
            </Motion>
            <HR x={0} y={200} w={180} />
            <Txt x={12} y={222} size={10} fill={C.light} caps>
               LIST WITH
            </Txt>
            <Txt x={12} y={242} size={10} fill={C.text} mono>
               Prefix=&quot;reports/&quot;
            </Txt>
            <Txt x={12} y={258} size={10} fill={C.text} mono>
               Delimiter=&quot;/&quot;
            </Txt>
            <Txt x={12} y={280} size={10.5} fill={C.light}>
               → CommonPrefixes = folders
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
