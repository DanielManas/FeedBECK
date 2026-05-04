import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function Logo({ size = 40, className = '', showText = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div 
        animate={{ 
          scale: [1, 1.02, 1],
          boxShadow: [
            "0 0 20px rgba(74,222,128,0.1)",
            "0 0 40px rgba(74,222,128,0.3)",
            "0 0 20px rgba(74,222,128,0.1)"
          ]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex items-center justify-center bg-[#050a08] rounded-[22%] border-2 border-[#163a22] overflow-hidden"
        style={{ width: size, height: size }}
      >
        <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <motion.path 
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          d="M 32 62 C 31 85 67 90 68 62 
            M 32 53 L 32 60 
            M 32 65 L 15 45 L 32 52 
            M 68 65 L 85 47 L 68 52 
            M 68 64 L 68 52.52 
            M 67.78 52.04 C 68.21 35.86 53.73 30.86 69.73 35.43 
            M 32 52 L 38 45 L 44 52 L 50 45 L 56 52 L 62 45 L 68 52 
            M 32 52 C 32 15 65 10 75 30" 
          stroke="#4ade80" 
          strokeWidth="4.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]"
        />

        <motion.circle 
          cx="75" 
          cy="35" 
          r="5" 
          stroke="#4ade80" 
          strokeWidth="4.5" 
          fill="none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5, type: "spring" }}
          className="drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]"
        />

        <motion.ellipse 
          cx="42" cy="62" rx="3" ry="3" fill="#ff0000" 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            ry: [3, 3, 0.1, 3]
          }}
          transition={{ 
            scale: { delay: 2, duration: 0.5 },
            opacity: { delay: 2, duration: 0.5 },
            ry: {
              delay: 3,
              duration: 5,
              repeat: Infinity,
              times: [0, 0.95, 0.975, 1],
              ease: "easeInOut"
            }
          }}
          className="drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]"
        />
        <motion.ellipse 
          cx="58" cy="62" rx="3" ry="3" fill="#ff0000" 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            ry: [3, 3, 0.1, 3]
          }}
          transition={{ 
            scale: { delay: 2, duration: 0.5 },
            opacity: { delay: 2, duration: 0.5 },
            ry: {
              delay: 3,
              duration: 5,
              repeat: Infinity,
              times: [0, 0.95, 0.975, 1],
              ease: "easeInOut"
            }
          }}
          className="drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]"
        />
      </svg>
      </motion.div>

      {showText && (
        <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic leading-none">
          Feed<span className="text-moss-400">BECK</span>
        </h1>
      )}
    </div>
  );
}
