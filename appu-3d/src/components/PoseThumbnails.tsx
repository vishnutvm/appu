import React from 'react';
import { AppuActionId } from '../types/actions';

interface PoseThumbnailProps {
  actionId: AppuActionId | string;
  className?: string;
  size?: number;
}

export const PoseThumbnail: React.FC<PoseThumbnailProps> = ({
  actionId,
  className = '',
  size = 56,
}) => {
  // Appu Design Tokens for SVGs
  const helmetWhite = '#f8fafc';
  const helmetShade = '#cbd5e1';
  const visorBlack = '#080d1a';
  const eyeGold = '#f6c344';
  const goldMetal = '#eab308';
  const cyanCore = '#00e5ff';
  const jointDark = '#334155';

  switch (actionId) {
    // --- GREETINGS ---
    case 'wave':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Antenna */}
          <path d="M50 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={goldMetal} />
          {/* Head */}
          <rect x="28" y="16" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <circle cx="26" cy="32" r="3.5" fill={goldMetal} />
          <circle cx="74" cy="32" r="3.5" fill={goldMetal} />
          {/* Visor */}
          <rect x="33" y="21" width="34" height="22" rx="9" fill={visorBlack} />
          {/* Eyes & Smile */}
          <path d="M39 30C39 27.5 43 27.5 43 30" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 30C57 27.5 61 27.5 61 30" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M47 36C49 38 51 38 53 36" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          {/* Torso */}
          <path d="M42 49H58L62 68H38L42 49Z" fill={helmetWhite} />
          <circle cx="50" cy="58" r="4.5" fill={cyanCore} />
          {/* Left Arm (Relaxed) */}
          <path d="M39 52L30 64L28 72" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="30" cy="64" r="2.5" fill={jointDark} />
          {/* Right Arm (Waving high!) */}
          <path d="M61 52L72 40L79 26" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="72" cy="40" r="2.5" fill={jointDark} />
          {/* Open Hand */}
          <circle cx="80" cy="24" r="4" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          {/* Legs */}
          <path d="M44 68L43 85" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="42" cy="88" rx="6" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M56 68L57 85" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="58" cy="88" rx="6" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'cheer':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={goldMetal} />
          {/* Excited Rays */}
          <path d="M22 20L15 15M78 20L85 15" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          {/* Head */}
          <rect x="28" y="18" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <circle cx="26" cy="34" r="3.5" fill={goldMetal} />
          <circle cx="74" cy="34" r="3.5" fill={goldMetal} />
          <rect x="33" y="23" width="34" height="22" rx="9" fill={visorBlack} />
          <path d="M38 31C38 28 44 28 44 31" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M56 31C56 28 62 28 62 31" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="50" cy="37" rx="4" ry="2.5" fill={eyeGold} />
          {/* Torso */}
          <path d="M42 51H58L62 69H38L42 51Z" fill={helmetWhite} />
          <circle cx="50" cy="59" r="4.5" fill={cyanCore} />
          {/* Both Arms Raised High */}
          <path d="M40 53L25 38L20 25" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="19" cy="23" r="4" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M60 53L75 38L80 25" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="81" cy="23" r="4" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          {/* Legs Bouncing */}
          <path d="M44 69L42 85" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="41" cy="88" rx="6" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M56 69L58 85" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="59" cy="88" rx="6" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'salute':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={goldMetal} />
          {/* Head */}
          <rect x="28" y="16" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <circle cx="26" cy="32" r="3.5" fill={goldMetal} />
          <circle cx="74" cy="32" r="3.5" fill={goldMetal} />
          <rect x="33" y="21" width="34" height="22" rx="9" fill={visorBlack} />
          <circle cx="41" cy="31" r="3" fill={eyeGold} />
          <circle cx="59" cy="31" r="3" fill={eyeGold} />
          {/* Torso */}
          <path d="M42 49H58L62 68H38L42 49Z" fill={helmetWhite} />
          <circle cx="50" cy="58" r="4.5" fill={cyanCore} />
          {/* Left Arm at side */}
          <path d="M39 52L32 68L30 76" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          {/* Right Arm Snapping Salute */}
          <path d="M61 52L74 44L69 26" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="68" cy="24" r="4" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          {/* Legs straight */}
          <path d="M44 68L44 86" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="43" cy="89" rx="6" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M56 68L56 86" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="57" cy="89" rx="6" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'nod':
    case 'bow':
    case 'clap':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={goldMetal} />
          <rect x="28" y="16" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="33" y="21" width="34" height="22" rx="9" fill={visorBlack} />
          <path d="M39 31C39 28 43 28 43 31" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 31C57 28 61 28 61 31" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M46 37C48 39 52 39 54 37" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          <path d="M42 49H58L62 68H38L42 49Z" fill={helmetWhite} />
          <circle cx="50" cy="58" r="4.5" fill={cyanCore} />
          {/* Both arms clapping in front */}
          <path d="M39 52L46 62M61 52L54 62" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          <circle cx="50" cy="63" r="5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M44 68L44 86M56 68L56 86" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    // --- SITTING & RESTING ---
    case 'sit':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 28V20" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="18" r="4" fill={goldMetal} />
          {/* Head Lowered */}
          <rect x="28" y="26" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <circle cx="26" cy="42" r="3.5" fill={goldMetal} />
          <circle cx="74" cy="42" r="3.5" fill={goldMetal} />
          <rect x="33" y="31" width="34" height="22" rx="9" fill={visorBlack} />
          <path d="M39 40C39 37.5 43 37.5 43 40" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 40C57 37.5 61 37.5 61 40" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M47 46C49 48 51 48 53 46" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          {/* Torso on Floor */}
          <path d="M42 59H58L62 76H38L42 59Z" fill={helmetWhite} />
          <circle cx="50" cy="67" r="4" fill={cyanCore} />
          {/* Arms on knees */}
          <path d="M40 62L34 75M60 62L66 75" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" />
          {/* Legs folded out forward */}
          <path d="M39 76L32 82L44 83" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="46" cy="83" rx="5" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M61 76L68 82L56 83" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="54" cy="83" rx="5" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'sit_relaxed':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M48 28V20" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="48" cy="18" r="4" fill={goldMetal} />
          {/* Head leaning back slightly */}
          <rect x="27" y="26" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" transform="rotate(-6 49 42)" />
          <rect x="32" y="31" width="34" height="22" rx="9" fill={visorBlack} transform="rotate(-6 49 42)" />
          <path d="M39 40C39 37.5 43 37.5 43 40" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 40C57 37.5 61 37.5 61 40" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          {/* Torso leaning back */}
          <path d="M40 59H56L61 77H37L40 59Z" fill={helmetWhite} />
          <circle cx="48" cy="67" r="4" fill={cyanCore} />
          {/* Arms bracing back */}
          <path d="M36 63L24 77M58 63L70 77" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" />
          {/* Legs relaxed */}
          <path d="M39 77L30 83L42 84" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M57 77L66 83L54 84" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'sit_legs_extended':
    case 'sit_cross_legged':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 28V20" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="18" r="4" fill={goldMetal} />
          <rect x="28" y="26" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="33" y="31" width="34" height="22" rx="9" fill={visorBlack} />
          <circle cx="41" cy="40" r="3" fill={eyeGold} />
          <circle cx="59" cy="40" r="3" fill={eyeGold} />
          <path d="M42 59H58L62 76H38L42 59Z" fill={helmetWhite} />
          <circle cx="50" cy="67" r="4" fill={cyanCore} />
          <path d="M40 62L46 74M60 62L54 74" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" />
          <path d="M36 78C26 84 46 86 50 82C54 86 74 84 64 78" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    case 'lie_down':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Lying Horizontal */}
          <path d="M22 62H14" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="12" cy="62" r="4" fill={goldMetal} />
          {/* Head on ground */}
          <rect x="20" y="46" width="30" height="32" rx="12" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="23" y="51" width="22" height="22" rx="8" fill={visorBlack} />
          <path d="M28 59C28 57 32 57 32 59" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          <path d="M38 59C38 57 42 57 42 59" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          {/* Torso horizontal */}
          <rect x="49" y="53" width="22" height="18" rx="5" fill={helmetWhite} />
          <circle cx="60" cy="62" r="3.5" fill={cyanCore} />
          {/* Extended Legs */}
          <path d="M71 58H88" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="90" cy="58" rx="3.5" ry="5.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M71 66H88" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="90" cy="66" rx="3.5" ry="5.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'side_rest':
    case 'lie_down_side':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Tilted Head resting on arm */}
          <rect x="20" y="44" width="30" height="32" rx="12" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" transform="rotate(-15 35 60)" />
          <rect x="23" y="49" width="22" height="22" rx="8" fill={visorBlack} transform="rotate(-15 35 60)" />
          <circle cx="30" cy="58" r="2.5" fill={eyeGold} />
          <circle cx="41" cy="55" r="2.5" fill={eyeGold} />
          {/* Propping arm */}
          <path d="M28 72L36 64L38 72" stroke={helmetWhite} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Body and curled legs */}
          <rect x="48" y="52" width="20" height="18" rx="5" fill={helmetWhite} />
          <circle cx="58" cy="61" r="3.5" fill={cyanCore} />
          <path d="M68 59C75 58 84 64 80 72" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          <ellipse cx="80" cy="74" rx="4.5" ry="3" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'rest_head_on_hands':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <rect x="35" y="32" width="30" height="32" rx="12" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="39" y="37" width="22" height="22" rx="8" fill={visorBlack} />
          <path d="M43 45C43 43 47 43 47 45" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          <path d="M53 45C53 43 57 43 57 45" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          {/* Hands holding chin */}
          <circle cx="42" cy="62" r="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1" />
          <circle cx="58" cy="62" r="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1" />
          {/* Feet kicked up */}
          <path d="M26 68C22 58 18 52 24 46" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" />
          <path d="M74 68C78 58 82 52 76 46" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );

    // --- SLEEP ---
    case 'sleep':
    case 'deep_sleep':
    case 'sleep_side':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Floating Z z */}
          <text x="68" y="34" fill={eyeGold} fontSize="14" fontWeight="bold" fontFamily="system-ui">Z</text>
          <text x="79" y="24" fill={eyeGold} fontSize="10" fontWeight="bold" fontFamily="system-ui">z</text>
          {/* Sleeping Appu */}
          <rect x="22" y="46" width="30" height="30" rx="12" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="25" y="50" width="22" height="20" rx="7" fill={visorBlack} />
          {/* Closed Sleeping Eye Arcs */}
          <path d="M29 60C31 62 34 62 36 60" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          <path d="M40 60C42 62 45 62 47 60" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          {/* Curled Body */}
          <rect x="50" y="52" width="20" height="17" rx="5" fill={helmetWhite} />
          <circle cx="60" cy="60" r="3" fill={cyanCore} opacity="0.6" />
          <path d="M68 59C75 58 82 64 78 72" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          <ellipse cx="78" cy="74" rx="4" ry="2.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'wake_up':
    case 'stretch':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={goldMetal} />
          <rect x="28" y="16" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="33" y="21" width="34" height="22" rx="9" fill={visorBlack} />
          <path d="M39 31C39 28 43 28 43 31" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 31C57 28 61 28 61 31" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="50" cy="37" rx="3.5" ry="4" fill={eyeGold} />
          {/* Overhead Stretch Arms */}
          <path d="M40 51L32 30L34 16M60 51L68 30L66 16" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M42 49H58L62 68H38L42 49Z" fill={helmetWhite} />
          <circle cx="50" cy="58" r="4.5" fill={cyanCore} />
          <path d="M44 68L44 86M56 68L56 86" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    // --- PLAYFUL ---
    case 'handstand':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Ground Contact Line */}
          <path d="M25 88H75" stroke={jointDark} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          {/* Arms planted down */}
          <path d="M40 65L36 86M60 65L64 86" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          <circle cx="36" cy="87" r="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <circle cx="64" cy="87" r="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          {/* Head near ground looking forward */}
          <rect x="32" y="58" width="36" height="26" rx="10" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="36" y="62" width="28" height="18" rx="7" fill={visorBlack} />
          <circle cx="43" cy="70" r="2.5" fill={eyeGold} />
          <circle cx="57" cy="70" r="2.5" fill={eyeGold} />
          {/* Inverted Torso */}
          <path d="M42 59H58L62 44H38L42 59Z" fill={helmetWhite} />
          <circle cx="50" cy="51" r="4" fill={cyanCore} />
          {/* Legs upright in air */}
          <path d="M43 44L41 24" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="40" cy="21" rx="5" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
          <path d="M57 44L59 24" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="60" cy="21" rx="5" ry="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1.5" />
        </svg>
      );

    case 'upside_down':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Head upside down */}
          <rect x="30" y="54" width="40" height="28" rx="12" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="34" y="58" width="32" height="20" rx="8" fill={visorBlack} />
          <path d="M40 68C40 70.5 44 70.5 44 68" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M56 68C56 70.5 60 70.5 60 68" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          {/* Splayed Arms */}
          <path d="M32 50L18 64M68 50L82 64" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          {/* Torso */}
          <rect x="40" y="36" width="20" height="20" rx="5" fill={helmetWhite} />
          <circle cx="50" cy="46" r="4" fill={cyanCore} />
          {/* V-Shape Legs */}
          <path d="M43 36L30 18M57 36L70 18" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    case 'spin':
    case 'dance':
    case 'jump':
    case 'celebrate':
    case 'play_cursor':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={goldMetal} />
          {/* Dancing Appu with splayed arms */}
          <rect x="28" y="16" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="33" y="21" width="34" height="22" rx="9" fill={visorBlack} />
          <path d="M39 30C39 27.5 43 27.5 43 30" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 30C57 27.5 61 27.5 61 30" stroke={eyeGold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M42 49H58L62 68H38L42 49Z" fill={helmetWhite} />
          <circle cx="50" cy="58" r="4.5" fill={cyanCore} />
          {/* Groovy arms */}
          <path d="M39 52L26 44L20 54M61 52L74 44L80 54" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Stepping legs */}
          <path d="M44 68L38 84M56 68L62 84" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    // --- EMOTIONS ---
    case 'think':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Question mark */}
          <text x="74" y="24" fill={eyeGold} fontSize="18" fontWeight="bold" fontFamily="system-ui">?</text>
          <path d="M49 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="49" cy="8" r="4" fill={goldMetal} />
          {/* Head Tilted */}
          <rect x="27" y="18" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" transform="rotate(7 49 34)" />
          <rect x="32" y="23" width="34" height="22" rx="9" fill={visorBlack} transform="rotate(7 49 34)" />
          <circle cx="42" cy="32" r="3" fill={eyeGold} />
          <circle cx="60" cy="35" r="3" fill={eyeGold} />
          {/* Torso */}
          <path d="M42 51H58L62 70H38L42 51Z" fill={helmetWhite} />
          <circle cx="50" cy="60" r="4.5" fill={cyanCore} />
          {/* Hand to Chin */}
          <path d="M60 53L68 46L60 38" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="59" cy="38" r="3.5" fill={helmetWhite} stroke={goldMetal} strokeWidth="1" />
          <path d="M39 53L32 66L42 66" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M44 70L44 87M56 70L56 87" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    case 'bored':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          {/* Thought dots ... */}
          <circle cx="70" cy="20" r="2.5" fill={eyeGold} />
          <circle cx="77" cy="20" r="2.5" fill={eyeGold} />
          <circle cx="84" cy="20" r="2.5" fill={eyeGold} />
          <path d="M50 20V12" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="10" r="4" fill={goldMetal} />
          {/* Slouched Head */}
          <rect x="28" y="20" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="33" y="25" width="34" height="22" rx="9" fill={visorBlack} />
          {/* Flat Bored Eyes */}
          <path d="M38 34H46M54 34H62" stroke={eyeGold} strokeWidth="3" strokeLinecap="round" />
          {/* Slouched Torso */}
          <path d="M42 53H58L62 72H38L42 53Z" fill={helmetWhite} />
          <circle cx="50" cy="62" r="4" fill={cyanCore} opacity="0.7" />
          {/* Limp arms */}
          <path d="M38 55L34 74M62 55L66 74" stroke={helmetWhite} strokeWidth="5" strokeLinecap="round" />
          {/* Legs with one foot tapping */}
          <path d="M44 72L44 88" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
          <path d="M56 72L58 84L64 87" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    default:
      // Generic high-polish robot preview
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
          <path d="M50 18V10" stroke={goldMetal} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={goldMetal} />
          <rect x="28" y="16" width="44" height="32" rx="14" fill={helmetWhite} stroke={helmetShade} strokeWidth="1.5" />
          <rect x="33" y="21" width="34" height="22" rx="9" fill={visorBlack} />
          <circle cx="41" cy="31" r="3.5" fill={eyeGold} />
          <circle cx="59" cy="31" r="3.5" fill={eyeGold} />
          <path d="M47 37C49 39 51 39 53 37" stroke={eyeGold} strokeWidth="2" strokeLinecap="round" />
          <path d="M42 49H58L62 68H38L42 49Z" fill={helmetWhite} />
          <circle cx="50" cy="58" r="4.5" fill={cyanCore} />
          <path d="M39 52L30 68M61 52L70 68" stroke={helmetWhite} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M44 68L44 86M56 68L56 86" stroke={helmetWhite} strokeWidth="6" strokeLinecap="round" />
        </svg>
      );
  }
};
