import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { AdultBannerItem, AppSettings } from '../types';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface AdultContentPageProps {
  items: AdultBannerItem[];
  tutorialBanner?: string;
  tutorialLink?: string;
  appSettings?: AppSettings;
  onClose: () => void;
}

const PAGE_SIZE = 12;

// ── Unlock helpers ──
const getPermanentKey = (id: string) => `adult_perm_${id}`;
const getUnlock24Key = (id: string) => `adult_24_${id}`;

const checkUnlocked = (id: string): { unlocked: boolean; permanent: boolean; hoursLeft: number } => {
  if (localStorage.getItem(getPermanentKey(id)) === '1') return { unlocked: true, permanent: true, hoursLeft: 0 };
  const ts = localStorage.getItem(getUnlock24Key(id));
  if (!ts) return { unlocked: false, permanent: false, hoursLeft: 0 };
  const diff = Date.now() - parseInt(ts, 10);
  const hrs24 = 24 * 3600 * 1000;
  if (diff < hrs24) return { unlocked: true, permanent: false, hoursLeft: Math.ceil((hrs24 - diff) / 3600000) };
  return { unlocked: false, permanent: false, hoursLeft: 0 };
};

const AdultContentPage: React.FC<AdultContentPageProps> = ({ items, tutorialBanner, tutorialLink, appSettings, onClose }) => {
  const allCats = Array.from(new Set(items.map(i => i.category || 'General')));
  const [activeCat, setActiveCat] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const currentCat = activeCat || allCats[0] || '';
  const filtered = items.filter(i => (i.category || 'General') === currentCat);
  const displayed = filtered.slice(0, visibleCount);

  useEffect(() => { if (!activeCat && allCats.length > 0) setActiveCat(allCats[0]); }, [items]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeCat]);

  useEffect(() => {
    const el = sentinelRef.current; if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filtered.length && !loadingMore) {
        setLoadingMore(true);
        setTimeout(() => { setVisibleCount(p => p + PAGE_SIZE); setLoadingMore(false); }, 400);
      }
    }, { rootMargin: '200px' });
    obs.observe(el); return () => obs.disconnect();
  }, [visibleCount, filtered.length, loadingMore]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d0d10', zIndex: 200, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      {/* ── Header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(to bottom, #0d0d10 80%, transparent)', padding: '14px 16px 10px', transform: 'translateZ(0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={20} color="#fff" />
            </button>
            <div>
              {/* ✅ শুধু CINEFLIX — ADULT HUB pill নেই */}
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', letterSpacing: '1px', background: 'linear-gradient(90deg, #FFD700, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CINEFLIX</span>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>18+ Content · Adults only</p>
            </div>
          </div>
          <div style={{ background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '20px', padding: '4px 10px' }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '11px', fontWeight: 700, color: '#ec4899' }}>{filtered.length} videos</span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {allCats.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)} style={{
              flexShrink: 0, padding: '7px 16px', borderRadius: '20px',
              border: currentCat === cat ? 'none' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700,
              background: currentCat === cat ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'rgba(255,255,255,0.06)',
              color: currentCat === cat ? '#fff' : 'rgba(255,255,255,0.5)',
              boxShadow: currentCat === cat ? '0 3px 12px rgba(236,72,153,0.4)' : 'none',
            }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '10px 16px 100px' }}>
        {tutorialBanner && (
          <div onClick={() => tutorialLink && window.open(tutorialLink, '_blank')} style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '14px', cursor: tutorialLink ? 'pointer' : 'default' }}>
            <img src={tutorialBanner} alt="Tutorial" style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        {displayed.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Sans',sans-serif", fontSize: '13px' }}>এই category তে কোনো content নেই</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayed.map(item => <ContentCard key={item.id} item={item} appSettings={appSettings} />)}
          </div>
        )}

        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '16px 0' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#ec4899', animation: `bounce 0.8s ease-in-out ${i*0.15}s infinite` }} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Ad runner ──
const runOneAd = (appSettings?: AppSettings): Promise<'watched'|'skipped'> => new Promise(resolve => {
  const monetagZoneId = appSettings?.adZoneId || '';
  const adsgramBlockId = appSettings?.adsgramBlockId || '';
  const useAdsgram = !!(appSettings?.adsgramEnabled && adsgramBlockId);
  if (useAdsgram) {
    let t = 0;
    const try_ = () => {
      // @ts-ignore
      const A = window.Adsgram;
      if (A) { try { A.init({ blockId: String(adsgramBlockId) }).show().then(()=>resolve('watched')).catch(()=>resolve('skipped')); } catch { resolve('skipped'); } }
      else if (t++ < 25) setTimeout(try_, 400); else resolve('skipped');
    }; try_();
  } else {
    let t = 0;
    const try_ = () => {
      // @ts-ignore
      const fn = window[`show_${monetagZoneId}`];
      if (typeof fn === 'function') fn().then(()=>resolve('watched')).catch(()=>resolve('skipped'));
      else if (t++ < 30) setTimeout(try_, 200); else resolve('skipped');
    }; try_();
  }
});

// ── Alert Modal ──
const AlertModal: React.FC<{ message: string; type: 'error'|'success'|'info'; onClose: ()=>void }> = ({ message, type, onClose }) => {
  const bg = { error: '#ef4444', success: '#22c55e', info: '#8b5cf6' }[type];
  const icon = { error: '❌', success: '✅', info: 'ℹ️' }[type];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#18181b', borderRadius: '20px', padding: '28px 20px', width: '100%', maxWidth: 300, border: `1px solid ${bg}30`, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: '#fff', lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-line' }}>{message}</p>
        <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: bg, color: '#fff', fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>OK</button>
      </div>
    </div>
  );
};

// ── Content Card ──
const ContentCard: React.FC<{ item: AdultBannerItem; appSettings?: AppSettings }> = ({ item, appSettings }) => {
  const isPremium = item.isPremium === true;
  const premiumPrice = item.premiumPrice || appSettings?.adultDefaultPrice || 5;

  // ✅ Per-content ad count — admin এ set করা
  const globalAdCount = appSettings?.defaultWatchAdCount ?? 0;
  const freeAdCount = item.watchAdCount !== undefined && item.watchAdCount >= 0 ? item.watchAdCount : globalAdCount;
  // Premium: পেমেন্টের পরেও ads
  const premiumAdCount = item.premiumWatchAdCount !== undefined && item.premiumWatchAdCount >= 0 ? item.premiumWatchAdCount : 0;

  const adsEnabled = !!(appSettings?.adEnabled && (appSettings?.adZoneId || appSettings?.adsgramBlockId));

  const [unlockState] = useState(() => checkUnlocked(item.id));
  const [unlocked, setUnlocked] = useState(unlockState.unlocked);
  const [isPermanent] = useState(unlockState.permanent);
  const [hoursLeft] = useState(unlockState.hoursLeft);

  // Phase: 'free_ads' | 'paid' | 'premium_ads' | 'done'
  const [phase, setPhase] = useState<'free_ads'|'paid'|'premium_ads'|'done'>(() => {
    if (unlockState.unlocked) return 'done';
    if (isPremium) return 'paid';
    return 'free_ads';
  });
  const [watched, setWatched] = useState(0);
  const [adLoading, setAdLoading] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [alert, setAlert] = useState<{msg:string; type:'error'|'success'|'info'}|null>(null);
  const lastAdRef = useRef(0);

  const openLink = useCallback(async () => {
    if (!item.channelLink) return;
    try { await updateDoc(doc(db, 'adultContent', item.id), { views: increment(1) }); } catch {}
    // @ts-ignore
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(item.channelLink);
    else window.open(item.channelLink, '_blank');
  }, [item.channelLink, item.id]);

  const startCooldown = useCallback(() => {
    const s = appSettings?.taskCooldownSecs ?? 5;
    lastAdRef.current = Date.now();
    let rem = s; setCooldown(rem);
    const iv = setInterval(() => { rem--; if (rem <= 0) { clearInterval(iv); setCooldown(0); } else setCooldown(rem); }, 1000);
  }, [appSettings]);

  const saveUnlock = useCallback(async (permanent: boolean) => {
    if (permanent) localStorage.setItem(getPermanentKey(item.id), '1');
    else localStorage.setItem(getUnlock24Key(item.id), String(Date.now()));
    setUnlocked(true);
    setPhase('done');
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser) {
      const uid = String(tgUser.id);
      try {
        await setDoc(doc(db, `users/${uid}/adultUnlocks`, item.id), {
          itemId: item.id, title: item.title,
          unlockedAt: serverTimestamp(),
          type: permanent ? 'premium' : 'ads',
          permanent,
          expiresAt: permanent ? null : new Date(Date.now() + 24*3600*1000),
        });
      } catch {}
    }
  }, [item.id, item.title]);

  const handleWatch = useCallback(async () => {
    if (phase === 'done') { openLink(); return; }
    if (adLoading || cooldown > 0) return;

    // ── Phase: paid (premium content, ask for taka) ──
    if (phase === 'paid') {
      setAdLoading(true);
      try {
        const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
        if (!tgUser) { setAlert({ msg: 'Telegram এ login করো!', type: 'error' }); setAdLoading(false); return; }
        const uid = String(tgUser.id);
        const snap = await getDoc(doc(db, 'users', uid));
        const bal = snap.data()?.takaBalance || 0;
        if (bal < premiumPrice) {
          setAlert({ msg: `টাকা কম!\n\n৳${premiumPrice} দরকার, তোমার account এ আছে ৳${bal.toFixed(2)}\n\nটাস্ক করে বা রেফার করে টাকা যোগ করো।`, type: 'error' });
          setAdLoading(false); return;
        }
        await updateDoc(doc(db, 'users', uid), { takaBalance: increment(-premiumPrice) });
        await addDoc(collection(db, `users/${uid}/coinHistory`), {
          type: 'spend', reason: `🔞 Premium: ${item.title}`,
          amount: premiumPrice, currency: 'taka', createdAt: serverTimestamp(),
        });
        setAdLoading(false);
        // ✅ After paying — check if premium also needs ads
        if (adsEnabled && premiumAdCount > 0) {
          setPhase('premium_ads');
          setWatched(0);
        } else {
          await saveUnlock(true);
          setTimeout(() => openLink(), 300);
        }
      } catch(e) {
        setAlert({ msg: 'Error! আবার চেষ্টা করো।', type: 'error' });
        setAdLoading(false);
      }
      return;
    }

    // ── Phase: free_ads or premium_ads ──
    const totalAds = phase === 'premium_ads' ? premiumAdCount : freeAdCount;
    if (!adsEnabled || totalAds <= 0) {
      if (phase === 'free_ads') await saveUnlock(false);
      else await saveUnlock(true);
      setTimeout(() => openLink(), 300); return;
    }

    const diff = Date.now() - lastAdRef.current;
    const coolSecs = appSettings?.taskCooldownSecs ?? 5;
    if (lastAdRef.current > 0 && diff < coolSecs * 1000) return;

    setAdLoading(true); setSkipped(false);
    const result = await runOneAd(appSettings);
    setAdLoading(false);
    startCooldown();

    if (result === 'skipped') { setSkipped(true); return; }

    const newW = watched + 1;
    setWatched(newW);
    if (newW >= totalAds) {
      const perm = phase === 'premium_ads';
      await saveUnlock(perm);
      setTimeout(() => openLink(), 300);
    }
  }, [phase, adLoading, cooldown, watched, freeAdCount, premiumAdCount, adsEnabled, premiumPrice, appSettings, openLink, saveUnlock, startCooldown, item.title]);

  // Button label
  const totalAds = phase === 'premium_ads' ? premiumAdCount : freeAdCount;
  const btnLabel = () => {
    if (phase === 'done') return '▶ WATCH NOW';
    if (adLoading) return phase === 'paid' ? 'Processing...' : 'Ad লোড হচ্ছে...';
    if (cooldown > 0) return `⏳ ${cooldown}s`;
    if (phase === 'paid') return `৳${premiumPrice} দিয়ে Unlock করো`;
    if (phase === 'premium_ads') return `🔓 UNLOCK (${watched}/${totalAds}) — Ad`;
    if (!adsEnabled || freeAdCount <= 0) return '▶ WATCH NOW';
    return `🔓 UNLOCK (${watched}/${freeAdCount})`;
  };

  const btnColor = () => {
    if (phase === 'done') return 'linear-gradient(135deg, #22c55e, #16a34a)';
    if (adLoading || cooldown > 0) return 'rgba(255,255,255,0.08)';
    if (phase === 'paid' || phase === 'premium_ads') return 'linear-gradient(135deg, #f59e0b, #d97706)';
    return 'linear-gradient(135deg, #1877F2, #0a5cd8)';
  };

  return (
    <>
      {alert && <AlertModal message={alert.msg} type={alert.type} onClose={() => setAlert(null)} />}
      <div style={{ background: '#18181b', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Thumbnail */}
          <div style={{ position: 'relative', width: '140px', flexShrink: 0, aspectRatio: '16/9', alignSelf: 'center', margin: '10px 0 10px 10px', borderRadius: '10px', overflow: 'hidden', background: '#111' }}>
            <img src={item.thumbnail} alt={item.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* ✅ No price badge on thumbnail */}
            {item.duration && (
              <div style={{ position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,0.8)', borderRadius: '4px', padding: '2px 5px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{item.duration}</span>
              </div>
            )}
            {phase === 'done' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px' }}>▶</span>
              </div>
            )}
          </div>

          {/* Right */}
          <div style={{ flex: 1, padding: '12px 12px 12px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700, color: '#fff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.3', marginBottom: '4px' }}>
              {item.title}
            </p>

            {/* Unlock status */}
            {phase === 'done' && (
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontSize: '10px', color: '#22c55e', fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>
                  {isPermanent ? '✅ Permanent Unlock' : `⏰ ${hoursLeft}hr বাকি`}
                </span>
              </div>
            )}

            {/* Phase indicator */}
            {phase === 'premium_ads' && (
              <p style={{ fontSize: '10px', color: '#f59e0b', fontFamily: "'DM Sans',sans-serif", marginBottom: '4px', fontWeight: 700 }}>✅ Payment done! Ad দেখো →</p>
            )}
            {skipped && <p style={{ fontSize: '10px', color: '#f87171', fontFamily: "'DM Sans',sans-serif", marginBottom: '4px' }}>⚠️ Ad skip, আবার চেষ্টা করো</p>}
            {phase === 'free_ads' && adsEnabled && freeAdCount > 0 && (
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '11px', fontWeight: 700, color: '#ec4899', marginBottom: '5px' }}>WATCH & UNLOCK 😊</p>
            )}

            {/* Progress dots */}
            {(phase === 'free_ads' || phase === 'premium_ads') && adsEnabled && totalAds > 1 && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                {Array.from({ length: totalAds }).map((_, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < watched ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'rgba(255,255,255,0.15)' }} />
                ))}
              </div>
            )}

            {/* Button */}
            <button onClick={handleWatch} disabled={adLoading || cooldown > 0} style={{
              width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
              background: btnColor(),
              color: (adLoading || cooldown > 0) ? 'rgba(255,255,255,0.4)' : (phase === 'paid' || phase === 'premium_ads') ? '#000' : '#fff',
              fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 800,
              cursor: (adLoading || cooldown > 0) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', letterSpacing: '0.03em', transition: 'all 0.2s',
            }}>
              {adLoading && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
              {btnLabel()}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdultContentPage;
