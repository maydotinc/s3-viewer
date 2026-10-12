import {
   Btn,
   C,
   Card,
   Chip,
   Fade,
   Field,
   FlowLine,
   HR,
   Icon,
   IllustrationFrame,
   Motion,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const IAM_POLICY: [string, boolean][] = [
   ['"Statement": [{', false],
   ['  "Effect": "Allow",', false],
   ['  "Action": [', false],
   ['    "s3:ListBucket",', false],
   ['    "s3:GetBucketLocation"', false],
   ["  ],", false],
   ['  "Resource":', false],
   ['    "arn:aws:s3:::media-archive"', true],
   ["}, {", false],
   ['  "Effect": "Allow",', false],
   ['  "Action": "s3:GetObject",', false],
   ['  "Resource":', false],
   ['    "arn:aws:s3:::media-archive/*"', true],
   ["}]", false],
];

export const IamReadOnlyIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.iamReadOnly}>
      <SVGRoot>
         <FlowLine d="M244 190C254 190 254 214 264 214" />
         <circle cx={244} cy={190} r={3} fill={C.blue} />
         <circle cx={264} cy={214} r={3} fill={C.blue} />
         <Card x={24} y={30} w={220} h={300}>
            <Icon name="shield" x={12} y={11} color={C.blue} sw={1.4} />
            <Txt x={36} y={24} weight={600} fill={C.black}>
               IAM policy
            </Txt>
            <Chip x={148} y={9} w={60} label="read-only" size={9.5} />
            <HR x={0} y={36} w={220} />
            {IAM_POLICY.map(([line, hot], i) => (
               <g key={line + i} transform={`translate(0 ${56 + i * 16})`}>
                  {hot && (
                     <rect
                        x={6}
                        y={-12}
                        width={208}
                        height={16}
                        rx={3}
                        fill={C.blue}
                        opacity={0.08}
                     />
                  )}
                  <Txt
                     x={12}
                     y={0}
                     size={9.5}
                     fill={hot ? C.blue : C.text}
                     weight={hot ? 600 : 500}
                     mono
                  >
                     {line.replace(/^ +/, (m) => "\u00A0".repeat(m.length))}
                  </Txt>
               </g>
            ))}
            <Txt x={12} y={288} size={10.5} fill={C.light}>
               Bucket ARN to list, /* to read objects.
            </Txt>
         </Card>
         <Card x={264} y={30} w={192} h={300}>
            <Txt x={12} y={24} weight={600} fill={C.black}>
               Connect server
            </Txt>
            <HR x={0} y={36} w={192} />
            <Txt x={12} y={56} size={10} fill={C.light}>
               Endpoint
            </Txt>
            <Field x={12} y={62} w={168} h={26}>
               <Txt x={8} y={17} size={9.5} fill={C.black} mono>
                  s3.us-east-1.amazonaws.com
               </Txt>
            </Field>
            <Txt x={12} y={106} size={10} fill={C.light}>
               Access key ID
            </Txt>
            <Field x={12} y={112} w={168} h={26}>
               <Txt x={8} y={17} size={9.5} fill={C.black} mono>
                  AKIA••••••••••••
               </Txt>
            </Field>
            <g transform="translate(12 150)">
               <rect width={168} height={38} rx={6} fill={C.gray} />
               <Icon
                  name="info"
                  x={8}
                  y={12}
                  size={13}
                  color={C.light}
                  sw={1.3}
               />
               <Txt x={26} y={16} size={9.5} fill={C.text}>
                  Can&apos;t list buckets, so
               </Txt>
               <Txt x={26} y={29} size={9.5} fill={C.text}>
                  name the ones it can read.
               </Txt>
            </g>
            <Txt x={12} y={208} size={10} fill={C.light}>
               Bucket names
            </Txt>
            <Field x={12} y={214} w={168} h={26} active>
               <Txt x={8} y={17} size={10} fill={C.black} mono>
                  media-archive
               </Txt>
               <Motion
                  still={
                     <Icon
                        name="check"
                        x={146}
                        y={6}
                        size={14}
                        color={C.blue}
                        sw={1.8}
                     />
                  }
               >
                  <g>
                     <Fade values="0;0;1;1" keyTimes="0;.45;.55;1" dur="4s" />
                     <Icon
                        name="check"
                        x={146}
                        y={6}
                        size={14}
                        color={C.blue}
                        sw={1.8}
                     />
                  </g>
                  <g>
                     <Fade values="1;1;0;0" keyTimes="0;.45;.55;1" dur="4s" />
                     <Icon
                        name="clock"
                        x={146}
                        y={6}
                        size={14}
                        color={C.light}
                        sw={1.4}
                     />
                  </g>
               </Motion>
            </Field>
            <Txt x={12} y={258} size={9.5} fill={C.light}>
               Reachable with HeadBucket · Viewer access
            </Txt>
            <Btn x={12} y={272} w={168} h={28} label="Connect" />
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
