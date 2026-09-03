import { IllustrationFrame, SVGRoot } from "./shared";

export const MultiCloudIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <rect x="60" y="80" width="140" height="50" rx="8" />
         <text
            x="130"
            y="111"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="14"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
         >
            S3
         </text>

         <rect x="60" y="190" width="140" height="50" rx="8" />
         <text
            x="130"
            y="221"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="14"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
         >
            R2
         </text>
         <path d="M200 105 H260 V215 H200" />
         <rect
            x="280"
            y="100"
            width="160"
            height="120"
            rx="10"
            fill="#ffffff"
            strokeWidth="1.6"
         />
         <line x1="280" y1="130" x2="440" y2="130" />
         <circle cx="296" cy="115" r="2.5" fill="currentColor" stroke="none" />
         <circle cx="306" cy="115" r="2.5" fill="currentColor" stroke="none" />
         <circle cx="316" cy="115" r="2.5" fill="currentColor" stroke="none" />
         <line x1="296" y1="150" x2="424" y2="150" opacity="0.4" />
         <line x1="296" y1="170" x2="408" y2="170" opacity="0.4" />
         <line x1="296" y1="190" x2="416" y2="190" opacity="0.4" />
         <line x1="296" y1="210" x2="392" y2="210" opacity="0.4" />
      </SVGRoot>
   </IllustrationFrame>
);

export const ShareNonTechnicalIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <rect x="80" y="120" width="100" height="80" rx="8" />
         <line x1="100" y1="148" x2="160" y2="148" opacity="0.4" />
         <line x1="100" y1="164" x2="150" y2="164" opacity="0.4" />
         <line x1="100" y1="180" x2="155" y2="180" opacity="0.4" />
         <g transform="translate(218 134)">
            <rect
               x="0"
               y="20"
               width="44"
               height="32"
               rx="4"
               fill="currentColor"
               stroke="currentColor"
            />
            <path
               d="M9 20 V11 a13 13 0 0 1 26 0 V14"
               fill="none"
               stroke="currentColor"
               strokeWidth="1.6"
            />
         </g>
         <circle cx="380" cy="160" r="34" />
         <circle cx="380" cy="148" r="10" />
         <path d="M362 184 c0-12 36-12 36 0" />
         <line x1="180" y1="160" x2="216" y2="160" />
         <line x1="266" y1="160" x2="346" y2="160" />
      </SVGRoot>
   </IllustrationFrame>
);

export const TeamsIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <rect x="80" y="90" width="320" height="140" rx="14" fill="#ffffff" />
         <line x1="80" y1="124" x2="400" y2="124" />
         <text
            x="100"
            y="115"
            fontFamily="ui-monospace, monospace"
            fontSize="11"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
            opacity="0.6"
            letterSpacing="0.14em"
         >
            WORKSPACE
         </text>
         <circle
            cx="170"
            cy="180"
            r="20"
            fill="currentColor"
            stroke="currentColor"
         />
         <text
            x="170"
            y="184"
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="12"
            fontWeight="700"
            stroke="none"
            fill="#ffffff"
         >
            A
         </text>

         <circle cx="240" cy="180" r="20" />
         <text
            x="240"
            y="184"
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="12"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
         >
            E
         </text>

         <circle cx="310" cy="180" r="20" />
         <text
            x="310"
            y="184"
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="12"
            fontWeight="600"
            stroke="none"
            fill="currentColor"
         >
            V
         </text>
      </SVGRoot>
   </IllustrationFrame>
);

export const S3BrowserIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <rect x="80" y="60" width="320" height="50" rx="10" fill="#ffffff" />
         <g transform="translate(102 78)">
            <circle
               cx="7"
               cy="7"
               r="7"
               fill="currentColor"
               stroke="currentColor"
            />
            <line
               x1="12"
               y1="12"
               x2="18"
               y2="18"
               stroke="currentColor"
               strokeWidth="2.5"
            />
         </g>
         <line
            x1="140"
            y1="85"
            x2="280"
            y2="85"
            opacity="0.35"
            strokeWidth="1.2"
         />
         {[150, 190, 230, 270].map((y, i) => (
            <g key={y}>
               <rect
                  x="92"
                  y={y - 8}
                  width="14"
                  height="16"
                  rx="2"
                  opacity={i === 1 ? "1" : "0.5"}
               />
               <line
                  x1="118"
                  y1={y}
                  x2={118 + 240 - i * 30}
                  y2={y}
                  opacity={i === 1 ? "1" : "0.4"}
                  strokeWidth={i === 1 ? "1.6" : "1.2"}
               />
            </g>
         ))}
      </SVGRoot>
   </IllustrationFrame>
);

export const CloudflareR2Illustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <path
            d="M120 110 c-10 0-18-8-18-18 0-9 7-17 16-18 2-12 12-21 24-21 10 0 19 6 22 15 2 0 4-1 6-1 10 0 18 8 18 18 0 2 0 4-1 5 9 2 15 9 15 18 0 11-9 19-20 19 H120 Z"
            fill="#ffffff"
         />
         <path
            d="M180 110 C220 110 240 160 280 160"
            strokeDasharray="3 5"
            opacity="0.5"
            fill="none"
         />
         <g transform="translate(260 130)">
            <path
               d="M0 18 L120 18 L112 96 a12 12 0 0 1-12 11 H20 a12 12 0 0 1-12-11 Z"
               fill="#ffffff"
               strokeWidth="1.6"
            />
            <path d="M22 18 a38 38 0 0 1 76 0" />
            <text
               x="60"
               y="78"
               textAnchor="middle"
               fontFamily="Inter, system-ui, sans-serif"
               fontSize="38"
               fontWeight="700"
               stroke="none"
               fill="currentColor"
            >
               R
            </text>
         </g>
      </SVGRoot>
   </IllustrationFrame>
);

export const SecurityIllustration = () => (
   <IllustrationFrame>
      <SVGRoot viewBox="0 0 480 320">
         <g transform="translate(192 80)">
            <path
               d="M22 60 V44 a32 32 0 0 1 64 0 V60"
               fill="currentColor"
               stroke="currentColor"
               strokeWidth="1.6"
            />
            <path
               d="M30 60 V44 a24 24 0 0 1 48 0 V60"
               fill="#f7f7f7"
               stroke="none"
            />
            <rect
               x="6"
               y="60"
               width="96"
               height="86"
               rx="10"
               fill="#ffffff"
               strokeWidth="1.6"
            />
            <circle cx="54" cy="100" r="6" fill="currentColor" stroke="none" />
            <line x1="54" y1="106" x2="54" y2="124" strokeWidth="2" />
         </g>
         <line x1="120" y1="248" x2="360" y2="248" opacity="0.5" />
      </SVGRoot>
   </IllustrationFrame>
);
