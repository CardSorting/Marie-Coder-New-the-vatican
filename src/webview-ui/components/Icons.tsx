import { SVGProps } from "react";

const breatheAnimation = `
  @keyframes breathe {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.05); opacity: 1; }
  }
`;

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export const MascotIcon = ({ size = 24, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 1024 1024"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ animation: "breathe 4s ease-in-out infinite" }}
    {...props}
  >
    <style>{breatheAnimation}</style>
    {/* Stylized Hair/Head */}
    <path
      d="M512 150C300 150 150 320 150 512V700C150 800 230 880 330 880H694C794 880 874 800 874 700V512C874 320 724 150 512 150Z"
      fill="currentColor"
    />
    <path
      d="M300 250C250 300 220 400 220 512"
      stroke="var(--surface-0)"
      strokeWidth="20"
      strokeLinecap="round"
      opacity="0.3"
    />
    {/* Eyes */}
    <circle cx="420" cy="550" r="35" fill="var(--accent)" />
    <circle cx="604" cy="550" r="35" fill="var(--accent)" />
    {/* Sakura Petal */}
    <path
      d="M680 280C660 260 630 250 610 270C590 290 600 320 620 340C640 360 670 370 690 350C710 330 700 300 680 280Z"
      fill="#FFB7C5"
    />
    {/* Sparkle */}
    <path
      d="M750 400L760 420L780 430L760 440L750 460L740 440L720 430L740 420Z"
      fill="#FFD700"
    >
      <animate
        attributeName="opacity"
        values="0.3;1;0.3"
        dur="2s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

export const IconicLogo = ({ size = 24, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 1024 1024"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <defs>
      <linearGradient
        id="sakura-grad-icon"
        x1="200"
        y1="200"
        x2="800"
        y2="800"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#FFB7C5" />
        <stop offset="100%" stopColor="#FF69B4" />
      </linearGradient>
      <linearGradient
        id="neural-grad-icon"
        x1="200"
        y1="200"
        x2="800"
        y2="800"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#00FFFF" />
        <stop offset="100%" stopColor="#00CED1" />
      </linearGradient>
    </defs>
    <path
      d="M512 512C512 512 350 350 250 400C150 450 180 600 250 700C320 800 512 512 512 512Z"
      fill="url(#sakura-grad-icon)"
      opacity="0.8"
    />
    <path
      d="M512 512C512 512 400 200 550 150C700 100 800 300 700 450C600 600 512 512 512 512Z"
      fill="url(#sakura-grad-icon)"
      opacity="0.6"
    />
    <circle cx="650" cy="512" r="40" fill="url(#neural-grad-icon)" />
    <circle cx="750" cy="400" r="30" fill="url(#neural-grad-icon)" />
    <circle cx="750" cy="624" r="30" fill="url(#neural-grad-icon)" />
    <circle cx="850" cy="512" r="25" fill="url(#neural-grad-icon)" />
    <path
      d="M512 512L650 512M650 512L750 400M650 512L750 624M750 400L850 512M750 624L850 512"
      stroke="url(#neural-grad-icon)"
      strokeWidth="12"
      strokeLinecap="round"
    />
    <circle cx="512" cy="512" r="60" fill="white" />
  </svg>
);

export const SettingsIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const CloseIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const PlanIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M3 7V5c0-1.1.9-2 2-2h2" />
    <path d="M17 3h2c1.1 0 2 .9 2 2v2" />
    <path d="M21 17v2c0 1.1-.9 2-2 2h-2" />
    <path d="M7 21H5c-1.1 0-2-.9-2-2v-2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v6" />
    <path d="M9 12h6" />
  </svg>
);

export const ExecuteIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export const ReviewIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const UserIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const ToolIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

export const LoadingDots = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="4" cy="12" r="2">
      <animate
        attributeName="opacity"
        values="0.2;1;0.2"
        dur="1s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="12" cy="12" r="2">
      <animate
        attributeName="opacity"
        values="0.2;1;0.2"
        dur="1s"
        begin="0.2s"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="20" cy="12" r="2">
      <animate
        attributeName="opacity"
        values="0.2;1;0.2"
        dur="1s"
        begin="0.4s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export const GitBranchIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

export const GitCommitIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="4" />
    <line x1="3" y1="12" x2="8" y2="12" />
    <line x1="16" y1="12" x2="21" y2="12" />
  </svg>
);

export const GitMergeIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M6 21V9a9 9 0 0 0 9 9" />
  </svg>
);

export const SessionIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const SearchIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const PinIcon = ({ size = 16, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-2l-1.5-1.5V6a3.5 3.5 0 0 0-7 0v7.5L9 15v2z" />
  </svg>
);
