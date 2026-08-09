/**
 * Small inline stroke-icon set. Kept in-repo so we take on no icon-library
 * dependency. All icons inherit color via `currentColor` and size via
 * className (default h-5 w-5).
 */
type IconProps = { className?: string };

function Svg({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const HomeIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Svg>
);

export const BookIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 0 5 20.5Z" />
    <path d="M5 20.5A1.5 1.5 0 0 1 6.5 19H20" />
  </Svg>
);

export const HeartIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 20s-7-4.35-9.2-8.5C1.4 8.9 2.7 5.8 5.7 5.2 7.6 4.8 9.4 5.7 12 8.2c2.6-2.5 4.4-3.4 6.3-3 3 .6 4.3 3.7 2.9 6.3C19 15.65 12 20 12 20Z" />
  </Svg>
);

export const FolderIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
  </Svg>
);

export const InboxIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 13.5 6 5h12l2 8.5" />
    <path d="M4 13.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5.5" />
    <path d="M4 13.5h4l1.5 2.5h5L16 13.5h4" />
  </Svg>
);

export const UploadIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 15V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const SettingsIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-2-3.4-2 .8a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.6A7.6 7.6 0 0 0 6.9 6.1l-2-.8-2 3.4 1.7 1.3a7.7 7.7 0 0 0 0 3L2.9 14.3l2 3.4 2-.8a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.5-2.6a7.6 7.6 0 0 0 2.6-1.5l2 .8 2-3.4Z" />
  </Svg>
);

export const CocktailIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5 5h14l-7 7Z" />
    <path d="M12 12v6" />
    <path d="M8.5 21h7" />
  </Svg>
);

export const SparkleIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9Z" />
  </Svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);
