import React from 'react';
import { Movie } from '../types';

interface TrendingRowProps {
  movies: Movie[];
  onClick: (movie: Movie) => void;
}

// Number এর gradient colors — প্রতিটা আলাদা রঙ
const NUMBER_COLORS = [
  '#FFD700', // 1 - Gold
  '#FF6B6B', // 2 - Red
  '#4ECDC4', // 3 - Teal
  '#A78BFA', // 4 - Purple
  '#F59E0B', // 5 - Amber
  '#34D399', // 6 - Green
  '#60A5FA', // 7 - Blue
  '#F472B6', // 8 - Pink
  '#FB923C', // 9 - Orange
  '#A3E635', // 10 - Lime
];

const TrendingRow: React.FC<TrendingRowProps> = React.memo(({ movies, onClick }) => {
  if (!movies || movies.length === 0) return null;

  return (
    <div style={{ marginBottom: '8px' }}>

      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '14px', paddingLeft: '2px',
      }}>
        <span style={{
          width: 3, height: 18,
          background: 'linear-gradient(180deg, #FFD700, #FFA500)',
          borderRadius: '2px',
          display: 'inline-block',
          boxShadow: '0 0 8px rgba(255,215,0,0.5)',
        }} />
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '15px', fontWeight: 700,
          color: '#fff', letterSpacing: '-0.01em',
        }}>Top 10 এই সপ্তাহে</span>
      </div>

      {/* Scroll row */}
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '8px',
          paddingLeft: '2px',
          paddingRight: '12px',
          paddingBottom: '10px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {movies.slice(0, 10).map((movie, index) => (
          <div
            key={movie.id}
            onClick={() => onClick(movie)}
            style={{
              position: 'relative',
              flexShrink: 0,
              // ✅ বড় করা হয়েছে: আগে 100x150, এখন 115x172
              width: '115px',
              height: '172px',
              cursor: 'pointer',
              transform: 'translateZ(0)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* ✅ সুন্দর Number — stroke + color, নিচে বাম কোণে */}
            <div style={{
              position: 'absolute',
              left: '0px',
              bottom: '-4px',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '86px',
              fontWeight: 900,
              lineHeight: 1,
              zIndex: 10,
              userSelect: 'none',
              pointerEvents: 'none',
              // ✅ রঙিন stroke — প্রতিটা number আলাদা রঙ
              WebkitTextStroke: `3px ${NUMBER_COLORS[index] || '#FFD700'}`,
              color: 'transparent',
              letterSpacing: '-4px',
            }}>
              {index + 1}
            </div>

            {/* Card — number এর ডানদিকে, উপরে */}
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              // ✅ বড় card: আগে 82x122, এখন 88x140
              width: '88px',
              height: '140px',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#111114',
              zIndex: 20,
              boxShadow: '0 6px 20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
            }}>
              <img
                src={movie.thumbnail}
                alt={movie.title}
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', objectPosition: 'center top',
                  transform: 'translateZ(0)',
                }}
              />
              {/* Bottom gradient */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)',
                pointerEvents: 'none',
              }} />

            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

TrendingRow.displayName = 'TrendingRow';

export default TrendingRow;
