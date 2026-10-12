import {
   C,
   Card,
   Chip,
   Fade,
   Glide,
   HR,
   Icon,
   IllustrationFrame,
   Motion,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const DENY_CHECKS: [string, string, "allow" | "deny" | "skip"][] = [
   ["IAM identity policy", "s3:GetObject on bucket/*", "allow"],
   ["Bucket policy", "Deny · aws:SourceIp", "deny"],
   ["Block Public Access", "not a public request", "skip"],
   ["KMS key policy", "kms:Decrypt granted", "allow"],
   ["Object ownership", "bucket owner enforced", "allow"],
   ["SCP / boundary", "no s3 restriction", "allow"],
];

const CheckRow = ({
   y,
   label,
   detail,
   state,
   w,
}: {
   y: number;
   label: string;
   detail: string;
   state: "allow" | "deny" | "skip";
   w: number;
}) => {
   const deny = state === "deny";
   const skip = state === "skip";
   return (
      <g transform={`translate(0 ${y})`}>
         <g transform="translate(14 6)">
            <circle
               cx={8}
               cy={8}
               r={8}
               fill={deny ? C.redBg : skip ? C.gray : C.blue}
               opacity={deny || skip ? 1 : 0.12}
            />
            <Icon
               name={deny ? "x" : skip ? "chevronRight" : "check"}
               x={2}
               y={2}
               size={12}
               color={deny ? C.red : skip ? C.light : C.blue}
               sw={1.8}
            />
         </g>
         <Txt
            x={42}
            y={18}
            size={11.5}
            weight={deny ? 600 : 500}
            fill={skip ? C.light : C.black}
         >
            {label}
         </Txt>
         <Txt
            x={w - 12}
            y={18}
            size={10}
            fill={deny ? C.red : C.light}
            mono
            anchor="end"
         >
            {detail}
         </Txt>
         <HR x={0} y={28} w={w} />
      </g>
   );
};

export const AccessDeniedIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.accessDenied}>
      <SVGRoot>
         <Card x={24} y={30} w={432} h={62} fill={C.redBg} stroke="#F8C9CD">
            <g transform="translate(16 17)">
               <circle cx={14} cy={14} r={14} fill={C.white} />
               <Icon name="lock" x={6} y={6} size={16} color={C.red} sw={1.6} />
            </g>
            <Txt x={60} y={28} size={13} weight={600} fill={C.red} mono>
               403 AccessDenied
            </Txt>
            <Txt x={60} y={46} size={10.5} fill={C.text} mono>
               GetObject s3://media-archive/exports/q3.pdf
            </Txt>
            <Chip
               x={332}
               y={21}
               w={84}
               label="authenticated"
               size={9.5}
               fill={C.white}
               color={C.text}
            />
         </Card>
         <Card x={24} y={106} w={432} h={244}>
            <Txt x={12} y={24} size={10} fill={C.light} caps>
               WHERE THE DENY COMES FROM
            </Txt>
            <Txt x={420} y={24} size={10} fill={C.light} anchor="end">
               evaluated together
            </Txt>
            <HR x={0} y={36} w={432} />
            <Motion
               still={
                  <rect
                     x={4}
                     y={68}
                     width={424}
                     height={28}
                     rx={5}
                     fill={C.red}
                     fillOpacity={0.06}
                  />
               }
            >
               <g>
                  <Glide
                     values="0 0;0 0;0 28;0 28;0 28;0 0"
                     keyTimes="0;.22;.4;.9;.96;1"
                     dur="5.5s"
                  />
                  <rect
                     x={4}
                     y={40}
                     width={424}
                     height={28}
                     rx={5}
                     fill={C.blue}
                     fillOpacity={0.06}
                  >
                     <Fade
                        values="1;1;0;0;0;1"
                        keyTimes="0;.38;.42;.9;.96;1"
                        dur="5.5s"
                     />
                  </rect>
                  <rect
                     x={4}
                     y={40}
                     width={424}
                     height={28}
                     rx={5}
                     fill={C.red}
                     fillOpacity={0.06}
                  >
                     <Fade
                        values="0;0;1;1;0;0"
                        keyTimes="0;.4;.44;.9;.96;1"
                        dur="5.5s"
                     />
                  </rect>
               </g>
            </Motion>
            {DENY_CHECKS.map(([label, detail, state], i) => (
               <CheckRow
                  key={label}
                  y={40 + i * 28}
                  w={432}
                  label={label}
                  detail={detail}
                  state={state}
               />
            ))}
            <Icon
               name="info"
               x={12}
               y={220}
               size={13}
               color={C.light}
               sw={1.3}
            />
            <Txt x={31} y={230} size={10.5} fill={C.light}>
               One explicit Deny anywhere beats every Allow.
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
