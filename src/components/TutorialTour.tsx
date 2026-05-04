import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTutorial, STEPS } from '../context/TutorialContext';

export default function TutorialTour() {
  const { currentStep, nextStep, prevStep, completeTutorial } = useTutorial();
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateHighlight = () => {
      const step = STEPS[currentStep];
      const element = document.getElementById(step.targetId);
      if (element) {
        setHighlightRect(element.getBoundingClientRect());
      } else {
        setHighlightRect(null);
      }
    };

    const step = STEPS[currentStep];
    const element = document.getElementById(step.targetId);
    
    // Give time for page transitions
    const timer = setTimeout(() => {
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      updateHighlight();
    }, 300);

    const checkInterval = setInterval(updateHighlight, 100);
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);

    return () => {
      clearTimeout(timer);
      clearInterval(checkInterval);
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [currentStep]);

  if (!highlightRect) return null;

  const step = STEPS[currentStep];

  const getPopoverStyle = () => {
    const PADDING = 16;
    const POPOVER_WIDTH = 300;
    // We'll use a safer estimation for height since content varies
    const POPOVER_ESTIMATED_HEIGHT = 200; 
    
    let style: React.CSSProperties = {
      position: 'fixed',
      width: POPOVER_WIDTH,
      zIndex: 110,
      pointerEvents: 'auto'
    };

    if (step.position === 'center') {
      style.top = '50%';
      style.left = '50%';
      style.transform = 'translate(-50%, -50%)';
      return style;
    }

    // Calculate Horizontal Position (Center it on the element but stay in bounds)
    const elementCenterX = highlightRect.left + highlightRect.width / 2;
    let left = elementCenterX - POPOVER_WIDTH / 2;
    
    // Clamp horizontal
    left = Math.max(PADDING, Math.min(window.innerWidth - POPOVER_WIDTH - PADDING, left));
    style.left = left;

    // Calculate Vertical Position
    const spaceAbove = highlightRect.top;
    const spaceBelow = window.innerHeight - highlightRect.bottom;

    if (step.position === 'bottom') {
      // Try bottom first
      if (spaceBelow >= POPOVER_ESTIMATED_HEIGHT + PADDING) {
        style.top = highlightRect.bottom + PADDING;
      } else if (spaceAbove >= POPOVER_ESTIMATED_HEIGHT + PADDING) {
        // Flip to top if space exists
        style.bottom = (window.innerHeight - highlightRect.top) + PADDING;
      } else {
        // Center vertically if no space on either side (fallback)
        style.top = '50%';
        style.transform = 'translateY(-50%)';
      }
    } else { // position === 'top'
      // Try top first
      if (spaceAbove >= POPOVER_ESTIMATED_HEIGHT + PADDING) {
        style.bottom = (window.innerHeight - highlightRect.top) + PADDING;
      } else if (spaceBelow >= POPOVER_ESTIMATED_HEIGHT + PADDING) {
        // Flip to bottom
        style.top = highlightRect.bottom + PADDING;
      } else {
        // Fallback
        style.top = '50%';
        style.transform = 'translateY(-50%)';
      }
    }

    // Final safety check: if top is set, make sure it doesn't exceed window height
    if (style.top && typeof style.top === 'number' && style.top + POPOVER_ESTIMATED_HEIGHT > window.innerHeight) {
      style.top = window.innerHeight - POPOVER_ESTIMATED_HEIGHT - PADDING;
    }
    
    // Final safety check: if bottom is set, make sure it doesn't exceed window height
    if (style.bottom && typeof style.bottom === 'number' && style.bottom + POPOVER_ESTIMATED_HEIGHT > window.innerHeight) {
      style.bottom = window.innerHeight - POPOVER_ESTIMATED_HEIGHT - PADDING;
    }

    return style;
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Absolute Backdrop with cutout effect */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <motion.rect 
              initial={false}
              animate={{
                x: highlightRect.left - 8,
                y: highlightRect.top - 8,
                width: highlightRect.width + 16,
                height: highlightRect.height + 16,
              }}
              rx="16" 
              fill="black" 
            />
          </mask>
        </defs>
        <rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(0,0,0,0.75)" 
          className="transition-all duration-500"
          mask="url(#tutorial-mask)" 
        />
      </svg>

      {/* Target area focus visual with Pulse Glow */}
      <motion.div 
        initial={false}
        animate={{
          left: highlightRect.left - 12,
          top: highlightRect.top - 12,
          width: highlightRect.width + 24,
          height: highlightRect.height + 24,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute border-2 border-moss-400 rounded-2xl pointer-events-none"
        style={{
          boxShadow: '0 0 40px rgba(74, 222, 128, 0.4), inset 0 0 10px rgba(74, 222, 128, 0.2)',
          zIndex: 105
        }}
      >
        <motion.div 
          animate={{ 
            boxShadow: [
              '0 0 20px rgba(74, 222, 128, 0.4)',
              '0 0 100px rgba(74, 222, 128, 0.9)',
              '0 0 20px rgba(74, 222, 128, 0.4)'
            ]
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-2xl font-black text-xs text-moss-400 flex items-center justify-center opacity-40 uppercase tracking-tighter"
        />
      </motion.div>

      {/* Popover */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed p-6 bg-[#1a1a1a] border border-white/10 rounded-[32px] shadow-2xl pointer-events-auto z-[110]"
        style={getPopoverStyle()}
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-moss-400">
              Tutorial {currentStep + 1} / {STEPS.length}
            </span>
            <button 
              onClick={completeTutorial}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-gray-200 font-medium leading-relaxed">
            {step.text}
          </p>

          <div className="flex gap-2 pt-2">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="flex-1 py-3 px-4 rounded-2xl glass text-xs font-black uppercase tracking-widest text-gray-400 flex items-center justify-center gap-1"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex-[3] py-3 px-4 rounded-2xl bg-moss-500 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-moss-900/40"
            >
              {currentStep === STEPS.length - 1 ? 'Começar' : 'Entendi'} 
              {currentStep < STEPS.length - 1 && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
