import {
   Avatar,
   Btn,
   C,
   Card,
   Chip,
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

export const ShareNonTechnicalIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.shareNonTechnical}>
      <SVGRoot>
         <Card x={24} y={66} w={192} h={192}>
            <Avatar x={28} y={26} initials="M" />
            <Txt x={48} y={23} weight={600} fill={C.black}>
               Mike Chen
            </Txt>
            <Txt x={48} y={37} size={10} fill={C.light}>
               via S3 Viewer
            </Txt>
            <HR x={0} y={52} w={192} />
            <Txt x={16} y={76} size={11}>
               You&apos;ve been invited to view
            </Txt>
            <Txt x={16} y={96} weight={600} fill={C.black} mono>
               client-deliverables
            </Txt>
            <Txt x={16} y={124} size={11} fill={C.light}>
               Role
            </Txt>
            <Chip x={44} y={110} w={56} label="Viewer" />
            <Btn x={16} y={144} w={108} label="Open bucket" />
            <Txt x={16} y={186} size={10} fill={C.light}>
               No AWS account needed
            </Txt>
         </Card>
         <path
            d="M216 168H248"
            stroke={C.light}
            strokeWidth={1.25}
            strokeDasharray="3 4"
         />
         <path
            d="M244 164l4 4-4 4"
            stroke={C.light}
            strokeWidth={1.25}
            strokeLinecap="round"
         />
         <Card x={252} y={42} w={204} h={256}>
            <Txt x={12} y={24} weight={600} fill={C.black}>
               client-deliverables
            </Txt>
            <Chip x={128} y={10} w={64} label="Read only" />
            <HR x={0} y={40} w={204} />
            <SearchBox x={12} y={52} w={180} h={24} />
            <HeaderRow
               x={0}
               y={88}
               w={204}
               h={22}
               cols={[
                  { label: "Name", x: 12 },
                  { label: "Size", x: 140 },
               ]}
            />
            <ObjectRow
               x={0}
               y={110}
               w={204}
               h={30}
               name="brand-deck.pdf"
               size="4.2 MB"
               sizeX={140}
            />
            <ObjectRow
               x={0}
               y={140}
               w={204}
               h={30}
               name="q3-report.pdf"
               size="1.1 MB"
               sizeX={140}
            />
            <ObjectRow
               x={0}
               y={170}
               w={204}
               h={30}
               name="photos/"
               kind="folder"
            />
            <ObjectRow
               x={0}
               y={200}
               w={204}
               h={30}
               name="contract.pdf"
               size="380 KB"
               sizeX={140}
            />
            <Txt x={12} y={246} size={10} fill={C.light}>
               View and download only
            </Txt>
         </Card>
         <g transform="translate(24 288)">
            <rect
               width={32}
               height={24}
               rx={6}
               fill={C.white}
               stroke={C.border}
               strokeWidth={1.25}
            />
            <Icon name="x" x={9} y={5} size={14} color={C.light} />
         </g>
         <Txt x={68} y={299} size={11} weight={600} fill={C.black}>
            Remove member
         </Txt>
         <Txt x={68} y={313} size={10} fill={C.light}>
            Revoke access in one click
         </Txt>
         <g>
            <Glide values="72 84;0 0;0 0" keyTimes="0;.45;1" dur="4.5s" />
            <Cursor x={128} y={226} />
         </g>
      </SVGRoot>
   </IllustrationFrame>
);
