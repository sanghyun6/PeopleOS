import type { SVGProps } from "react";
import type { IncidentCategory } from "@/convex/lib/validators";

// Small stroke icon set (24px grid, 1.75 stroke). Inline so there is no icon dependency.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PowerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </Svg>
);
export const WifiIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
    <path d="M12 20h.01" />
  </Svg>
);
export const BulbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
  </Svg>
);
export const TableIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h18M5 8v12M19 8v12M3 8l2-4h14l2 4" />
  </Svg>
);
export const CupIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h14l-1.6 15.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8L5 4zM5.6 9h12.8" />
  </Svg>
);
export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
  </Svg>
);
export const BagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 7h12l1 14H5L6 7zM9 7a3 3 0 0 1 6 0" />
  </Svg>
);
export const BlockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Svg>
);
export const CrossIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z" />
  </Svg>
);
export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3zM12 8v4M12 16h.01" />
  </Svg>
);
export const DotsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h.01M12 12h.01M16 12h.01" />
  </Svg>
);
export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </Svg>
);
export const RouteIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16" />
  </Svg>
);
export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Svg>
);
export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);

export const CATEGORY_ICON: Record<IncidentCategory, (p: IconProps) => React.ReactElement> = {
  power: PowerIcon,
  network: WifiIcon,
  lighting: BulbIcon,
  furniture: TableIcon,
  supplies: CupIcon,
  cleaning: SparkleIcon,
  lost_found: BagIcon,
  blockage: BlockIcon,
  medical: CrossIcon,
  safety: ShieldIcon,
  other: DotsIcon,
};

/** Short display names for categories (chips are narrow). */
export const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  power: "Power",
  network: "Network",
  lighting: "Lights",
  furniture: "Furniture",
  supplies: "Supplies",
  cleaning: "Cleaning",
  lost_found: "Lost & found",
  blockage: "Blockage",
  medical: "Medical",
  safety: "Safety",
  other: "Other",
};
