import {
   Btn,
   C,
   Card,
   Chip,
   Field,
   Glide,
   Icon,
   IllustrationFrame,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const Shackle = () => (
   <path
      d="M352 54V48a8 8 0 0 1 16 0v6"
      stroke={C.blue}
      strokeWidth={2}
      strokeLinecap="round"
   />
);

const Endpoint = ({
   x,
   y,
   icon,
   label,
}: {
   x: number;
   y: number;
   icon: "monitor" | "server";
   label: string;
}) => (
   <g transform={`translate(${x} ${y})`}>
      <rect
         width={32}
         height={32}
         rx={8}
         fill={C.white}
         stroke={C.border}
         strokeWidth={1.25}
      />
      <Icon
         name={icon}
         x={8}
         y={8}
         color={C.text}
         sw={icon === "server" ? 1 : 1.4}
      />
      <Txt x={16} y={50} size={10} fill={C.text} anchor="middle">
         {label}
      </Txt>
   </g>
);

export const SecurityIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.security}>
      <SVGRoot>
         <path
            d="M96 164H384"
            stroke={C.border}
            strokeWidth={1.25}
            strokeDasharray="3 4"
         />
         <Endpoint x={64} y={148} icon="monitor" label="Browser" />
         <Endpoint x={384} y={148} icon="server" label="Server" />
         <Card x={112} y={48} w={256} h={232}>
            <Txt x={20} y={32} size={13} weight={600} fill={C.black}>
               Connect a server
            </Txt>
            <Txt x={20} y={48} size={10.5} fill={C.light}>
               Credentials are encrypted before
            </Txt>
            <Txt x={20} y={62} size={10.5} fill={C.light}>
               they leave your browser.
            </Txt>
            <Txt x={20} y={90} size={11} fill={C.black}>
               Access key ID
            </Txt>
            <Field x={20} y={98} w={216}>
               <Txt x={10} y={18} size={11} fill={C.black} mono>
                  AKIA •••• •••• 8F2A
               </Txt>
               <Icon
                  name="lock"
                  x={192}
                  y={7}
                  size={14}
                  color={C.light}
                  sw={1.3}
               />
            </Field>
            <Txt x={20} y={146} size={11} fill={C.black}>
               Secret access key
            </Txt>
            <Field x={20} y={154} w={216}>
               <Txt x={10} y={18} size={11} fill={C.light} mono>
                  •••• •••• •••• ••••
               </Txt>
               <Icon
                  name="lock"
                  x={192}
                  y={7}
                  size={14}
                  color={C.light}
                  sw={1.3}
               />
            </Field>
            <Chip
               x={20}
               y={196}
               w={128}
               label="Encrypted in browser"
               size={10.5}
            />
            <Btn x={160} y={192} w={76} label="Continue" />
         </Card>
         <circle
            cx={360}
            cy={64}
            r={22}
            fill={C.white}
            stroke={C.border}
            strokeWidth={1.25}
         />
         <rect x={350} y={62} width={20} height={14} rx={3} fill={C.blue} />
         <circle cx={360} cy={68} r={1.6} fill={C.white} />
         <g>
            <Glide values="0 -5;0 0;0 0" keyTimes="0;.25;1" dur="5s" />
            <Shackle />
         </g>

         <Chip x={84} y={300} w={80} label="MIT license" />
         <Chip x={172} y={300} w={92} label="Self-hostable" />
         <Chip x={272} y={300} w={124} label="Zero object retention" />
      </SVGRoot>
   </IllustrationFrame>
);
