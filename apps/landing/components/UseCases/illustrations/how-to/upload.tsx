import {
   C,
   Card,
   Chip,
   DashLine,
   Glide,
   Icon,
   IllustrationFrame,
   Motion,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const FlowNode = ({
   y,
   icon,
   title,
   sub,
   mono,
}: {
   y: number;
   icon: "monitor" | "server" | "bucket";
   title: string;
   sub: string;
   mono?: boolean;
}) => (
   <Card x={320} y={y} w={136} h={44}>
      <Icon
         name={icon}
         x={12}
         y={14}
         color={icon === "server" ? C.blue : C.text}
         sw={icon === "server" ? 1 : 1.4}
      />
      <Txt x={36} y={19} size={11} weight={600} fill={C.black} mono={mono}>
         {title}
      </Txt>
      <Txt x={36} y={33} size={10} fill={C.light}>
         {sub}
      </Txt>
   </Card>
);

export const UploadIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.upload}>
      <SVGRoot>
         <Card
            x={24}
            y={44}
            w={272}
            h={168}
            dash="6 4"
            stroke={C.blue}
            shadow={false}
         >
            <Icon
               name="upload"
               x={120}
               y={36}
               size={32}
               color={C.blue}
               sw={0.9}
            />
            <Txt
               x={136}
               y={96}
               size={13}
               weight={600}
               fill={C.black}
               anchor="middle"
            >
               Drop files to upload
            </Txt>
            <Txt x={136} y={114} size={11} fill={C.light} anchor="middle">
               or click to browse
            </Txt>
         </Card>
         <g>
            <Glide values="-72 -96;0 0;0 0" keyTimes="0;.4;1" dur="5s" />
            <Card x={92} y={168} w={140} h={32} rx={6}>
               <Icon name="file" x={10} y={8} color={C.light} sw={1.4} />
               <Txt x={32} y={20} size={11} fill={C.black}>
                  export.mp4
               </Txt>
               <Txt x={130} y={20} size={10} fill={C.light} anchor="end">
                  80 MB
               </Txt>
            </Card>
         </g>

         <Card x={24} y={236} w={272} h={64}>
            <Icon name="file" x={12} y={12} color={C.light} sw={1.4} />
            <Txt x={36} y={24} fill={C.black}>
               export.mp4
            </Txt>
            <Txt
               x={260}
               y={24}
               size={11}
               weight={600}
               fill={C.blue}
               anchor="end"
            >
               62%
            </Txt>
            <Txt x={36} y={38} size={10} fill={C.light}>
               49.8 of 80.3 MB · multipart, part 8 of 13
            </Txt>
            <rect x={12} y={48} width={248} height={6} rx={3} fill={C.border} />
            <Motion
               still={
                  <rect
                     x={12}
                     y={48}
                     width={154}
                     height={6}
                     rx={3}
                     fill={C.blue}
                  />
               }
            >
               <g transform="translate(12 48)">
                  <rect width={248} height={6} rx={3} fill={C.blue}>
                     <Glide
                        type="scale"
                        values="0 1;.62 1;.62 1"
                        keyTimes="0;.55;1"
                        dur="5s"
                     />
                  </rect>
               </g>
            </Motion>
         </Card>
         <FlowNode
            y={52}
            icon="monitor"
            title="Your browser"
            sub="no keys here"
         />
         <DashLine d="M388 96V128" />
         <FlowNode
            y={128}
            icon="server"
            title="S3 Viewer server"
            sub="streams · retries"
         />
         <DashLine d="M388 172V204" />
         <FlowNode
            y={204}
            icon="bucket"
            title="media-archive"
            sub="no CORS setup"
            mono
         />
         <Chip
            x={320}
            y={268}
            w={136}
            label="Server-side streaming"
            size={10.5}
         />
         <Chip
            x={320}
            y={296}
            w={136}
            label="Multipart over 5 GB"
            size={10.5}
         />
      </SVGRoot>
   </IllustrationFrame>
);
