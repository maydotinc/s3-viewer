import {
   Btn,
   C,
   Card,
   Cursor,
   Glide,
   HeaderRow,
   Icon,
   IllustrationFrame,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const DELETE_ROWS: [string, string, boolean][] = [
   ["tmp-export-1.csv", "2.4 MB", true],
   ["tmp-export-2.csv", "2.4 MB", true],
   ["tmp-export-3.csv", "2.3 MB", true],
   ["report.pdf", "1.2 MB", false],
   ["logo.png", "93 KB", false],
   ["hero.mp4", "80.25 MB", false],
];

export const DeleteIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.delete}>
      <SVGRoot>
         <Card x={24} y={38} w={432} h={280}>
            <Txt x={12} y={30} weight={600} fill={C.black}>
               3 selected
            </Txt>
            <Btn
               x={88}
               y={12}
               w={80}
               label="Delete"
               kind="ghost"
               icon="trash"
               color={C.red}
            />
            <Btn x={356} y={12} w={64} label="New" icon="plus" />
            <HeaderRow
               x={0}
               y={52}
               w={432}
               check="mixed"
               cols={[
                  { label: "Name", x: 56 },
                  { label: "Size", x: 232 },
                  { label: "Modified", x: 312 },
               ]}
            />
            {DELETE_ROWS.map(([n, s, on], i) => (
               <ObjectRow
                  key={n}
                  x={0}
                  y={76 + i * 32}
                  w={432}
                  name={n}
                  size={s}
                  date="2026-09-05"
                  sizeX={232}
                  dateX={312}
                  check={on}
                  selected={on}
                  menu
               />
            ))}
            <rect
               width={432}
               height={280}
               rx={8}
               fill={C.black}
               opacity={0.05}
            />
         </Card>
         <Card x={104} y={122} w={272} h={168}>
            <Txt x={20} y={32} size={13} weight={600} fill={C.black}>
               Delete 3 objects?
            </Txt>
            <Txt x={20} y={52} size={11}>
               They will be removed from media-archive.
            </Txt>
            <rect x={20} y={66} width={232} height={44} rx={6} fill={C.gray} />
            <Icon
               name="info"
               x={30}
               y={80}
               size={14}
               color={C.light}
               sw={1.3}
            />
            <Txt x={50} y={84} size={10}>
               Versioning is on: S3 adds a delete marker,
            </Txt>
            <Txt x={50} y={98} size={10}>
               older versions stay recoverable.
            </Txt>
            <Btn x={60} y={124} w={64} label="Cancel" kind="ghost" />
            <Btn
               x={132}
               y={124}
               w={120}
               label="Delete 3 objects"
               kind="danger"
            />
         </Card>
         <g>
            <Glide values="84 64;0 0;0 0" keyTimes="0;.45;1" dur="4.5s" />
            <Cursor x={344} y={264} />
         </g>
      </SVGRoot>
   </IllustrationFrame>
);
