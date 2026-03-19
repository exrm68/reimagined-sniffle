import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgeVerifyModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onExit: () => void;
  title?: string;
}

const AgeVerifyModal: React.FC<AgeVerifyModalProps> = ({ isOpen, onConfirm, onExit, title }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
          onClick={onExit}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '340px',
              background: '#111114',
              borderRadius: '24px',
              padding: '32px 24px 24px',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '16px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
            }}
          >
            {/* Shield icon */}
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              background: 'rgba(220,38,38,0.15)',
              border: '1px solid rgba(220,38,38,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '32px' }}>🔞</span>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '22px', fontWeight: 900,
                color: '#fff', letterSpacing: '0.02em',
                marginBottom: '10px',
              }}>
                AGE VERIFICATION
              </h2>
              {title && (
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px', color: 'rgba(255,255,255,0.5)',
                  marginBottom: '6px',
                }}>
                  "{title}"
                </p>
              )}
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px', lineHeight: '1.6',
                color: 'rgba(255,255,255,0.6)',
              }}>
                This content is for viewers <strong style={{ color: '#fff' }}>18 years or older</strong>. By entering, you confirm your age and consent to viewing this material.
              </p>
            </div>

            {/* Divider */}
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.07)' }} />

            {/* Buttons */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Enter button */}
              <button
                onClick={onConfirm}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: '#fff',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '14px', fontWeight: 800,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
                }}
              >
                I AM 18 OR OLDER — ENTER
              </button>

              {/* Exit button */}
              <button
                onClick={onExit}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.55)',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '13px', fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                }}
              >
                EXIT
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AgeVerifyModal;
