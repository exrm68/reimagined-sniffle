import React, { useState } from 'react';
import { AdultBannerItem, AppSettings } from '../types';
import AgeVerifyModal from './AgeVerifyModal';
import AdultContentPage from './AdultContentPage';

interface AdultBannerSectionProps {
  items: AdultBannerItem[];
  homeBannerUrl?: string;
  isHidden?: boolean;
  tutorialBanner?: string;
  tutorialLink?: string;
  appSettings?: AppSettings;
  onPageOpen?: () => void;
  onPageClose?: () => void;
}

const AdultBannerSection: React.FC<AdultBannerSectionProps> = ({ items, homeBannerUrl, isHidden, tutorialBanner, tutorialLink, appSettings, onPageOpen, onPageClose }) => {
  const [showVerify, setShowVerify] = useState(false);
  const [showPage, setShowPage] = useState(false);

  // Admin hide করলে কিছু দেখাবে না
  if (isHidden || !homeBannerUrl) return null;

  const handleConfirm = () => {
    setShowVerify(false);
    setShowPage(true);
    onPageOpen?.();
  };

  return (
    <>
      {/* ── Section header ── */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '10px',
        }}>
          <span style={{
            width: 3, height: 18,
            background: 'linear-gradient(180deg, #ec4899, #8b5cf6)',
            borderRadius: '2px', display: 'inline-block',
            boxShadow: '0 0 8px rgba(236,72,153,0.5)',
          }} />
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '15px', fontWeight: 700, color: '#fff',
          }}>🔞 18+ Content</span>
        </div>

        {/* ── YouTube 16:9 Banner ── */}
        <div
          onClick={() => setShowVerify(true)}
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%', // 16:9
            borderRadius: '16px',
            overflow: 'hidden',
            cursor: 'pointer',
            background: '#1a1a1d',
            boxShadow: '0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)',
            transform: 'translateZ(0)',
          }}
        >
          <img
            src={homeBannerUrl}
            alt="18+ Content"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              transform: 'translateZ(0)',
            }}
          />

          {/* Dark overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
            pointerEvents: 'none',
          }} />



          {/* Bottom content */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '14px 14px 16px',
            pointerEvents: 'none',
          }}>
            {/* Items count */}
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px', color: 'rgba(255,255,255,0.5)',
              marginBottom: '6px',
            }}>
              {items.length} টা content available
            </p>

            {/* Tap to enter button — clean style */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(236,72,153,0.9)',
              borderRadius: '12px', padding: '11px 22px',
              boxShadow: '0 4px 20px rgba(236,72,153,0.5)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '13px', fontWeight: 900, color: '#fff',
                letterSpacing: '0.08em',
              }}>ENTER 18+ CONTENT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Age Verify Modal */}
      <AgeVerifyModal
        isOpen={showVerify}
        onConfirm={handleConfirm}
        onExit={() => setShowVerify(false)}
      />

      {/* 18+ Content Page */}
      {showPage && (
        <AdultContentPage
          items={items}
          tutorialBanner={tutorialBanner}
          tutorialLink={tutorialLink}
          appSettings={appSettings}
          onClose={() => { setShowPage(false); onPageClose?.(); }}
        />
      )}
    </>
  );
};

export default AdultBannerSection;
