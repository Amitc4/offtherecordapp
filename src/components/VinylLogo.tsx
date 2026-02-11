import { motion } from "framer-motion";

const VinylLogo = ({ size = 200, spinning = false }: { size?: number; spinning?: boolean }) => {
  const grooveCount = 8;

  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        className={spinning ? "animate-spin-slow" : ""}
        style={{ width: size, height: size }}
        initial={{ rotate: 0 }}
        animate={spinning ? { rotate: 360 } : {}}
        transition={spinning ? { duration: 8, repeat: Infinity, ease: "linear" } : {}}
      >
        <svg viewBox="0 0 200 200" width={size} height={size}>
          {/* Outer vinyl disc */}
          <circle cx="100" cy="100" r="98" fill="hsl(20, 35%, 15%)" />
          <circle cx="100" cy="100" r="96" fill="hsl(20, 20%, 18%)" />

          {/* Grooves */}
          {Array.from({ length: grooveCount }).map((_, i) => (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={85 - i * 7}
              fill="none"
              stroke="hsl(20, 15%, 22%)"
              strokeWidth="0.5"
              opacity={0.6}
            />
          ))}

          {/* Orange label area */}
          <circle cx="100" cy="100" r="38" fill="url(#orangeGradient)" />
          <circle cx="100" cy="100" r="36" fill="url(#orangeGradientInner)" />

          {/* Label details */}
          <circle cx="100" cy="100" r="6" fill="hsl(20, 35%, 15%)" />
          <circle cx="100" cy="100" r="4" fill="hsl(20, 20%, 25%)" />

          {/* Text on label */}
          <defs>
            <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(30, 90%, 55%)" />
              <stop offset="50%" stopColor="hsl(24, 85%, 52%)" />
              <stop offset="100%" stopColor="hsl(16, 70%, 42%)" />
            </linearGradient>
            <linearGradient id="orangeGradientInner" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(32, 85%, 58%)" />
              <stop offset="50%" stopColor="hsl(24, 80%, 50%)" />
              <stop offset="100%" stopColor="hsl(14, 65%, 40%)" />
            </linearGradient>
            <path id="topArc" d="M 68 100 A 32 32 0 0 1 132 100" />
            <path id="bottomArc" d="M 130 106 A 30 30 0 0 1 70 106" />
          </defs>

          <text fill="hsl(30, 50%, 98%)" fontSize="30" fontFamily="'Playfair Display', serif" fontWeight="700" letterSpacing="1.5">
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">
              OFF THE
            </textPath>
          </text>
          <text fill="hsl(30, 50%, 98%)" fontSize="30" fontFamily="'Playfair Display', serif" fontWeight="700" letterSpacing="1.5">
            <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
              RECORD
            </textPath>
          </text>

          {/* Subtle shine */}
          <ellipse cx="75" cy="65" rx="40" ry="25" fill="white" opacity="0.04" transform="rotate(-30 75 65)" />
        </svg>
      </motion.div>
    </div>
  );
};

export default VinylLogo;
