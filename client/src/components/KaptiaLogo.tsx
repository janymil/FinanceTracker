import React, { useId } from 'react';

interface KaptiaLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

export function KaptiaLogo({ className = "h-8 w-8", size, ...props }: KaptiaLogoProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-label="Kaptia Logo"
      {...props}
    >
      <defs>
        {/* Left vertical stem: Cyan/Teal at top -> Electric Blue at bottom */}
        <linearGradient id={`${id}-stem`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2ADDC5" />
          <stop offset="100%" stopColor="#1D9BD5" />
        </linearGradient>

        {/* Upper diagonal arm: Radiant Cyan/Teal */}
        <linearGradient id={`${id}-upper`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1DB3D4" />
          <stop offset="100%" stopColor="#2ADDC5" />
        </linearGradient>

        {/* Lower diagonal arm: Cyan-Blue -> Deep Sky Blue */}
        <linearGradient id={`${id}-lower`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1EB5D1" />
          <stop offset="100%" stopColor="#1D9BD5" />
        </linearGradient>
      </defs>

      {/* Left Vertical Pillar */}
      <rect
        x="12"
        y="10"
        width="22"
        height="80"
        rx="4.5"
        fill={`url(#${id}-stem)`}
      />

      {/* Upper Diagonal Arm */}
      <path
        d="M 38 52 L 64 12 C 65.5 10 67.5 10 70 10 L 88 10 C 90.5 10 91.5 12 90 14 L 56 60 Z"
        fill={`url(#${id}-upper)`}
      />

      {/* Lower Diagonal Arm */}
      <path
        d="M 50 48 L 88 86 C 89.5 88 88.5 90 86 90 L 68 90 C 65.5 90 64 89 62 87 L 38 52 Z"
        fill={`url(#${id}-lower)`}
      />
    </svg>
  );
}

export default KaptiaLogo;

