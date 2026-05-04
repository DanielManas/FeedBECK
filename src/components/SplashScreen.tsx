import React from 'react';
import { motion } from 'motion/react';
import Logo from './Logo';

export default function SplashScreen({ status }: { status?: string, key?: React.Key }) {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-smog-950"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center justify-center"
      >
        <motion.div 
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="drop-shadow-[0_0_50px_rgba(74,222,128,0.2)]"
        >
          <Logo size={180} />
        </motion.div>
        
        {/* App Title & Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-12 flex flex-col items-center gap-6"
        >
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-moss-400 text-2xl font-black uppercase tracking-[0.5em] drop-shadow-lg ml-[0.5em]">
              FeedBECK
            </h1>
            <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-moss-500/30 to-transparent" />
          </div>
          
          <div className="flex flex-col items-center min-h-[40px] justify-center">
            {status && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={status}
                className="text-[10px] text-moss-500/50 font-bold uppercase tracking-[0.3em] animate-pulse"
              >
                {status}
              </motion.span>
            )}
            
            {!status && (
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-1 h-1 rounded-full bg-moss-500/40"
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Decorative Atmosphere - Pulse */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.15, 0.1]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-moss-500/10 rounded-full blur-[120px] pointer-events-none" 
      />
    </motion.div>
  );
}
