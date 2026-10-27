import {
   C,
   Card,
   Chip,
   FlowLine,
   HR,
   Icon,
   IllustrationFrame,
   keepIndent,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const POLICY: [string, boolean][] = [
   ['"Effect": "Allow",', false],
   ['"Action": "s3:ListBucket",', false],
   ['"Condition": {', false],
   ['  "StringLike": {', false],
   ['    "s3:prefix": [', true],
   ['      "invoices/*"', true],
   ["    ]", false],
   ["  }", false],
   ["}", false],
];

const TreeRow = ({
   y,
   name,
   depth = 0,
   role,
   selected,
   locked,
}: {
   y: number;
   name: string;
   depth?: number;
   role?: string;
   selected?: boolean;
   locked?: boolean;
}) => (
   <g transform={`translate(0 ${y})`}>
      {selected && (
         <rect width={208} height={32} fill={C.blue} opacity={0.06} />
      )}
      <Icon
         name={locked ? "lock" : "folder"}
         x={12 + depth * 20}
         y={8}
         color={locked ? C.light : depth ? C.light : C.blue}
         sw={1.4}
      />
      <Txt
         x={34 + depth * 20}
         y={20}
         fill={locked || depth ? C.light : C.black}
         mono
         size={11.5}
      >
         {name}
      </Txt>
      {role && (
         <Chip
            x={140}
            y={6}
            w={56}
            label={role}
            size={10}
            color={locked ? C.light : C.text}
         />
      )}
      <HR x={0} y={32} w={208} />
   </g>
);

export const PermissionsIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.permissions}>
      <SVGRoot>
         <FlowLine d="M232 120C244 120 244 176 256 176" />
         <circle cx={232} cy={120} r={3} fill={C.blue} />
         <circle cx={256} cy={176} r={3} fill={C.blue} />
         <Card x={24} y={40} w={208} h={272}>
            <Icon name="bucket" x={12} y={12} color={C.blue} sw={1.4} />
            <Txt x={36} y={25} weight={600} fill={C.black}>
               media-archive
            </Txt>
            <HR x={0} y={40} w={208} />
            <Txt x={12} y={58} size={10} fill={C.light} caps>
               PREFIXES
            </Txt>
            <TreeRow y={64} name="invoices/" role="Editor" selected />
            <TreeRow y={96} name="2026/" depth={1} />
            <TreeRow y={128} name="2025/" depth={1} />
            <TreeRow y={160} name="exports/" role="Viewer" />
            <TreeRow y={192} name="raw/" role="None" locked />
            <Txt x={12} y={250} size={10.5} fill={C.light}>
               Roles per prefix, not per key
            </Txt>
         </Card>
         <Card x={256} y={40} w={200} h={272}>
            <Txt x={12} y={25} weight={600} fill={C.black}>
               Bucket policy
            </Txt>
            <Chip x={152} y={10} w={36} label="IAM" mono size={10} />
            <HR x={0} y={40} w={200} />
            {POLICY.map(([line, hot], i) => (
               <g key={line} transform={`translate(0 ${64 + i * 18})`}>
                  {hot && (
                     <rect
                        x={6}
                        y={-13}
                        width={188}
                        height={18}
                        rx={4}
                        fill={C.blue}
                        opacity={0.08}
                     />
                  )}
                  <Txt
                     x={12}
                     y={0}
                     size={10}
                     fill={hot ? C.blue : C.text}
                     weight={hot ? 600 : 500}
                     mono
                  >
                     {keepIndent(line)}
                  </Txt>
               </g>
            ))}
            <Txt x={12} y={250} size={10.5} fill={C.light}>
               The condition everyone misses
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
