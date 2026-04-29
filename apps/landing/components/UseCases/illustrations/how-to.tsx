import { IllustrationFrame, SVGRoot } from "./shared";

const FileGlyph = ({
   x,
   y,
   label,
   filled = false,
}: {
   x: number;
   y: number;
   label?: string;
   filled?: boolean;
}) => (
   <g transform={`translate(${x} ${y})`}>
      <path
         d="M0 0 H50 L66 16 V80 H0 Z"
         fill={filled ? "currentColor" : "#ffffff"}
         strokeWidth="1.4"
      />
      <path d="M50 0 V16 H66" />
      {label && (
         <text
            x="33"
            y="56"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="10"
            fontWeight="600"
            stroke="none"
            fill={filled ? "#ffffff" : "currentColor"}
            opacity={filled ? 1 : 0.85}
         >
            {label}
         </text>
      )}
   </g>
);

const BucketGlyph = ({
   x,
   y,
   label,
   highlight = false,
}: {
   x: number;
   y: number;
   label?: string;
   highlight?: boolean;
}) => (
   <g transform={`translate(${x} ${y})`}>
      <path
         d="M0 12 L80 12 L74 70 a8 8 0 0 1-8 7 H14 a8 8 0 0 1-8-7 Z"
         fill={highlight ? "currentColor" : "#ffffff"}
         strokeWidth="1.4"
      />
      <path d="M14 12 a26 26 0 0 1 52 0" />
      {label && (
         <text
            x="40"
            y="50"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="11"
            fontWeight="600"
            stroke="none"
            fill={highlight ? "#ffffff" : "currentColor"}
         >
            {label}
         </text>
      )}
   </g>
);

export const RenameIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <FileGlyph x={60} y={120} label="old" />
         <FileGlyph x={354} y={120} label="new" filled />
         <path
            d="M132 130 C 200 70, 300 70, 354 130"
            strokeWidth="2"
            fill="none"
         />
         <path
            d="M348 122 L356 130 L348 138"
            fill="none"
            strokeWidth="2"
         />
         <text
            x="240"
            y="240"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="11"
            fontWeight="500"
            stroke="none"
            fill="currentColor"
            opacity="0.55"
         >
            copy + delete
         </text>
      </SVGRoot>
   </IllustrationFrame>
);

export const ShareLinkIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <FileGlyph x={80} y={120} />
         <g transform="translate(290 110)">
            <rect
               width="120"
               height="80"
               rx="8"
               fill="currentColor"
               strokeWidth="1.6"
            />
            <path
               d="M0 0 L60 50 L120 0"
               stroke="#ffffff"
               strokeWidth="1.6"
               fill="none"
            />
         </g>
         <line x1="146" y1="160" x2="290" y2="160" />
      </SVGRoot>
   </IllustrationFrame>
);

export const InviteIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <g transform="translate(140 110)">
            <path
               d="M0 16 L120 16 L112 96 a10 10 0 0 1-10 9 H18 a10 10 0 0 1-10-9 Z"
               fill="#ffffff"
               strokeWidth="1.4"
            />
            <path d="M20 16 a40 40 0 0 1 80 0" />
         </g>
         <g transform="translate(248 102)">
            <circle
               r="16"
               fill="currentColor"
               stroke="currentColor"
            />
            <line
               x1="-8"
               y1="0"
               x2="8"
               y2="0"
               stroke="#ffffff"
               strokeWidth="2.5"
            />
            <line
               x1="0"
               y1="-8"
               x2="0"
               y2="8"
               stroke="#ffffff"
               strokeWidth="2.5"
            />
         </g>
         <path
            d="M268 110 L 360 110"
            strokeDasharray="3 5"
            opacity="0.5"
            fill="none"
         />
         <circle cx="380" cy="110" r="14" fill="#ffffff" />
      </SVGRoot>
   </IllustrationFrame>
);

export const SideBySideIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <rect
            x="80"
            y="80"
            width="160"
            height="160"
            rx="10"
            fill="#ffffff"
         />
         <rect
            x="240"
            y="80"
            width="160"
            height="160"
            rx="10"
            fill="#ffffff"
         />
         <line
            x1="240"
            y1="80"
            x2="240"
            y2="240"
            stroke="currentColor"
            strokeWidth="3"
         />
         <text
            x="160"
            y="170"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="20"
            fontWeight="700"
            stroke="none"
            fill="currentColor"
         >
            S3
         </text>
         <text
            x="320"
            y="170"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="20"
            fontWeight="700"
            stroke="none"
            fill="currentColor"
         >
            R2
         </text>
      </SVGRoot>
   </IllustrationFrame>
);

export const SwitchBucketsIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <g transform="translate(150 70)">
            <rect
               width="180"
               height="56"
               rx="12"
               fill="currentColor"
               stroke="currentColor"
            />
            <text
               x="90"
               y="38"
               textAnchor="middle"
               fontFamily="ui-monospace, monospace"
               fontSize="18"
               fontWeight="700"
               stroke="none"
               fill="#ffffff"
            >
               ⌘ K
            </text>
         </g>
         <BucketGlyph x={200} y={160} />
         <BucketGlyph x={200} y={220} highlight />
      </SVGRoot>
   </IllustrationFrame>
);

export const UploadIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <g transform="translate(70 90)">
            <rect width="100" height="140" rx="8" fill="#ffffff" />
            <line
               x1="50"
               y1="0"
               x2="50"
               y2="140"
               stroke="currentColor"
               strokeWidth="3"
            />
            <line x1="0" y1="46" x2="100" y2="46" opacity="0.4" />
            <line x1="0" y1="92" x2="100" y2="92" opacity="0.4" />
         </g>
         <line x1="200" y1="160" x2="290" y2="160" />
         <path d="M283 152 L292 160 L283 168" fill="none" />
         <BucketGlyph x={320} y={120} />
      </SVGRoot>
   </IllustrationFrame>
);

export const DownloadIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <BucketGlyph x={200} y={60} />
         <line
            x1="240"
            y1="170"
            x2="240"
            y2="220"
            stroke="currentColor"
            strokeWidth="3"
         />
         <path
            d="M228 210 L240 224 L252 210"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
         />
         <FileGlyph x={207} y={232} />
      </SVGRoot>
   </IllustrationFrame>
);

export const PermissionsIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <g transform="translate(170 80)">
            <path
               d="M0 16 L140 16 L130 152 a10 10 0 0 1-10 9 H20 a10 10 0 0 1-10-9 Z"
               fill="#ffffff"
               strokeWidth="1.4"
            />
            <path d="M22 16 a48 48 0 0 1 96 0" />
            <line x1="6" y1="92" x2="134" y2="92" strokeDasharray="3 4" />
         </g>
         <g transform="translate(228 196)">
            <rect
               x="0"
               y="14"
               width="24"
               height="18"
               rx="3"
               fill="currentColor"
               stroke="currentColor"
            />
            <path
               d="M5 14 V8 a7 7 0 0 1 14 0 V11"
               fill="none"
               stroke="currentColor"
               strokeWidth="1.6"
            />
         </g>
      </SVGRoot>
   </IllustrationFrame>
);

export const SearchIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <BucketGlyph x={80} y={200} />
         <BucketGlyph x={200} y={200} highlight />
         <BucketGlyph x={320} y={200} />
         <g transform="translate(220 70)">
            <circle cx="0" cy="0" r="42" fill="#ffffff" strokeWidth="1.6" />
            <line
               x1="30"
               y1="30"
               x2="58"
               y2="58"
               stroke="currentColor"
               strokeWidth="6"
            />
            <line
               x1="30"
               y1="30"
               x2="50"
               y2="50"
               stroke="currentColor"
               strokeWidth="6"
            />
            <circle
               cx="58"
               cy="58"
               r="6"
               fill="currentColor"
               stroke="none"
            />
         </g>
      </SVGRoot>
   </IllustrationFrame>
);

export const DeleteIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <FileGlyph x={180} y={100} />
         <line
            x1="170"
            y1="200"
            x2="260"
            y2="100"
            stroke="currentColor"
            strokeWidth="3"
         />
         <circle
            cx="290"
            cy="190"
            r="5"
            fill="currentColor"
            stroke="none"
         />
         <text
            x="304"
            y="194"
            fontFamily="ui-monospace, monospace"
            fontSize="10"
            fontWeight="500"
            stroke="none"
            fill="currentColor"
            opacity="0.55"
         >
            delete marker
         </text>
      </SVGRoot>
   </IllustrationFrame>
);
