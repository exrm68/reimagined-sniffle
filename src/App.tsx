import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { Send, Sparkles, TrendingUp, Award, Film, Tv, Heart, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot, doc, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';

import { Movie, Category, AppSettings, BannerItem, AdultBannerItem } from './types';
import { CATEGORIES, BOT_USERNAME } from './constants';

import MovieTile from './components/MovieTile';
import Sidebar from './components/Sidebar';
import MovieDetails from './components/MovieDetails';
import Banner from './components/Banner';
import TrendingRow from './components/TrendingRow';
import BottomNav from './components/BottomNav';
import Explore from './components/Explore';
import Watchlist from './components/Watchlist';
import NoticeBar from './components/NoticeBar';
import SplashScreen from './components/SplashScreen';
import MaintenanceScreen from './components/MaintenanceScreen';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import AdultBannerSection from './components/AdultBannerSection';

type Tab = 'home' | 'search' | 'favorites' | 'profile';

const App: React.FC = () => {
  // Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [maintenance, setMaintenance] = useState<null|{message:string;startTime:string;endTime:string;channelLink:string;appName:string;buttonText:string;buttonLink:string}>(null);

  // State
  const [movies, setMovies] = useState<Movie[]>([]);
  // ✅ Firestore Pagination state
  const PAGE_SIZE = 18;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<any>(null);
  // ✅ Ref দিয়ে loading guard — stale closure সমস্যা নেই
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [continueWatching, setContinueWatching] = useState<Array<{movieId: string, timestamp: number}>>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
      botUsername: BOT_USERNAME,
      channelLink: 'https://t.me/cineflixrequestcontent'
  });
  
  // Banner & Stories from Firestore
  const [bannerItems, setBannerItems] = useState<BannerItem[]>([]);
  // ✅ 18+ Adult Content
  const [adultBanners, setAdultBanners] = useState<AdultBannerItem[]>([]);
  const [isAdultPageOpen, setIsAdultPageOpen] = useState(false);
  
  // Navigation & Scroll State
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Admin Panel State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Category State
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  // Story State
  
  // Banner State
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Secret Admin Access Handler
  const handleLogoTap = () => {
    setTapCount(prev => prev + 1);
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
    }, 2000);
  };

  // Check for admin access (5-7 taps)
  useEffect(() => {
    if (tapCount >= 5 && tapCount <= 7) {
      setIsAdminOpen(true);
      setTapCount(0);
    }
  }, [tapCount]);

  // ✅ fetchMovies — ref দিয়ে guard, stale closure নেই
  const fetchMovies = useCallback(async (isFirstLoad = false) => {
    // ✅ Ref চেক — state নয়, তাই stale closure হবে না
    if (isLoadingRef.current && !isFirstLoad) return;
    if (!hasMoreRef.current && !isFirstLoad) return;

    isLoadingRef.current = true;
    setIsLoadingMore(true);

    const tryFetch = async (withOrder: boolean) => {
      let q;
      if (isFirstLoad || !lastDocRef.current) {
        q = withOrder
          ? query(collection(db, 'movies'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : query(collection(db, 'movies'), limit(PAGE_SIZE));
      } else {
        q = withOrder
          ? query(collection(db, 'movies'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE), startAfter(lastDocRef.current))
          : query(collection(db, 'movies'), limit(PAGE_SIZE), startAfter(lastDocRef.current));
      }
      return getDocs(q);
    };

    try {
      let snapshot;
      try {
        snapshot = await tryFetch(true); // createdAt orderBy দিয়ে চেষ্টা
      } catch {
        snapshot = await tryFetch(false); // fallback: orderBy ছাড়া
      }

      if (snapshot.empty) {
        hasMoreRef.current = false;
        setHasMore(false);
      } else {
        const newMovies = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Movie[];
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < PAGE_SIZE) {
          hasMoreRef.current = false;
          setHasMore(false);
        }
        setMovies(prev => {
          if (isFirstLoad) return newMovies;
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMovies.filter(m => !ids.has(m.id))];
        });
      }
    } catch (err) {
      console.warn('Firestore fetch failed:', err);
    }

    isLoadingRef.current = false;
    setIsLoadingMore(false);
  }, []); // ✅ dependency খালি — stale closure নেই

  // Initialize & Fetch Data
  useEffect(() => {
    // 1. প্রথম batch load
    fetchMovies(true);

    // ✅ Realtime listener শুধু settings, banners, stories এর জন্য — movies না
    const unsubscribeMovies = () => {}; // placeholder

    // 2. Fetch Settings from Firestore
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
        if (doc.exists()) {
            const data = doc.data() as AppSettings;
            setAppSettings(data);
            // ✅ Maintenance mode
            if (data.maintenanceEnabled) {
              setMaintenance({ message: data.maintenanceMessage || 'আমাদের সার্ভার আপডেট চলছে।', startTime: data.maintenanceStartTime || '', endTime: data.maintenanceEndTime || '', channelLink: data.channelLink || '', appName: data.appName || 'Cineflix', buttonText: data.maintenanceButtonText || '', buttonLink: data.maintenanceButtonLink || data.channelLink || '' });
            } else {
              setMaintenance(null);
            }

            // ✅ Dynamic Ad SDK Injection (Monetag OR Adsgram — never both)
            const existingMonetag = document.getElementById('monetag-ad-script');
            if (existingMonetag) existingMonetag.remove();
            const existingAdsgram = document.getElementById('adsgram-sdk-script');
            if (existingAdsgram) existingAdsgram.remove();

            const useAdsgram = !!(data.adEnabled && data.adsgramEnabled && data.adsgramBlockId);

            if (useAdsgram) {
              // ── Adsgram SDK ──────────────────────────────────────
              const script = document.createElement('script');
              script.id = 'adsgram-sdk-script';
              script.src = 'https://sad.adsgram.ai/js/sad.min.js';
              script.async = true;
              script.onload = () => {
                console.log('✅ Adsgram SDK loaded, blockId:', data.adsgramBlockId);
              };
              script.onerror = () => {
                console.warn('❌ Adsgram SDK failed to load');
              };
              document.head.appendChild(script);
            } else if (data.adEnabled && data.adZoneId) {
              // ── Monetag SDK ──────────────────────────────────────
              const script = document.createElement('script');
              script.id = 'monetag-ad-script';
              script.src = data.adScriptUrl || '//libtl.com/sdk.js';
              script.setAttribute('data-zone', data.adZoneId);
              script.setAttribute('data-sdk', `show_${data.adZoneId}`);
              script.async = true;
              script.onload = () => {
                console.log('✅ Monetag SDK loaded, zone:', data.adZoneId);
              };
              script.onerror = () => {
                console.warn('❌ Monetag SDK failed to load');
              };
              document.head.appendChild(script);
            }
        }
    }, (error) => {
       console.warn("Settings fetch failed:", error);
    });

    // 3. Fetch Banners from Firestore (Admin থেকে যোগ করা banners)
    const bannerQ = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubscribeBanners = onSnapshot(bannerQ, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BannerItem[];
      setBannerItems(items.filter(b => b.isActive));
    }, () => {});

    // 5. Fetch Adult Content — real-time
    const adultQ = query(collection(db, 'adultContent'), orderBy('order', 'asc'));
    const unsubscribeAdult = onSnapshot(adultQ, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AdultBannerItem[];
      // ✅ isActive true গুলো দেখাবে, false গুলো লুকাবে
      setAdultBanners(items.filter(b => b.isActive !== false));
    }, (err) => {
      console.warn('adultContent fetch error:', err);
      setAdultBanners([]);
    });

    // 6. Handle Splash Screen - max 1.5s wait, then always show app
    const timer = setTimeout(() => {
        setIsLoading(false);
    }, 1500);

    // Hard failsafe - force show after 3s no matter what
    const hardTimer = setTimeout(() => {
        setIsLoading(false);
    }, 3000);

    // 6. Load Favorites & Continue Watching
    const savedFavs = localStorage.getItem('cine_favs');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
    
    const savedContinue = localStorage.getItem('cine_continue');
    if (savedContinue) setContinueWatching(JSON.parse(savedContinue));

    // 7. Telegram Config
    // @ts-ignore
    if (window.Telegram?.WebApp) {
        // @ts-ignore
        window.Telegram.WebApp.expand();
        // @ts-ignore
        window.Telegram.WebApp.setHeaderColor('#000000');
        // @ts-ignore
        window.Telegram.WebApp.setBackgroundColor('#000000');
    }

    return () => {
      clearTimeout(timer);
      clearTimeout(hardTimer);
      unsubscribeMovies();
      unsubscribeSettings();
      unsubscribeBanners();
      unsubscribeAdult();
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  // Scroll Handling for Bottom Nav
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY < 50) {
          setIsNavVisible(true);
        } else if (currentScrollY > lastScrollY.current + 20) {
          setIsNavVisible(false);
        } else if (currentScrollY < lastScrollY.current - 20) {
          setIsNavVisible(true);
        }
        lastScrollY.current = currentScrollY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Logic
  const handleMovieClick = (movie: Movie) => {
      // ✅ Add to continue watching
      addToContinueWatching(movie.id);
      setSelectedMovie(movie);
      // ✅ Referral complete হয় MovieDetails এ — ad দেখার পরে
  };


  const handleSurpriseMe = () => {
      if (movies.length === 0) return;
      const randomMovie = movies[Math.floor(Math.random() * movies.length)];
      setSelectedMovie(randomMovie);
      // @ts-ignore
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const toggleFavorite = (id: string) => {
    const newFavs = favorites.includes(id)
      ? favorites.filter((favId) => favId !== id)
      : [...favorites, id];
    
    setFavorites(newFavs);
    localStorage.setItem('cine_favs', JSON.stringify(newFavs));
    
    // @ts-ignore
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };

  // ✅ NEW: Add to continue watching
  const addToContinueWatching = (movieId: string) => {
    const updated = [
      { movieId, timestamp: Date.now() },
      ...continueWatching.filter(item => item.movieId !== movieId)
    ].slice(0, 10); // Keep only latest 10
    
    setContinueWatching(updated);
    localStorage.setItem('cine_continue', JSON.stringify(updated));
  };

  // Banner Logic - Admin থেকে banners collection প্রথমে চেক করে
  // যদি banners থাকে, ওটা ব্যবহার করবে; না থাকলে movies থেকে featured দেখাবে
  const bannerMovies = useMemo(() => {
    if (bannerItems.length > 0) {
      // bannerItems থেকে movieId দিয়ে movie object খুঁজে নাও
      return bannerItems
        .map(b => {
          const movie = movies.find(m => m.id === b.movieId);
          if (!movie) return null;
          // ✅ Custom banner image support: যদি BannerItem এ custom image থাকে, সেটা use করো
          return {
            ...movie,
            bannerThumbnail: b.image || movie.thumbnail // BannerItem এর image অথবা movie এর thumbnail
          };
        })
        .filter(Boolean) as Movie[];
    }
    // Fallback: Exclusive category বা high rating
    return movies.filter(m => m.category === 'Exclusive' || m.rating > 8.5).slice(0, 5);
  }, [bannerItems, movies]);

  // Top 10 Logic - isTop10 flag দিয়ে filter করে
  const top10Movies = useMemo(() => {
    const withFlag = movies
      .filter(m => m.isTop10)
      .sort((a, b) => (a.top10Position || 10) - (b.top10Position || 10));
    
    // যদি কোনো top10 flag না থাকে, rating দিয়ে fallback
    if (withFlag.length === 0) {
      return [...movies].sort((a, b) => b.rating - a.rating).slice(0, 10);
    }
    return withFlag;
  }, [movies]);


  // backward compat

  const featuredMovies = bannerMovies; // backward compat

  useEffect(() => {
    if (featuredMovies.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % featuredMovies.length);
    }, 6000); 
    return () => clearInterval(interval);
  }, [featuredMovies]);

  // ✅ Filter Logic — category অনুযায়ী filter, pagination Firestore থেকে আসে
  const displayedMovies = useMemo(() => {
    if (!movies || movies.length === 0) return [];
    const filtered = [...movies];
    if (activeCategory === 'All') return filtered;
    if (activeCategory === 'Exclusive') return filtered.filter(m => m.category === 'Exclusive' || m.isExclusive === true);
    if (activeCategory === 'Movies') return filtered.filter(m => m.category === 'Movies' || (m.category === 'Exclusive' && !m.episodes?.length));
    if (activeCategory === 'Web Series') return filtered.filter(m => m.category === 'Web Series' || (m.episodes && m.episodes.length > 0));
    if (activeCategory === 'K-Drama') return filtered.filter(m => m.category === 'K-Drama' || m.category === 'Korean Drama');
    return filtered.filter(m => m.category === activeCategory);
  }, [movies, activeCategory]);

  const favMovies = useMemo(() => movies.filter(m => favorites.includes(m.id)), [movies, favorites]);

  // ✅ Simple load more handler — button click করলে পরের batch আসবে
  const handleLoadMore = useCallback(() => {
    if (!isLoadingRef.current && hasMoreRef.current) {
      fetchMovies(false);
    }
  }, [fetchMovies]);

  // ✅ Category change — কোনো reset দরকার নেই, Firestore থেকে সব loaded আছে
  const handleCategoryChange = useCallback((cat: Category) => {
    setActiveCategory(cat);
  }, []);

  // ✅ Continue Watching Movies
  const continueWatchingMovies = useMemo(() => {
      return continueWatching
        .map(item => movies.find(m => m.id === item.movieId))
        .filter((m): m is Movie => m !== undefined)
        .slice(0, 5);
  }, [continueWatching, movies]);

  // --- RENDER ---

  if (isLoading) {
      return <SplashScreen />;
  }

  if (maintenance) return (
    <>
      <MaintenanceScreen
        channelLink={maintenance.channelLink}
        message={maintenance.message}
        startTime={maintenance.startTime}
        endTime={maintenance.endTime}
        appName={maintenance.appName}
        buttonText={maintenance.buttonText}
        buttonLink={maintenance.buttonLink}
        onLogoTap={handleLogoTap}
      />
      {/* ✅ Maintenance চলাকালীনও Admin Panel access থাকবে */}
      {isAdminOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[10000] bg-black flex items-center justify-center">
            <div className="flex gap-2">
              {[0,1,2].map(i=>(
                <motion.div key={i} animate={{scale:[1,1.5,1],opacity:[0.3,1,0.3]}}
                  transition={{repeat:Infinity,duration:0.8,delay:i*0.15}}
                  className="w-2 h-2 bg-gold rounded-full"/>
              ))}
            </div>
          </div>
        }>
          <AdminPanel onClose={() => setIsAdminOpen(false)} />
        </Suspense>
      )}
    </>
  );

  return (
    <div 
        className="min-h-screen text-white font-sans selection:bg-gold selection:text-black pb-24" style={{background:"#0d0d10"}}
    >
      
      {/* --- HEADER --- */}
      {activeTab === 'home' && !isAdultPageOpen && (
        <header className={`fixed top-0 inset-x-0 z-50 px-4 py-4 flex justify-between items-center transition-all duration-300 ${!isNavVisible ? 'bg-black/90 border-b border-white/5 py-3 shadow-lg' : 'bg-gradient-to-b from-black/90 to-transparent'}`}>
            {/* Logo - Secret Admin Access */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="font-brand text-4xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-gold via-[#fff] to-gold cursor-pointer drop-shadow-[0_2px_10px_rgba(255,215,0,0.3)] select-none"
              onClick={handleLogoTap}
            >
              CINEFLIX
            </motion.div>

            {/* Right Icons */}
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.open(appSettings.channelLink || 'https://t.me/cineflixrequestcontent', '_blank')}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-colors text-white"
                >
                    <Send size={18} className="-ml-0.5 mt-0.5" />
                </button>

                <button 
                  onClick={handleSurpriseMe}
                  className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20 active:scale-95 transition-colors text-gold"
                >
                    <Sparkles size={18} />
                </button>
            </div>
        </header>
      )}

      {/* --- BANNER (FULL WIDTH) --- */}
      {activeTab === 'home' && featuredMovies.length > 0 && (
          <div className="relative z-0">
             <Banner 
                movie={featuredMovies[currentBannerIndex]} 
                onClick={handleMovieClick}
                onPlay={handleMovieClick}
                currentIndex={currentBannerIndex}
                totalBanners={featuredMovies.length}
                onDotClick={setCurrentBannerIndex}
             />
          </div>
      )}

      {/* --- CONTENT AREA --- */}
      <main className={`px-4 max-w-7xl mx-auto relative z-10 ${activeTab === 'home' ? '-mt-2' : 'pt-20'}`}>
        
        {/* HOME VIEW */}
        {activeTab === 'home' && (
            <>  
                {/* 1. Top 10 Trending */}
                <div className="mb-2">
                  <TrendingRow movies={top10Movies} onClick={handleMovieClick} />
                </div>



                {/* 3. 18+ Adult Content Section */}
                <AdultBannerSection
                  items={adultBanners}
                  homeBannerUrl={appSettings.adultBannerUrl}
                  isHidden={appSettings.adultSectionHidden}
                  tutorialBanner={appSettings.adultTutorialBanner}
                  tutorialLink={appSettings.adultTutorialLink}
                  appSettings={appSettings}
                  onPageOpen={() => setIsAdultPageOpen(true)}
                  onPageClose={() => setIsAdultPageOpen(false)}
                />

                {/* 4. Notice Bar - noticeChannelLink আলাদা, channelLink আলাদা */}
                <NoticeBar 
                  channelLink={appSettings.channelLink}
                  noticeChannelLink={appSettings.noticeChannelLink}
                />

                {/* Premium Category Filter */}
                <div className="-mx-4 px-4 py-3 mb-5 border-b border-white/5">
                   <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar px-1">
                       {CATEGORIES.map((cat) => {
                           const isActive = activeCategory === cat;
                           
                           // Category icons
                           const getCategoryIcon = () => {
                             switch(cat) {
                               case 'All': return <TrendingUp size={12} />;
                               case 'Exclusive': return <Award size={12} />;
                               case 'Movies': return <Film size={12} />;
                               case 'Web Series': return <Tv size={12} />;
                               case 'K-Drama': return <Heart size={12} />;
                               case 'Anime': return <Flame size={12} />;
                               default: return null;
                             }
                           };
                           
                           return (
                               <button
                                 key={cat}
                                 onClick={() => handleCategoryChange(cat as Category)}
                                 className="relative px-5 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all shrink-0 overflow-hidden"
                               >
                                   {isActive && (
                                       <motion.div 
                                          layoutId="activeCategory"
                                          className="absolute inset-0 bg-gradient-to-r from-gold to-[#ffe55c] rounded-xl z-0"
                                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                       />
                                   )}
                                   <span className={`relative z-10 flex items-center gap-1.5 ${isActive ? 'text-black font-extrabold' : 'text-gray-400 font-medium'}`}>
                                       {getCategoryIcon()}
                                       {cat}
                                       {isActive && <Sparkles size={10} className="fill-black/20 text-black/40" />}
                                   </span>
                                   {!isActive && (
                                       <div className="absolute inset-0 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors" />
                                   )}
                               </button>
                           )
                       })}
                   </div>
                </div>

                {/* Filtered Grid */}
                <div className="pb-8">
                    <h3 className="mb-4 flex items-center gap-2" style={{fontFamily:"'Outfit',sans-serif",fontSize:'18px',fontWeight:700,color:'#fff',letterSpacing:'-0.01em'}}>
                        <span className="w-1 h-5 bg-gold rounded-full shadow-[0_0_10px_#FFD700]"></span>
                        {activeCategory === 'All' ? 'Just Added' : `${activeCategory} Collection`}
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <>
                            {displayedMovies.length > 0 ? (
                                displayedMovies.map((movie) => (
                                    <MovieTile
                                        key={movie.id}
                                        movie={movie}
                                        isFavorite={favorites.includes(movie.id)}
                                        onToggleFavorite={toggleFavorite}
                                        onClick={handleMovieClick}
                                    />
                                ))
                            ) : (
                                <div className="col-span-3 text-center py-10 text-gray-500 text-xs">
                                    {movies.length === 0 ? "Loading Content..." : "No content found."}
                                </div>
                            )}
                        </>
                    </div>

                    {/* ✅ LOAD MORE BUTTON */}
                    {hasMore && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 8px' }}>
                        <button
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: isLoadingMore
                              ? 'rgba(255,215,0,0.15)'
                              : 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                            color: isLoadingMore ? 'rgba(255,255,255,0.4)' : '#000',
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '13px', fontWeight: 800,
                            letterSpacing: '0.05em',
                            padding: '13px 32px',
                            borderRadius: '14px',
                            border: 'none',
                            cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                            boxShadow: isLoadingMore ? 'none' : '0 4px 20px rgba(255,215,0,0.25)',
                            transition: 'all 0.2s',
                            minWidth: '160px',
                            justifyContent: 'center',
                          }}
                        >
                          {isLoadingMore ? (
                            <>
                              <span style={{
                                width: 14, height: 14, borderRadius: '50%',
                                border: '2px solid rgba(255,255,255,0.2)',
                                borderTopColor: '#FFD700',
                                display: 'inline-block',
                                animation: 'spin 0.7s linear infinite',
                              }} />
                              লোড হচ্ছে...
                            </>
                          ) : '⬇ আরো দেখুন'}
                        </button>
                      </div>
                    )}

                    {!hasMore && movies.length > PAGE_SIZE && (
                      <p style={{
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.15)',
                        fontSize: '11px',
                        padding: '16px 0 8px',
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                        ✓ সব {movies.length}টা content দেখা হয়ে গেছে
                      </p>
                    )}
                </div>
            </>
        )}

        {/* SEARCH / EXPLORE VIEW */}
        {activeTab === 'search' && (
             <Explore 
                movies={movies} 
                onMovieClick={handleMovieClick} 
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onBack={() => setActiveTab('home')}
             />
        )}

        {/* WATCHLIST VIEW */}
        {activeTab === 'favorites' && (
             <div className="pt-4">
                <Watchlist 
                    movies={favMovies} 
                    onRemove={toggleFavorite} 
                    onClick={handleMovieClick} 
                />
             </div>
        )}

      </main>

      {/* --- BOTTOM NAV --- */}
      {!isAdultPageOpen && (
        <BottomNav 
          activeTab={activeTab} 
          isVisible={isNavVisible}
          onTabChange={setActiveTab} 
        />
      )}

      {/* --- PROFILE --- */}
      <AnimatePresence>
        {activeTab === 'profile' && (
          <UserProfile 
            onClose={() => setActiveTab('home')} 
            botUsername={appSettings.referralBotUsername || appSettings.botUsername}
          />
        )}
      </AnimatePresence>

      {/* --- OVERLAYS --- */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onSurprise={handleSurpriseMe}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      <AnimatePresence>
        {selectedMovie && (
          <MovieDetails 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)} 
            botUsername={appSettings.botUsername}
            channelLink={appSettings.channelLink}
            appSettings={appSettings}
          />
        )}
      </AnimatePresence>



      {/* Admin Panel */}
      {isAdminOpen && (
        <AdminPanel onClose={() => setIsAdminOpen(false)} />
      )}

    </div>
  );
};

export default App;
