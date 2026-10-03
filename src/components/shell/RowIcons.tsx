export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 2.5 L13.5 5 L5.5 13 L2.5 13.5 L3 10.5 Z" />
      <path d="M10 3.5 L12.5 6" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.2 10.2 L13.5 13.5" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 4 H13.5" />
      <path d="M6 4 V2.75 A0.75 0.75 0 0 1 6.75 2 H9.25 A0.75 0.75 0 0 1 10 2.75 V4" />
      <path d="M4 4 L4.6 13.1 A1 1 0 0 0 5.6 14 H10.4 A1 1 0 0 0 11.4 13.1 L12 4" />
      <path d="M6.5 7 V11" />
      <path d="M9.5 7 V11" />
    </svg>
  );
}
