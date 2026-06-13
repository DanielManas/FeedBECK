import { motion, AnimatePresence } from 'motion/react';

interface LighterButtonProps {
  hasFlame: boolean;
  count: number;
}

export default function LighterButton({ hasFlame, count }: LighterButtonProps) {
  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: 34, height: 46 }}
    >
      {/* Chama animada */}
      <AnimatePresence>
        {hasFlame && (
          <motion.div
            key="flame"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            style={{ originY: '100%', transformOrigin: '50% 100%' }}
            className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            {count > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="absolute -top-3 -right-3.5 z-30 min-w-[17px] h-[17px] px-1 bg-red-500 rounded-full text-white text-[8px] font-black flex items-center justify-center border border-black/30 shadow-lg shadow-red-900/60 leading-none"
              >
                {count > 9 ? '9+' : count}
              </motion.div>
            )}

            <motion.svg
              width="16"
              height="18"
              viewBox="0 0 16 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              animate={{
                scaleX: [1, 1.13, 0.91, 1.08, 1],
                scaleY: [1, 0.93, 1.07, 0.95, 1],
                rotate: [-2, 3, -3, 1.5, 0],
              }}
              transition={{ duration: 0.52, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '50% 100%' }}
            >
              <defs>
                <radialGradient id="fbFlameGrad" cx="50%" cy="75%" r="55%">
                  <stop offset="0%"   stopColor="#fef08a" />
                  <stop offset="30%"  stopColor="#fbbf24" />
                  <stop offset="68%"  stopColor="#f97316" />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0.5" />
                </radialGradient>
              </defs>
              <path
                d="M8 17 C4.5 17 2 14 2 10.5 C2 8 3.5 6.5 5 5 C5.4 4.3 5.6 3.6 5.3 2.7 C6.1 3.5 6.5 4.8 6.1 6 C7.3 5.1 7.8 3.5 7.3 1.6 C9 3.3 9.8 5.4 8.9 7.5 C10.1 6.7 10.9 5.1 10.5 3.3 C12.1 5.5 12.4 8 11.6 9.9 C13.2 9.1 13.9 7.5 13.5 5.8 C14.3 8.2 14.2 10.9 12.5 12.7 C11.2 14.2 9.7 14.9 8 17Z"
                fill="url(#fbFlameGrad)"
                opacity="0.96"
              />
              <path
                d="M8 15.2 C6.2 15.2 5.1 13.4 5.1 11.4 C5.1 10 5.8 8.9 6.7 7.8 C7 8.5 7.1 9.4 6.8 10.2 C7.6 9.5 8 8.4 7.6 7.1 C8.8 8.3 9.2 9.9 8.4 11.1 C9.5 10.4 9.9 9.2 9.5 7.9 C10.3 9.5 10.2 11.3 9.1 12.6 C8.7 13.6 8.4 14.4 8 15.2Z"
                fill="#fef9c3"
                opacity="0.62"
              />
            </motion.svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corpo do isqueiro */}
      <svg
        width="28"
        height="30"
        viewBox="0 0 28 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute bottom-0"
      >
        {/* Corpo */}
        <rect x="4" y="13" width="20" height="15" rx="3"
          fill={hasFlame ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.03)'}
          stroke={hasFlame ? '#4ade80' : '#475569'}
          strokeWidth="1.4"
          style={{ transition: 'stroke 0.3s, fill 0.3s' }}
        />
        {/* Brilho lateral */}
        <rect x="6" y="15" width="5" height="10" rx="1.5"
          fill={hasFlame ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)'}
        />
        {/* Label strip */}
        <rect x="7" y="17" width="14" height="5.5" rx="1"
          fill={hasFlame ? 'rgba(22,83,36,0.3)' : 'rgba(0,0,0,0.2)'}
        />
        {/* Texto FB */}
        <text x="10.2" y="21.4" fontSize="4" fontWeight="900"
          fill={hasFlame ? '#4ade80' : '#64748b'}
          fontFamily="monospace" letterSpacing="0.7"
          style={{ transition: 'fill 0.3s' }}
        >
          FB
        </text>
        {/* Grip lines */}
        <line x1="7" y1="24.5" x2="21" y2="24.5" stroke={hasFlame ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.06)'} strokeWidth="0.6" />
        <line x1="7" y1="26.5" x2="21" y2="26.5" stroke={hasFlame ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.06)'} strokeWidth="0.6" />

        {/* Tampa superior */}
        <rect x="7" y="7" width="14" height="7" rx="2"
          fill={hasFlame ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)'}
          stroke={hasFlame ? '#4ade80' : '#475569'}
          strokeWidth="1.2"
          style={{ transition: 'stroke 0.3s, fill 0.3s' }}
        />

        {/* Bocal */}
        <rect x="11" y="4.5" width="4.5" height="3.8" rx="1"
          fill={hasFlame ? 'rgba(74,222,128,0.45)' : 'rgba(71,85,105,0.4)'}
          style={{ transition: 'fill 0.3s' }}
        />
        <rect x="12.2" y="2.5" width="1.8" height="3" rx="0.5"
          fill={hasFlame ? 'rgba(74,222,128,0.35)' : 'rgba(71,85,105,0.28)'}
          style={{ transition: 'fill 0.3s' }}
        />

        {/* Roda de faísca — usando circle em vez de ellipse para evitar ry undefined */}
        <circle cx="19.5" cy="10.5" r="2"
          fill={hasFlame ? 'rgba(34,197,94,0.14)' : 'rgba(71,85,105,0.12)'}
          stroke={hasFlame ? '#4ade80' : '#475569'}
          strokeWidth="0.9"
          style={{ transition: 'stroke 0.3s' }}
        />
        {[17.3, 18.5, 19.7, 20.9, 22.1].map((x, i) => (
          <line key={i}
            x1={x} y1="9" x2={x} y2="12"
            stroke={hasFlame ? 'rgba(74,222,128,0.38)' : 'rgba(71,85,105,0.38)'}
            strokeWidth="0.5"
            style={{ transition: 'stroke 0.3s' }}
          />
        ))}
      </svg>

      {/* Brilho ambiente verde */}
      {hasFlame && (
        <motion.div
          animate={{ opacity: [0.08, 0.22, 0.08] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-7 h-5 rounded-full bg-green-400 blur-xl -z-10"
        />
      )}
    </div>
  );
}
