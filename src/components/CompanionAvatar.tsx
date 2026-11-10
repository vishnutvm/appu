import React from 'react';

interface CompanionAvatarProps {
  size?: number;
  className?: string;
}

export const CompanionAvatar: React.FC<CompanionAvatarProps> = ({
  size = 24,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="avatarHelmetGrad" x1="16" y1="3" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="75%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="avatarGoldAccent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <radialGradient id="avatarVisorGloss" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.22)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
      </defs>

      {/* Top Antenna */}
      <rect x="15.2" y="1.2" width="1.6" height="4" rx="0.8" fill="#94a3b8" />
      <circle cx="16" cy="1.6" r="1.6" fill="url(#avatarGoldAccent)" />

      {/* Gold ear hardware */}
      <rect x="1.5" y="11.5" width="2.5" height="7.5" rx="1.2" fill="url(#avatarGoldAccent)" />
      <rect x="28" y="11.5" width="2.5" height="7.5" rx="1.2" fill="url(#avatarGoldAccent)" />

      {/* Helmet Shell */}
      <rect
        x="3"
        y="4.5"
        width="26"
        height="22.5"
        rx="11.2"
        fill="url(#avatarHelmetGrad)"
        stroke="rgba(217, 119, 6, 0.4)"
        strokeWidth="0.8"
      />

      {/* Glossy Black Visor */}
      <rect
        x="6"
        y="9"
        width="20"
        height="12"
        rx="6"
        fill="#060911"
        stroke="rgba(245, 158, 11, 0.25)"
        strokeWidth="0.75"
      />
      {/* Specular curved reflection on glass */}
      <rect
        x="6"
        y="9"
        width="20"
        height="6"
        rx="6"
        fill="url(#avatarVisorGloss)"
      />

      {/* Warm Amber Curved Smiling Eyes */}
      <path
        d="M9.8 15.2C10.6 13.7 12 13.7 12.8 15.2"
        stroke="#f59e0b"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M19.2 15.2C20 13.7 21.4 13.7 22.2 15.2"
        stroke="#f59e0b"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Warm Amber Curved Smile */}
      <path
        d="M14.5 17.6C15.2 18.3 16.8 18.3 17.5 17.6"
        stroke="#f59e0b"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};
