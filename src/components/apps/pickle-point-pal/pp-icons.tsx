/**
 * Hand-authored pictograms for the officiating instrument — squared corners,
 * one uniform stroke, butt caps and mitre joins, no rounding, so they read as
 * legends etched into the panel rather than a friendly app icon set. Sized by
 * the parent's `[&_svg]:size-*` or a `className`; default 1em.
 */

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 9h11a5 5 0 0 1 0 10H8" />
      <path d="M8 4 4 9l4 5" />
    </Svg>
  );
}

export function RedoIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 9H9a5 5 0 0 0 0 10h7" />
      <path d="M16 4l4 5-4 5" />
    </Svg>
  );
}

export function TechnicalIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 22 20H2Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function LogIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h1M4 12h1M4 18h1" />
      <path d="M9 6h11M9 12h11M9 18h11" />
    </Svg>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={2.5} />
    </Svg>
  );
}

export function TimerIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 3h6" />
      <path d="M12 3v3" />
      <path d="M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
      <path d="M12 11v3l2.5 2" />
    </Svg>
  );
}

export function MedicalIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function EquipmentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" />
      <path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
    </Svg>
  );
}

export function SwapIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 9h13M14 6l3 3-3 3" />
      <path d="M20 15H7M10 12l-3 3 3 3" />
    </Svg>
  );
}
