import {
   BucketRows,
   Btn,
   C,
   Card,
   Chip,
   CloudflareGlyph,
   FlowLine,
   Glide,
   HR,
   HeaderRow,
   IllustrationFrame,
   SVGRoot,
   ServerHeader,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";
import { SearchBox } from "./parts";

export const CloudflareR2Illustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.cloudflareR2}>
      <SVGRoot>
         <g>
            <Glide values="-28 0;0 0;0 0" keyTimes="0;.3;1" dur="5s" />
            <FlowLine d="M176 168H272" width={2} />
            <rect x={270} y={159} width={16} height={18} rx={3} fill={C.blue} />
            <path
               d="M286 164h10M286 172h10"
               stroke={C.blue}
               strokeWidth={2}
               strokeLinecap="round"
            />
         </g>

         <Card x={8} y={96} w={184} h={144}>
            <rect x={16} y={16} width={40} height={40} rx={8} fill={C.gray} />
            <CloudflareGlyph x={22} y={22} size={28} />
            <Txt x={68} y={32} size={13} weight={600} fill={C.black}>
               Cloudflare R2
            </Txt>
            <Txt x={68} y={47} size={10.5} fill={C.light}>
               May Inc.
            </Txt>
            <HR x={0} y={68} w={184} />
            <Txt x={16} y={86} size={10} fill={C.light} caps>
               ENDPOINT
            </Txt>
            <Txt x={16} y={101} size={9} fill={C.black} mono>
               acme.r2.cloudflarestorage.com
            </Txt>
            <Chip x={16} y={114} w={88} label="region · auto" mono size={10} />
            <Chip x={112} y={114} w={48} label="S3 API" mono size={10} />
         </Card>
         <Chip x={196} y={132} w={88} label="S3-compatible" size={10} />
         <Txt x={240} y={198} size={10} fill={C.light} anchor="middle">
            no code changes
         </Txt>
         <Card x={296} y={48} w={168} h={264}>
            <ServerHeader w={168} name="May Inc." provider="cloudflare" />
            <SearchBox x={12} y={48} w={96} h={24} />
            <Btn x={116} y={48} w={40} h={24} label="New" />
            <HeaderRow
               x={0}
               y={84}
               w={168}
               h={22}
               cols={[{ label: "Bucket name", x: 12 }]}
            />
            <BucketRows y={106} w={168} rowH={34} />
            <Txt x={12} y={258} size={10} fill={C.light}>
               4 buckets · connected
            </Txt>
         </Card>
         <rect
            x={292}
            y={156}
            width={8}
            height={24}
            rx={2}
            fill={C.gray}
            stroke={C.border}
            strokeWidth={1.25}
         />
      </SVGRoot>
   </IllustrationFrame>
);
