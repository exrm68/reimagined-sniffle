import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Star } from 'lucide-react';
import { Movie } from '../types';

interface BannerProps {
  movie: Movie;
  onClick: (movie: Movie) => void;
  onPlay: (movie: Movie) => void;
  currentIndex?: number;
  totalBanners?: number;
  onDotClick?: (index: number) => void;
}

const Badge: React.FC<{ label: string; variant: 'gold' | 'glass' | 'blue' }> = ({ label, variant }) => {
  const styles: Record<string, React.CSSProperties> = {
    gold: { background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', color: '#000', fontWeight: 800 },
    glass: { background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.92)', fontWeight: 600 },
    blue: { background: 'rgba(59,130,246,0.25)', color: '#93C5FD', fontWeight: 700 },
  };
  return (
    <span style={{
      ...styles[variant],
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '9px',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '4px 11px',
      borderRadius: '20px',
      display: 'inline-block',
      lineHeight: 1,
    }}>
      {label}
    </span>
  );
};

// ✅ Banner optimize করা হয়েছে:
// - 6টা nested motion element → 1টা motion.div (পুরো content একসাথে fade)
// - backdropFilter blur সরানো Info button থেকে
const Banner: React.FC<BannerProps> = ({
  movie, onClick,
  currentIndex = 0, totalBanners = 1, onDotClick
}) => {
  const displayImage = movie.bannerThumbnail || movie.thumbnail;

  return (
    <div
      onClick={() => onClick(movie)}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '2/3',
        maxHeight: '88vh',
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        // ✅ GPU layer for smooth transitions
        transform: 'translateZ(0)',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={movie.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // ✅ Duration কমানো হয়েছে 0.55 → 0.35
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* POSTER */}
          <img
            src={displayImage}
            alt={movie.title}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              pointerEvents: 'none',
              transform: 'translateZ(0)',
            }}
          />

          {/* GRADIENTS */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '22%',
            background: 'linear-gradient(to bottom, rgba(13,13,16,0.65) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '58%',
            background: 'linear-gradient(to top, rgba(13,13,16,0.98) 0%, rgba(13,13,16,0.82) 40%, rgba(13,13,16,0.3) 70%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {/* ✅ CONTENT — একটাই motion.div, সব content একসাথে fade */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0 20px 42px',
              zIndex: 20,
            }}
          >
            {/* Badges */}
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <Badge label="Trending" variant="gold" />
              <Badge label={movie.category} variant="glass" />
              {(movie.videoQuality || movie.quality) && (
                <Badge label={movie.videoQuality || movie.quality || ''} variant="blue" />
              )}
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(30px, 9vw, 46px)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: '1.0',
              marginBottom: '6px',
              letterSpacing: '-0.02em',
              textShadow: '0 2px 20px rgba(0,0,0,0.9)',
            }}>
              {movie.title}
            </h1>

            {/* Gold line */}
            <div style={{
              width: '36%',
              height: '2.5px',
              background: 'linear-gradient(90deg, #FFD700, rgba(255,215,0,0))',
              borderRadius: '2px',
              marginBottom: '10px',
            }} />

            {/* Meta */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px', fontWeight: 500,
              color: 'rgba(255,255,255,0.65)',
              marginBottom: '14px',
            }}>
              {movie.rating && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={11} fill="#FFD700" color="#FFD700" />
                  <span style={{ color: '#fff', fontWeight: 700 }}>{movie.rating}</span>
                </span>
              )}
              {movie.year && (<><span style={{ opacity: 0.3 }}>•</span><span>{movie.year}</span></>)}
              {movie.duration && (<><span style={{ opacity: 0.3 }}>•</span><span>{movie.duration}</span></>)}
            </div>

            {/* Description */}
            {movie.description && (
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px', lineHeight: '1.55',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '18px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {movie.description}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#ffffff',
                color: '#000',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '12px', fontWeight: 800,
                letterSpacing: '0.05em',
                padding: '11px 24px',
                borderRadius: '12px',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(255,255,255,0.18)',
              }}>
                <Play size={14} fill="#000" color="#000" />
                PLAY NOW
              </button>

              {/* ✅ Info button থেকে backdropFilter সরানো */}
              <button style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: 'rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.88)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px', fontWeight: 600,
                padding: '11px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.18)',
                cursor: 'pointer',
              }}>
                <Info size={13} />
                More Info
              </button>
            </div>
          </motion.div>

          {/* DOTS */}
          {totalBanners > 1 && (
            <div style={{
              position: 'absolute', bottom: 14, right: 20,
              display: 'flex', gap: '5px', zIndex: 30,
            }}>
              {[...Array(totalBanners)].map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); onDotClick?.(idx); }}
                  style={{
                    width: idx === currentIndex ? '18px' : '5px',
                    height: '4px',
                    borderRadius: '3px',
                    background: idx === currentIndex ? '#FFD700' : 'rgba(255,255,255,0.3)',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 0.3s',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Banner;
