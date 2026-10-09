import type { SVGProps } from "react";
import type { SportSlug } from "@/types";

/**
 * Hand-drawn sport icons in lucide's style (24px grid, 2px round strokes,
 * currentColor), since lucide has no basketball, tennis, cricket, baseball
 * or hockey icons. Drop-in for the lucide components used before: callers
 * only ever pass `className`.
 */
export type SportIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

function Svg({ children, className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "size-4"}
      {...rest}
    >
      {children}
    </svg>
  );
}

const Football: SportIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8.5l3.3 2.4-1.2 3.9H9.9l-1.2-3.9z" />
    <path d="M12 8.5V2.5M15.3 10.9l5.8-1.9M14.1 14.8l3.6 4.9M9.9 14.8l-3.6 4.9M8.7 10.9 2.9 9" />
  </Svg>
);

const Basketball: SportIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2v20M2 12h20" />
    <path d="M5.2 4.7c2.8 2.8 2.8 11.8 0 14.6M18.8 4.7c-2.8 2.8-2.8 11.8 0 14.6" />
  </Svg>
);

const Tennis: SportIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2.6 8.5c4.7.4 7.6 3.6 7.6 8 0 1.9-.5 3.5-1.4 5" />
    <path d="M21.4 15.5c-4.7-.4-7.6-3.6-7.6-8 0-1.9.5-3.5 1.4-5" />
  </Svg>
);

const Cricket: SportIcon = (p) => (
  <Svg {...p}>
    <path d="M5.6 15.6 17.6 3.6l2.8 2.8L8.4 18.4z" />
    <path d="M7 17l-4 4" />
    <circle cx="5" cy="5" r="2" />
  </Svg>
);

const Baseball: SportIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M6 4.6c2.6 2.3 3.9 4.8 3.9 7.4S8.6 17.1 6 19.4M18 4.6c-2.6 2.3-3.9 4.8-3.9 7.4s1.3 5.1 3.9 7.4" />
    <path d="M7.6 8.2l1.5-.7M9.2 12h1.6M7.6 15.8l1.5.7M16.4 8.2l-1.5-.7M14.8 12h-1.6M16.4 15.8l-1.5.7" />
  </Svg>
);

const IceHockey: SportIcon = (p) => (
  <Svg {...p}>
    <path d="M4 2.5l7 14.5h6.5a1.75 1.75 0 0 1 0 3.5H10a1.8 1.8 0 0 1-1.6-1L2 5" />
    <ellipse cx="19" cy="9" rx="3" ry="1.5" />
    <path d="M16 9v1.5c0 .8 1.3 1.5 3 1.5s3-.7 3-1.5V9" />
  </Svg>
);

const Handball: SportIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2c-2.8 2.7-4.2 6-4.2 10s1.4 7.3 4.2 10" />
    <path d="M3.3 7.2c4.1.6 7.4 2.4 9.7 5.4 1.6 2.1 2.5 4.6 2.7 8.6" />
    <path d="M20.7 7.2c-2.6 1.3-5 3.2-7 5.6" />
  </Svg>
);

const AmericanFootball: SportIcon = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="10.5" ry="6" transform="rotate(-45 12 12)" />
    <path d="M9 15l6-6" />
    <path d="M9.8 12.8l1.4 1.4M11.3 11.3l1.4 1.4M12.8 9.8l1.4 1.4" />
  </Svg>
);

export const SPORT_ICONS: Record<SportSlug, SportIcon> = {
  football: Football,
  basketball: Basketball,
  tennis: Tennis,
  cricket: Cricket,
  baseball: Baseball,
  "ice-hockey": IceHockey,
  handball: Handball,
  "american-football": AmericanFootball,
};
