import {
   Btn,
   C,
   Card,
   Chip,
   Cursor,
   Fade,
   Field,
   Glide,
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

export const ShareLinkIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.shareLink}>
      <SVGRoot>
         <Card x={24} y={36} w={272} h={160}>
            <Crumb x={16} y={18} path="client-deliverables / " current="" />
            <HR x={0} y={28} w={272} />
            <ObjectRow
               x={0}
               y={28}
               w={272}
               name="brand-deck.pdf"
               size="4.2 MB"
               sizeX={172}
               menu
            />
            <ObjectRow
               x={0}
               y={60}
               w={272}
               name="q3-report.pdf"
               size="1.1 MB"
               sizeX={172}
               hover
               menu
            />
            <ObjectRow
               x={0}
               y={92}
               w={272}
               name="logo-final.png"
               size="93 KB"
               sizeX={172}
               menu
            />
            <ObjectRow
               x={0}
               y={124}
               w={272}
               name="contract.pdf"
               size="380 KB"
               sizeX={172}
               menu
            />
         </Card>
         <Card x={248} y={92} w={200} h={144}>
            <Txt x={16} y={26} weight={600} fill={C.black}>
               Share q3-report.pdf
            </Txt>
            <Field x={16} y={40} w={168}>
               <Txt x={10} y={18} size={10.5} fill={C.text} mono>
                  s3v.app/l/8f2a…q3
               </Txt>
               <Icon
                  name="copy"
                  x={144}
                  y={7}
                  size={14}
                  color={C.light}
                  sw={1.3}
               />
            </Field>
            <Icon
               name="clock"
               x={16}
               y={80}
               size={13}
               color={C.light}
               sw={1.3}
            />
            <Txt x={34} y={91} size={11} fill={C.light}>
               Expires in 15 min · read only
            </Txt>
            <Btn x={16} y={104} w={92} label="Copy link" icon="link" />
         </Card>
         <Cursor x={346} y={212} />
         <Chip x={24} y={252} w={96} label="Presigned URL" mono size={10} />
         <Chip x={128} y={252} w={112} label="No account needed" />
         <Txt x={24} y={296} size={10.5} fill={C.light}>
            For ongoing access, send an email invite.
         </Txt>
         <Motion
            still={
               <g transform="translate(272 288)">
                  <rect width={176} height={36} rx={8} fill={C.blue} />
                  <Icon name="check" x={12} y={10} color={C.white} sw={1.8} />
                  <Txt x={36} y={23} weight={600} fill={C.white}>
                     Link copied
                  </Txt>
                  <Txt
                     x={162}
                     y={23}
                     size={11}
                     fill={C.white}
                     mono
                     anchor="end"
                     opacity={0.75}
                  >
                     14:59
                  </Txt>
               </g>
            }
         >
            <g>
               <Glide
                  values="0 10;0 0;0 0;0 10"
                  keyTimes="0;.12;.88;1"
                  dur="5s"
               />
               <Fade values="0;1;1;0" keyTimes="0;.12;.88;1" dur="5s" />
               <g transform="translate(272 288)">
                  <rect width={176} height={36} rx={8} fill={C.blue} />
                  <Icon name="check" x={12} y={10} color={C.white} sw={1.8} />
                  <Txt x={36} y={23} weight={600} fill={C.white}>
                     Link copied
                  </Txt>
                  <Txt
                     x={162}
                     y={23}
                     size={11}
                     fill={C.white}
                     mono
                     anchor="end"
                     opacity={0.75}
                  >
                     14:59
                  </Txt>
               </g>
            </g>
         </Motion>
      </SVGRoot>
   </IllustrationFrame>
);
