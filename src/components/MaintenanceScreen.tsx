import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

interface MaintenanceScreenProps {
  channelLink?: string;
  buttonText?: string;
  buttonLink?: string;
  message?: string;
  startTime?: string;
  endTime?: string;
  appName?: string;
  onLogoTap?: () => void;
}

const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  channelLink = '',
  buttonText = '',
  buttonLink = '',
  message = 'আমাদের সার্ভার আপডেট চলছে। শীঘ্রই ফিরে আসছি!',
  startTime = '',
  endTime = '',
  appName = 'Cineflix',
  onLogoTap,
}) => {
  const [tapCount, setTapCount] = useState(0);
  const tapTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLogoTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapCount(0), 2000);
    if (next >= 5) { setTapCount(0); onLogoTap?.(); }
  };

  const handleButton = () => {
    const link = buttonLink || channelLink;
    if (!link) return;
    // @ts-ignore
    if (window.Telegram?.WebApp?.openTelegramLink && link.startsWith('https://t.me/')) {
      // @ts-ignore
      window.Telegram.WebApp.openTelegramLink(link);
    } else {
      window.open(link, '_blank');
    }
  };

  const displayButtonText = buttonText || 'আমাদের Channel এ Join করুন';
  const hasButton = !!(buttonLink || channelLink);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #080810 0%, #0d0d14 100%)' }}>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }} />
      </div>

      {/* LOGO — 5 tap = admin */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }} className="relative z-10 mb-10 cursor-pointer"
        onClick={handleLogoTap}>
        <h1 className="text-center" style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(52px, 16vw, 72px)',
          letterSpacing: '0.12em',
          background: 'linear-gradient(180deg, #FFD700 0%, #FFA500 60%, #CC7700 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 30px rgba(255,180,0,0.25))',
        }}>
          {appName}
        </h1>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="h-[2px] mt-1 mx-auto"
          style={{ width: '60%', background: 'linear-gradient(90deg, transparent, #FFD700, transparent)', transformOrigin: 'center' }} />
      </motion.div>

      {/* Spinner */}
      <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.5, type: 'spring' }}
        className="relative z-10 mb-7">
        <div className="relative w-[88px] h-[88px] flex items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid transparent', borderTopColor: '#FFD700', borderRightColor: 'rgba(255,215,0,0.25)' }} />
          <motion.div animate={{ rotate: -360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-[10px] rounded-full"
            style={{ border: '1.5px solid transparent', borderTopColor: 'rgba(255,165,0,0.5)', borderBottomColor: 'rgba(255,165,0,0.2)' }} />
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <span className="text-2xl">🔧</span>
          </div>
        </div>
      </motion.div>

      {/* Status badge */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }} className="relative z-10 mb-4">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.18)' }}>
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-yellow-400 text-xs font-black tracking-widest uppercase">আপডেট চলছে</span>
        </div>
      </motion.div>

      {/* Message */}
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative z-10 text-center text-zinc-400 text-sm leading-relaxed max-w-[280px] mb-7">
        {message}
      </motion.p>

      {/* Time info */}
      <AnimatePresence>
        {(startTime || endTime) && (
          <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ delay: 0.45 }}
            className="relative z-10 w-full max-w-[300px] mb-7 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="px-5 py-4 flex items-center gap-4">
              <Clock size={18} className="text-yellow-500 flex-shrink-0" />
              <div className="space-y-1">
                {startTime && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">শুরু</span>
                    <span className="text-amber-300 text-sm font-bold">{startTime}</span>
                  </div>
                )}
                {endTime && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">শেষ</span>
                    <span className="text-emerald-400 text-sm font-bold">{endTime}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action button */}
      {hasButton && (
        <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 240, damping: 22 }}
          onClick={handleButton} whileTap={{ scale: 0.96 }}
          className="relative z-10 w-full max-w-[300px] py-4 rounded-2xl font-black text-sm overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0088cc 0%, #005f99 100%)',
            boxShadow: '0 4px 24px rgba(0,136,204,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            color: '#fff',
          }}>
          <motion.div animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
            className="absolute inset-0 w-1/2"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
          <span className="relative flex items-center justify-center gap-2.5">
            <span className="text-base">✈️</span>
            {displayButtonText}
          </span>
        </motion.button>
      )}

      {/* Note */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="relative z-10 text-zinc-700 text-[11px] mt-5 text-center leading-relaxed">
        সব ঠিক হলে এই page আপনাআপনি চলে যাবে
      </motion.p>

      {/* Loader dots */}
      <div className="absolute bottom-8 flex gap-2 z-10">
        {[0, 1, 2].map(i => (
          <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.8, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.2 }}
            className="w-1.5 h-1.5 rounded-full" style={{ background: '#FFD700' }} />
        ))}
      </div>
    </div>
  );
};

export default MaintenanceScreen;
