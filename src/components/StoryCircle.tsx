import React from 'react';
import { Movie } from '../types';

interface StoryCircleProps {
  movie: Movie;
  onClick: (movie: Movie) => void;
  index: number;
  storyBadge?: string;
}

const getBadgeStyle = (badge: string): string => {
  const b = badge.toUpperCase();
  if (b === 'HOT') return 'bg-gradient-to-r from-red-600 to-orange-500 text-white border-red-700';
  if (b === 'NEW') return 'bg-gradient-to-r from-emerald-500 to-green-400 text-white border-emerald-700';
  if (b === 'TOP') return 'bg-gradient-to-r from-gold to-yellow-400 text-black border-yellow-600';
  if (b === 'LIVE') return 'bg-gradient-to-r from-red-500 to-red-400 text-white border-red-700 animate-pulse';
  if (b.startsWith('#')) return 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white border-purple-700';
  return 'bg-gradient-to-r from-gold to-yellow-400 text-black border-yellow-600';
};

// ✅ React.memo — re-render বন্ধ
// ✅ motion.div সরানো হয়েছে — 8টা staggered animation বন্ধ
const StoryCircle: React.FC<StoryCircleProps> = React.memo(({ movie, onClick, storyBadge }) => {
  return (
    <div
      className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
      onClick={() => onClick(movie)}
      // ✅ CSS transition only — framer-motion overhead নেই
      style={{ 
        transform: 'translateZ(0)',
        contain: 'layout style',
      }}
    >
      {/* Gradient Ring */}
      <div className="relative w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-b from-[#ff0055] via-[#ff0055] to-gold shadow-[0_4px_14px_rgba(255,0,85,0.35)]"
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Inner border */}
        <div className="w-full h-full rounded-full bg-black p-[2.5px] overflow-hidden relative">
          <img
            src={movie.thumbnail}
            alt={movie.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full rounded-full object-cover object-top"
            style={{ transform: 'translateZ(0)' }}
          />
          <div className="absolute inset-0 bg-black/10 rounded-full" style={{ pointerEvents: 'none' }} />
        </div>

        {/* Badge */}
        {storyBadge && storyBadge.trim() !== '' && (
          <div
            className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-black px-1.5 py-0.5 rounded-full border shadow-md whitespace-nowrap ${getBadgeStyle(storyBadge)}`}
            style={{ minWidth: '24px', textAlign: 'center' }}
          >
            {storyBadge.toUpperCase()}
          </div>
        )}
      </div>

      <span className="text-[9px] text-gray-300 w-14 truncate text-center font-medium">
        {movie.title.split(' ')[0]}
      </span>
    </div>
  );
});

StoryCircle.displayName = 'StoryCircle';

export default StoryCircle;
