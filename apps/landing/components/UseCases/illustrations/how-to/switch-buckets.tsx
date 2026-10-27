import {
   C,
   Card,
   Caret,
   Chip,
   Glide,
   HR,
   Icon,
   IllustrationFrame,
   MatchText,
   ProviderTile,
   SAMPLE_BUCKETS,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const PALETTE: [string, string][] = [
   ["packages", "May Inc."],
   ["paper-archive", "Backup S3"],
   ["parity-logs", "Lab MinIO"],
];

export const SwitchBucketsIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.switchBuckets}>
      <SVGRoot>
         <Card x={24} y={32} w={200} h={296}>
            <Txt x={12} y={24} size={10} fill={C.light} caps>
               SERVERS
            </Txt>
            <rect
               x={12}
               y={32}
               width={176}
               height={40}
               rx={8}
               fill={C.white}
               stroke={C.border}
               strokeWidth={1.25}
            />
            <circle cx={26} cy={52} r={3} fill={C.blue} />
            <ProviderTile x={38} y={40} provider="cloudflare" />
            <Txt x={70} y={56} weight={600} fill={C.black}>
               May Inc.
            </Txt>
            <Icon name="chevronsUpDown" x={160} y={44} color={C.light} />
            <Txt x={12} y={100} size={10} fill={C.light} caps>
               BUCKETS
            </Txt>
            <g>
               <Glide
                  values="0 -36;0 -36;0 0;0 0;0 36;0 36;0 -36;0 -36"
                  keyTimes="0;.28;.34;.6;.66;.92;.98;1"
                  dur="6s"
               />
               <rect
                  x={12}
                  y={144}
                  width={176}
                  height={36}
                  rx={6}
                  fill={C.gray}
               />
            </g>

            {SAMPLE_BUCKETS.map((b, i) => (
               <g key={b} transform={`translate(12 ${108 + i * 36})`}>
                  <Icon name="folder" x={10} y={10} color={C.blue} sw={1.4} />
                  <Txt
                     x={34}
                     y={22}
                     fill={C.black}
                     weight={i === 1 ? 600 : 500}
                  >
                     {b}
                  </Txt>
                  <Icon name="chevronRight" x={152} y={10} color={C.light} />
               </g>
            ))}
            <HR x={12} y={264} w={176} />
            <Chip x={12} y={276} w={32} label="⌘K" mono />
            <Txt x={52} y={290} size={11}>
               Jump to any bucket
            </Txt>
         </Card>
         <Card x={256} y={80} w={200} h={180}>
            <Icon name="search" x={12} y={11} size={14} color={C.light} />
            <Txt x={34} y={22} fill={C.black} mono>
               pa
            </Txt>
            <Caret x={51} y={10} />
            <Chip x={156} y={8} w={32} label="⌘K" mono />
            <HR x={0} y={36} w={200} />
            <Txt x={12} y={56} size={10} fill={C.light} caps>
               BUCKETS
            </Txt>
            {PALETTE.map(([b, s], i) => (
               <g key={b} transform={`translate(0 ${64 + i * 32})`}>
                  {i === 0 && (
                     <rect
                        x={6}
                        y={0}
                        width={188}
                        height={32}
                        rx={6}
                        fill={C.blue}
                        opacity={0.08}
                     />
                  )}
                  <Icon
                     name="folder"
                     x={14}
                     y={8}
                     color={i === 0 ? C.blue : C.light}
                     sw={1.4}
                  />
                  <Txt x={38} y={20} fill={C.black}>
                     <MatchText text={b} match="pa" />
                  </Txt>
                  <Txt x={188} y={20} size={10} fill={C.light} anchor="end">
                     {s}
                  </Txt>
               </g>
            ))}
            <Txt x={12} y={172} size={10} fill={C.light}>
               ↵ open · ↑↓ move · esc close
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
