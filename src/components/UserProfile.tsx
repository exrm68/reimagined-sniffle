import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, CheckCheck, Send, ChevronRight,
  ArrowDownToLine, History, Users, ArrowLeft, CheckCircle2,
  Coins, UserPlus, Wallet, XCircle, Gift, Star, Zap,
  TrendingUp, Award, ArrowRightLeft, Clock, BadgeCheck,
  Sparkles, ChevronDown, PlayCircle, ListChecks
} from 'lucide-react';
import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, deleteDoc, onSnapshot, query, where, orderBy,
  serverTimestamp, increment, getDocs, limit, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; };
          start_param?: string;
        };
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => void;
          notificationOccurred: (type: 'error'|'success'|'warning') => void;
        };
      };
    };
  }
}

interface UserData {
  telegramId: string;
  name: string;
  username?: string;
  photo?: string;
  coins: number;
  takaBalance: number;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  joinedAt: any;
  lastLogin: any;
  milestonesClaimed: number[];
  unlockedMovies?: string[];
  lastDailyDate?: string;
}

interface WithdrawalRequest {
  id?: string;
  userId: string;
  userName: string;
  amount: number;
  method: 'bkash' | 'nagad';
  number: string;
  status: 'pending' | 'success' | 'cancelled';
  adminNote?: string;
  createdAt: any;
}

interface CoinHistory {
  id?: string;
  type: 'earn' | 'spend';
  reason: string;
  amount: number;
  createdAt: any;
}

interface CoinSettings {
  coinWelcome: number;
  coinDaily: number;
  coinPerRefer: number;
  coinMilestone5: number;
  coinMilestone10: number;
  coinMilestone20: number;
  coinMilestone50: number;
  coinRate: number;
  minWithdraw: number;
  referralBotUsername: string;
  referralAppName: string;
}

const DEFAULT_CS: CoinSettings = {
  coinWelcome: 50, coinDaily: 5, coinPerRefer: 100,
  coinMilestone5: 50, coinMilestone10: 150, coinMilestone20: 400, coinMilestone50: 1000,
  coinRate: 1000, minWithdraw: 50,
  referralBotUsername: '', referralAppName: '',
};

interface UserProfileProps {
  onClose: () => void;
  botUsername: string;
}

const haptic = (type: 'success'|'error'|'light'|'heavy' = 'light') => {
  const hf = window.Telegram?.WebApp?.HapticFeedback;
  if (!hf) return;
  if (type === 'success' || type === 'error') hf.notificationOccurred(type);
  else hf.impactOccurred(type);
};

const pv = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25,0.8,0.25,1] as any } },
  exit:    { opacity: 0, y: -18, transition: { duration: 0.2 } }
};

const ft = (ts: any) => {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Telegram Avatar ──────────────────────────────────────────────────────────
const TgAvatar: React.FC<{ photo?: string; name?: string; size?: number }> = ({ photo, name, size = 72 }) => {
  const [err, setErr] = useState(false);
  const initials = name ? name.split(' ').map((w:string) => w[0]).join('').slice(0,2).toUpperCase() : '?';
  const palettes = ['from-violet-500 to-indigo-600','from-blue-500 to-cyan-500','from-emerald-500 to-teal-500','from-amber-500 to-orange-500','from-pink-500 to-rose-500'];
  const grad = palettes[(name?.charCodeAt(0)||0) % palettes.length];
  return (
    <div style={{ width: size, height: size }} className="rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10 shadow-xl">
      {photo && !err
        ? <img src={photo} className="w-full h-full object-cover" onError={() => setErr(true)} alt={name} />
        : <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
            <span className="text-white font-black" style={{ fontSize: size * 0.35 }}>{initials}</span>
          </div>
      }
    </div>
  );
};

// ── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ toast: {msg:string; type:'success'|'error'}|null }> = ({ toast }) => (
  <AnimatePresence>
    {toast && (
      <motion.div initial={{ opacity:0, y:-40, scale:0.9 }} animate={{ opacity:1, y:16, scale:1 }} exit={{ opacity:0, y:-40, scale:0.9 }}
        transition={{ type:'spring', damping:20 }}
        className={`absolute top-0 left-4 right-4 z-[200] px-4 py-3.5 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${
          toast.type==='success' ? 'bg-emerald-500/20 text-emerald-50 border-emerald-500/30' : 'bg-red-500/20 text-red-50 border-red-500/30'
        }`}>
        {toast.type==='success' ? <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" /> : <XCircle size={20} className="text-red-400 flex-shrink-0" />}
        <span className="flex-1">{toast.msg}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

// ════════════════════════════════════════════════════════════════════════════
const UserProfile: React.FC<UserProfileProps> = ({ onClose, botUsername }) => {
  const [userData, setUserData]           = useState<UserData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [screen, setScreen]               = useState<'main'|'earn'|'convert'|'withdraw'|'history'|'tasks'>('main');
  // Tasks state
  // Tasks state
  const [tasks, setTasks]                   = useState<any[]>([]);
  const [taskAdLoading, setTaskAdLoading]   = useState<string|null>(null); // taskId
  const [taskCooldown, setTaskCooldown]     = useState<{[key:string]:number}>({}); // taskId → remaining secs
  const [taskMsg, setTaskMsg]               = useState<{[key:string]:string}>({}); // taskId → msg
  const [globalAdSettings, setGlobalAdSettings] = useState({
    adsgramEnabled: false, adsgramBlockId: '',
    adEnabled: false, adZoneId: '', adScriptUrl: '//libtl.com/sdk.js',
    taskCooldownSecs: 5,
  });
  const [copied, setCopied]               = useState(false);
  const [wMethod, setWMethod]             = useState<'bkash'|'nagad'>('bkash');
  const [wNumber, setWNumber]             = useState('');
  const [wAmount, setWAmount]             = useState('');
  const [wLoading, setWLoading]           = useState(false);
  const [withdrawals, setWithdrawals]     = useState<WithdrawalRequest[]>([]);
  const [coinHistory, setCoinHistory]     = useState<CoinHistory[]>([]);
  const [toast, setToast]                 = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [convertCoins, setConvertCoins]   = useState('');
  const [convertLoading, setConvertLoading] = useState(false);
  const [showConvertAnim, setShowConvertAnim] = useState(false);
  const [cs, setCs]                       = useState<CoinSettings>(DEFAULT_CS);
  const [settingsLoaded, setSettingsLoaded] = useState(false); // ✅ settings load tracker
  const [expandRates, setExpandRates]     = useState(false);

  const tgUser     = window.Telegram?.WebApp?.initDataUnsafe?.user;
  // ✅ FIX: startParam multiple sources — URL fallback সহ
  const _urlParams = new URLSearchParams(window.location.search);
  const startParam =
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
    (window.Telegram?.WebApp as any)?.initDataUnsafe?.startParam ||
    _urlParams.get('startapp') ||
    _urlParams.get('tgWebAppStartParam') ||
    '';

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    haptic(type); setToast({msg, type}); setTimeout(() => setToast(null), 3000);
  };

  // ── Settings — realtime load ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'config'), s => {
      if (!s.exists()) { setSettingsLoaded(true); return; }
      const d = s.data();
      // ✅ referralBotUsername — শুধু এই field, appName/botUsername fallback নয়
      const rBot = (d.referralBotUsername || '').replace('@','').trim();
      // ✅ referralAppName — শুধু এই field, appName fallback নয় (appName = video bot এর জন্য)
      const rApp = (d.referralAppName || '').replace('/','').trim();
      setCs({
        coinWelcome:          d.coinWelcome     ?? DEFAULT_CS.coinWelcome,
        coinDaily:            d.coinDaily       ?? DEFAULT_CS.coinDaily,
        coinPerRefer:         d.coinPerRefer    ?? DEFAULT_CS.coinPerRefer,
        coinMilestone5:       d.coinMilestone5  ?? DEFAULT_CS.coinMilestone5,
        coinMilestone10:      d.coinMilestone10 ?? DEFAULT_CS.coinMilestone10,
        coinMilestone20:      d.coinMilestone20 ?? DEFAULT_CS.coinMilestone20,
        coinMilestone50:      d.coinMilestone50 ?? DEFAULT_CS.coinMilestone50,
        coinRate:             d.coinRate        ?? DEFAULT_CS.coinRate,
        minWithdraw:          d.minWithdraw     ?? DEFAULT_CS.minWithdraw,
        referralBotUsername:  rBot,
        referralAppName:      rApp,
      });
      setSettingsLoaded(true);
      // ✅ Task settings
      // ✅ Global ad settings for Tasks
      setGlobalAdSettings({
        adsgramEnabled: !!(d.adsgramEnabled && d.adsgramBlockId),
        adsgramBlockId: d.adsgramBlockId || '',
        adEnabled: !!(d.adEnabled && d.adZoneId),
        adZoneId: d.adZoneId || '',
        adScriptUrl: d.adScriptUrl || '//libtl.com/sdk.js',
        taskCooldownSecs: d.taskCooldownSecs ?? 5,
      });
    });
    return () => unsub();
  }, []);

  // ── Load Tasks from Firestore ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'tasks'), orderBy('order', 'asc')),
      snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, []);

  const addCoinHistory = (uid: string, type: 'earn'|'spend', reason: string, amount: number) =>
    addDoc(collection(db, `users/${uid}/coinHistory`), { type, reason, amount, createdAt: serverTimestamp() });

  // ── Register / Login ──────────────────────────────────────────────────────
  const isRegistering = React.useRef(false); // 🔒 Double-mount lock

  useEffect(() => {
    if (!tgUser) { setLoading(false); return; }
    // 🔒 StrictMode / double-mount এ duplicate call আটকাও
    if (isRegistering.current) return;
    isRegistering.current = true;

    (async () => {
      const uid = String(tgUser.id);
      const ref = doc(db, 'users', uid);
      try {
        const [snap, settingsSnap] = await Promise.all([getDoc(ref), getDoc(doc(db,'settings','config'))]);
        const sd = settingsSnap.exists() ? settingsSnap.data() : {};
        const welcomeBonus = sd.coinWelcome ?? DEFAULT_CS.coinWelcome;
        const dailyBonus   = sd.coinDaily   ?? DEFAULT_CS.coinDaily;

        if (!snap.exists()) {
          const code = `CIN${uid.slice(-6)}`;

          // ✅ Referral bonus — নতুন user যদি refer link দিয়ে ঢোকে, extra coin পাবে
          let joinBonus = welcomeBonus;
          let referrerId: string | null = null;
          if (startParam?.startsWith('ref_')) {
            const refCode = startParam.replace('ref_', '');
            const rq = query(collection(db,'users'), where('referralCode','==',refCode), limit(1));
            const rs = await getDocs(rq);
            if (!rs.empty && rs.docs[0].id !== uid) {
              referrerId = rs.docs[0].id;
              // Referred user gets extra welcome bonus (coinWelcome itself is the referral join bonus)
              // Admin can set coinWelcome = 50 which is already added
            }
          }

          const nu: UserData = {
            telegramId: uid,
            name: `${tgUser.first_name}${tgUser.last_name ? ' '+tgUser.last_name : ''}`,
            username: tgUser.username || '',
            photo: tgUser.photo_url || '',
            coins: joinBonus, takaBalance: 0,
            referralCode: code, referralCount: 0,
            joinedAt: serverTimestamp(), lastLogin: serverTimestamp(),
            milestonesClaimed: [], unlockedMovies: [],
            ...(referrerId ? { referredBy: referrerId } : {}),
          } as any;

          await setDoc(ref, nu);
          await addCoinHistory(uid, 'earn', `🎁 স্বাগত বোনাস`, welcomeBonus);

          // ✅ Referred user এর extra 50 coin (referral join bonus) — welcomeBonus এর উপরে
          if (referrerId) {
            const referJoinBonus = sd.coinWelcome ?? 50; // admin চাইলে আলাদা field রাখতে পারে
            // Bonus already included in joinBonus above — so just log it specially
            await addCoinHistory(uid, 'earn', `🔗 Referral Join বোনাস`, 0); // marker only
            // ✅ pendingReferral তৈরি করো যাতে referrer পরে coin পায় যখন এই user কিছু play করবে
            await addDoc(collection(db,'pendingReferrals'), {
              referrerId: referrerId, newUserId: uid, completed: false, createdAt: serverTimestamp(),
            });
          }

          setUserData({ ...nu, joinedAt: new Date(), lastLogin: new Date() });
          if (referrerId) {
            showToast(`🎉 স্বাগতম! +${joinBonus} Coin পেয়েছ (Referral Bonus সহ) 🎁`);
          } else {
            showToast(`🎉 স্বাগতম! +${welcomeBonus} Coin পেয়েছ`);
          }
        } else {
          const data = snap.data() as UserData;
          const updates: any = { lastLogin: serverTimestamp() };
          if (data.takaBalance === undefined) updates.takaBalance = 0;
          if (data.coins === undefined) updates.coins = 0;
          if (tgUser.photo_url) updates.photo = tgUser.photo_url;
          const newName = `${tgUser.first_name}${tgUser.last_name ? ' '+tgUser.last_name : ''}`;
          if (newName !== data.name) updates.name = newName;

          const last = data.lastLogin?.toDate?.() || new Date(0);
          const todayStr = new Date().toDateString();
          const lastStr  = last.toDateString();

          // ✅ BUG FIX: Daily bonus — date string compare করো
          // 'lastDailyDate' field দিয়ে double-add সম্পূর্ণ রোধ করা হচ্ছে
          const lastDailyDate = data.lastDailyDate || '';
          if (todayStr !== lastDailyDate) {
            updates.coins = increment(dailyBonus);
            updates.lastDailyDate = todayStr; // ✅ এই field দিয়ে duplicate block হবে
            await updateDoc(ref, updates);
            await addCoinHistory(uid, 'earn', `📅 Daily Login বোনাস`, dailyBonus);
            showToast(`+${dailyBonus} Coin! Daily Login 🪙`);
          } else {
            await updateDoc(ref, updates);
          }
          setUserData({ ...data, takaBalance: data.takaBalance ?? 0, coins: data.coins ?? 0 });
        }
      } catch(e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tgUser) return;
    const uid = String(tgUser.id);
    try { return onSnapshot(doc(db,'users',uid), s => { if(s.exists()) setUserData(s.data() as UserData); }); } catch(e) {}
  }, [tgUser]);

  useEffect(() => {
    if (!tgUser) return;
    const uid = String(tgUser.id);
    try {
      return onSnapshot(
        query(collection(db,'withdrawals'), where('userId','==',uid), limit(20)),
        s => setWithdrawals(
          s.docs.map(d => ({id:d.id,...d.data()} as WithdrawalRequest))
            .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
        )
      );
    } catch(e) {}
  }, [tgUser]);

  useEffect(() => {
    if (!tgUser) return;
    const uid = String(tgUser.id);
    try {
      return onSnapshot(
        query(collection(db,`users/${uid}/coinHistory`), orderBy('createdAt','desc'), limit(50)),
        s => setCoinHistory(s.docs.map(d => ({id:d.id,...d.data()} as CoinHistory)))
      );
    } catch(e) {}
  }, [tgUser]);

  // ── Complete referral ─────────────────────────────────────────────────────
  // 🔒 Lock: একাধিকবার call হলেও শুধু একবার process হবে
  const isCompletingRef = React.useRef(false);

  const completeReferral = async (passedUid?: string) => {
    const userId = passedUid || (tgUser ? String(tgUser.id) : null);
    if (!userId) return;
    // 🔒 Race condition fix: lock দিয়ে duplicate call আটকাও
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    try {
      const q = query(collection(db,'pendingReferrals'), where('newUserId','==',userId), where('completed','==',false), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) { isCompletingRef.current = false; return; }

      const pendingDoc = snap.docs[0];
      const pendingData = pendingDoc.data();

      // ✅ Double-complete guard: আবার check করো completed হয়নি তো
      if (pendingData.completed === true) { isCompletingRef.current = false; return; }

      const { referrerId, newUserId } = pendingData;

      // ✅ Safety: referrer নিজেই referred হয়নি তো (extra protection)
      if (referrerId === userId) { isCompletingRef.current = false; return; }

      // ✅ Extra layer: এই newUserId দিয়ে আগে কোনো completed referral আছে কিনা check করো
      // মানে same account 2 বার refer হওয়া 100% impossible
      const prevCompleted = query(
        collection(db,'pendingReferrals'),
        where('newUserId','==',userId),
        where('completed','==',true),
        limit(1)
      );
      const prevSnap = await getDocs(prevCompleted);
      if (!prevSnap.empty) {
        // এই user আগেই কারো referral complete করেছে — আর হবে না
        await updateDoc(doc(db,'pendingReferrals',pendingDoc.id), { completed: true, completedAt: serverTimestamp() });
        isCompletingRef.current = false;
        return;
      }

      // ✅ Atomic: আগে completed mark করো, তারপর coin দাও
      await updateDoc(doc(db,'pendingReferrals',pendingDoc.id), {
        completed: true,
        completedAt: serverTimestamp(),
      });

      const [referrerSnap, settingsSnap, newUserSnap] = await Promise.all([
        getDoc(doc(db,'users',referrerId)),
        getDoc(doc(db,'settings','config')),
        getDoc(doc(db,'users',userId)),
      ]);

      if (!referrerSnap.exists()) { isCompletingRef.current = false; return; }

      const referrerData = referrerSnap.data() as UserData;
      const newCount = (referrerData.referralCount || 0) + 1;
      const sd = settingsSnap.exists() ? settingsSnap.data() : {};
      const perRefer = sd.coinPerRefer ?? DEFAULT_CS.coinPerRefer;

      // ✅ নতুন user এর নাম দেখাও (নিজের নাম না)
      const newUserName = newUserSnap.exists()
        ? (newUserSnap.data() as UserData).name || 'নতুন বন্ধু'
        : 'নতুন বন্ধু';

      const ms = [
        {count:5,  bonus: sd.coinMilestone5  ?? DEFAULT_CS.coinMilestone5},
        {count:10, bonus: sd.coinMilestone10 ?? DEFAULT_CS.coinMilestone10},
        {count:20, bonus: sd.coinMilestone20 ?? DEFAULT_CS.coinMilestone20},
        {count:50, bonus: sd.coinMilestone50 ?? DEFAULT_CS.coinMilestone50},
      ];

      // Referrer কে coin + referralCount দাও
      await updateDoc(doc(db,'users',referrerId), {
        coins: increment(perRefer),
        referralCount: increment(1),
      });
      // ✅ সঠিক নাম: যে join করেছে তার নাম দেখাও
      await addCoinHistory(referrerId, 'earn', `👥 Referral — ${newUserName}`, perRefer);

      // Milestone bonus check
      for (const m of ms) {
        if (newCount >= m.count && !referrerData.milestonesClaimed?.includes(m.count)) {
          await updateDoc(doc(db,'users',referrerId), {
            coins: increment(m.bonus),
            milestonesClaimed: [...(referrerData.milestonesClaimed||[]), m.count],
          });
          await addCoinHistory(referrerId, 'earn', `🎯 ${m.count} Refer Milestone Bonus!`, m.bonus);
        }
      }
    } catch(err) {
      console.error('completeReferral error:', err);
      // Error হলে lock ছেড়ে দাও যাতে retry হতে পারে
      isCompletingRef.current = false;
      return;
    }
    // Success হলে lock রাখো (আর দরকার নেই)
  };
  useEffect(() => { (window as any).completeCinelixReferral = completeReferral; }, [tgUser, userData]);

  // ── Referral link — cs এবং userData দুটোই ready হলে তৈরি হবে ──────────
  const referralLink = React.useMemo(() => {
    if (!userData?.referralCode) return '';
    // ✅ Fallback to botUsername if referralBotUsername is empty
    const bot = (cs.referralBotUsername || botUsername || '').replace('@','').trim();
    if (!bot) return '';
    const app = (cs.referralAppName || '').trim();
    return app
      ? `https://t.me/${bot}/${app}?startapp=ref_${userData.referralCode}`
      : `https://t.me/${bot}?start=ref_${userData.referralCode}`;
  }, [cs.referralBotUsername, cs.referralAppName, botUsername, userData?.referralCode]);

  const getLink = () => referralLink;

  const copyLink = async () => {
    if (!referralLink) { showToast('Admin এ Referral Bot Username set করা নেই!', 'error'); return; }
    try { await navigator.clipboard.writeText(referralLink); } catch {
      // fallback for Telegram WebApp
      const el = document.createElement('textarea');
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true); haptic('success'); setTimeout(() => setCopied(false), 2500);
    showToast('Referral link copied! 🔗');
  };

  const shareLink = () => {
    if (!referralLink) { showToast('Admin এ Referral Bot Username set করা নেই!', 'error'); return; }
    const t = `🎬 *CineFlix* — বাংলাদেশের সেরা Movie App!\n\n🪙 Join করলেই পাবে *${cs.coinWelcome} Coin* বোনাস!\n💰 প্রতি refer এ পাবে *${cs.coinPerRefer} Coin*!\n\n👇 এখনই Join করো:\n${referralLink}`;
    window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(t)}`);
    haptic('light');
  };

  const forwardLink = () => {
    if (!referralLink) { showToast('Admin এ Referral Bot Username set করা নেই!', 'error'); return; }
    const t = `🎬 *CineFlix* — বাংলাদেশের সেরা Movie App!\n\n🪙 Join করলেই পাবে *${cs.coinWelcome} Coin* বোনাস!\n💰 প্রতি refer এ পাবে *${cs.coinPerRefer} Coin*!\n\n👇 এখনই Join করো:`;
    // Telegram share URL for forwarding
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(t)}`;
    window.Telegram?.WebApp?.openTelegramLink?.(shareUrl);
    haptic('light');
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const convertUnit   = cs.coinRate;
  const parsedConvert = parseInt(convertCoins);
  const convertedTaka = (
    !isNaN(parsedConvert) &&
    parsedConvert >= convertUnit &&
    parsedConvert <= (userData?.coins || 0)
  )
    ? ((parsedConvert / cs.coinRate) * 10).toFixed(2)
    : null;
  const canWithdraw   = (userData?.takaBalance || 0) >= cs.minWithdraw;
  const canConvert    = (userData?.coins || 0) >= convertUnit;
  const progressPct   = Math.min(100, ((userData?.coins || 0) / cs.coinRate) * 100);
  const milestones    = [
    {count:5,  bonus:cs.coinMilestone5},
    {count:10, bonus:cs.coinMilestone10},
    {count:20, bonus:cs.coinMilestone20},
    {count:50, bonus:cs.coinMilestone50},
  ];
  const nextMilestone = milestones.find(m => (userData?.referralCount||0) < m.count);
  const claimedCount  = (userData?.milestonesClaimed||[]).length;

  // ── Convert ───────────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!tgUser || !userData) return;
    const coins = parseInt(convertCoins);
    // ✅ FIX: শুধু minimum check, modulo বাদ — যেকোনো amount >= coinRate চলবে
    if (!coins || isNaN(coins) || coins < convertUnit) {
      showToast(`কমপক্ষে ${convertUnit.toLocaleString()} Coin লাগবে!`, 'error'); return;
    }
    if (coins > (userData.coins || 0)) { showToast('তোমার কাছে এত Coin নেই!', 'error'); return; }
    const taka = parseFloat(((coins / cs.coinRate) * 10).toFixed(2));
    setConvertLoading(true); setShowConvertAnim(true); haptic('heavy');
    setTimeout(async () => {
      try {
        await updateDoc(doc(db,'users',String(tgUser.id)), {
          coins: increment(-coins),
          takaBalance: increment(taka),
        });
        await addCoinHistory(String(tgUser.id), 'spend', `💱 ${coins} Coin → ৳${taka}`, coins);
        haptic('success'); setConvertCoins(''); setScreen('main');
        showToast(`৳${taka} Balance এ যোগ হয়েছে! 💰`);
      } catch(e) { showToast('Error! আবার try করো', 'error'); }
      setConvertLoading(false); setShowConvertAnim(false);
    }, 1200);
  };

  // ── Withdraw ──────────────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    if (!tgUser || !userData) return;
    const amount = parseFloat(wAmount);
    if (!wNumber || wNumber.length < 11) { showToast('সঠিক নম্বর দাও!', 'error'); return; }
    if (!amount || amount < cs.minWithdraw) { showToast(`Minimum ৳${cs.minWithdraw}!`, 'error'); return; }
    if (amount > (userData.takaBalance || 0)) { showToast('Balance কম!', 'error'); return; }
    setWLoading(true);
    let newDocRef: any = null;
    try {
      const uid = String(tgUser.id);
      // Step 1: আগে withdrawal request তৈরি করো
      newDocRef = await addDoc(collection(db, 'withdrawals'), {
        userId: uid,
        userName: userData.name || tgUser.first_name,
        amount,
        method: wMethod,
        number: wNumber,
        status: 'pending',
        adminNote: '',
        createdAt: serverTimestamp(),
      });
      // Step 2: তারপর balance কাটো
      await updateDoc(doc(db, 'users', uid), { takaBalance: increment(-amount) });
      haptic('success'); setWNumber(''); setWAmount(''); setScreen('main');
      showToast('Withdrawal Request পাঠানো হয়েছে! ✅');
    } catch(e: any) {
      console.error('Withdraw error:', e);
      // ✅ Rollback: balance কাটা না গেলেও request delete করো
      if (newDocRef) {
        try { await deleteDoc(newDocRef); } catch(_) {}
      }
      showToast(`Error: ${e?.code || 'অজানা সমস্যা'}`, 'error');
    }
    setWLoading(false);
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!tgUser && !loading) return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 bg-[#09090c] flex flex-col items-center justify-center px-6 text-center">
      <button onClick={onClose} className="absolute top-5 right-5 p-2.5 bg-white/10 rounded-full"><X size={20} className="text-white" /></button>
      <div className="w-20 h-20 bg-blue-600 rounded-[24px] flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(37,99,235,0.4)]"><Send size={32} className="text-white" /></div>
      <h1 className="text-white text-2xl font-bold mb-2">Telegram Mini App</h1>
      <p className="text-zinc-400 text-sm">এই feature শুধু Telegram এ কাজ করে।</p>
    </motion.div>
  );

  // No full-screen loading — show skeleton inline instead

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 bg-[#09090c] overflow-hidden flex flex-col font-sans text-white">

      {/* Convert animation */}
      <AnimatePresence>
        {showConvertAnim && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center">
            <motion.div initial={{scale:0,rotate:-180,y:50}} animate={{scale:1,rotate:0,y:0}}
              transition={{type:'spring',damping:15,stiffness:200}}
              className="relative w-28 h-28 flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-amber-500 rounded-full blur-3xl opacity-50 animate-pulse" />
              <div className="w-full h-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-yellow-200 rounded-full flex items-center justify-center border-4 border-yellow-100 relative z-10 shadow-[0_0_60px_rgba(251,191,36,0.6)]">
                <Coins size={52} className="text-amber-900" />
              </div>
            </motion.div>
            <motion.h2 initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}} className="text-3xl font-black text-white mb-2">Converting...</motion.h2>
            <motion.p initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.3}} className="text-amber-400">Processing your transaction</motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toast={toast} />

      <AnimatePresence mode="wait">

        {/* ══════════════════════════ MAIN ══════════════════════════════════ */}
        {screen==='main' && (
          <motion.div key="main" variants={pv} initial="initial" animate="animate" exit="exit"
            className="flex-1 overflow-y-auto no-scrollbar">

            {/* Hero Header — blurred bg from Telegram photo */}
            <div className="relative">
              <div className="absolute inset-0 overflow-hidden" style={{height:260}}>
                {(tgUser?.photo_url || userData?.photo)
                  ? <img src={tgUser?.photo_url || userData?.photo} className="w-full h-full object-cover scale-110"
                      style={{filter:'blur(50px) brightness(0.22) saturate(0.5)'}} onError={(e)=>{(e.target as HTMLImageElement).style.display='none'}} />
                  : <div className="w-full h-full" style={{background:'linear-gradient(180deg,#1a1040 0%,#09090c 100%)'}} />
                }
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#09090c]/50 to-[#09090c]" />
              </div>

              <div className="relative z-10 pt-14 pb-5 px-5" style={{minHeight:260}}>
                <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                  <X size={18} className="text-white" />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    {/* ✅ Try tgUser photo first (freshest), then userData.photo from Firebase */}
                    <TgAvatar photo={tgUser?.photo_url || userData?.photo} name={userData?.name || tgUser?.first_name} size={82} />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center border-2 border-[#09090c]">
                      <BadgeCheck size={12} className="text-black" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    {userData?.name || (tgUser ? `${tgUser.first_name}${tgUser.last_name?' '+tgUser.last_name:''}` : '...')}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                    {(userData?.username || tgUser?.username) && <span className="text-zinc-400 text-sm">@{userData?.username || tgUser?.username}</span>}
                    <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">CineFlix</span>
                  </div>
                  {userData?.joinedAt && (
                    <p className="text-zinc-600 text-[11px] mt-1 flex items-center gap-1">
                      <Clock size={10} />Join: {ft(userData.joinedAt)}
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="flex gap-3 mt-4 w-full max-w-xs">
                    {[
                      { icon:'👥', label:'Refers',  value: userData?.referralCount||0,                      color:'text-blue-300'    },
                      { icon:'🪙', label:'Coins',   value: (userData?.coins||0).toLocaleString(),           color:'text-amber-300'   },
                      { icon:'৳',  label:'Balance', value: `${(userData?.takaBalance||0).toFixed(0)}`,      color:'text-emerald-300' },
                    ].map((s,i) => (
                      <div key={i} className="flex-1 bg-white/6 backdrop-blur-sm border border-white/8 rounded-2xl p-2.5 text-center">
                        <span className="text-base">{s.icon}</span>
                        <p className={`font-black text-sm mt-0.5 ${s.color}`}>{s.value}</p>
                        <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Card */}
            <div className="px-4 mb-4">
              <div className="bg-gradient-to-br from-[#1c1c24] to-[#141418] border border-white/6 rounded-[24px] p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/6 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between mb-4">
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Wallet size={9} />Taka Balance</p>
                    <p className="text-3xl font-black text-emerald-400 tracking-tight"><span className="text-lg text-emerald-600 mr-0.5">৳</span>{(userData?.takaBalance||0).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 justify-end"><Coins size={9} />Coins</p>
                    <p className="text-2xl font-black text-amber-400">{(userData?.coins||0).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-zinc-600 text-[10px] font-bold">Conversion progress</span>
                    <span className="text-amber-400/80 text-[10px] font-black">{cs.coinRate.toLocaleString()} 🪙 = ৳10</span>
                  </div>
                  <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <motion.div className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full"
                      initial={{width:0}} animate={{width:`${progressPct}%`}} transition={{duration:1.2,ease:'easeOut'}} />
                  </div>
                  <p className="text-zinc-700 text-[10px] mt-1 text-right">{Math.min(userData?.coins||0,cs.coinRate).toLocaleString()} / {cs.coinRate.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-4 grid grid-cols-2 gap-3 mb-4">
              <motion.button whileTap={{scale:0.96}} onClick={() => canConvert ? setScreen('convert') : showToast(`Minimum ${convertUnit.toLocaleString()} coin দরকার!`,'error')}
                className={`rounded-[20px] p-4 flex flex-col items-center gap-2 border transition-all ${canConvert?'bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border-amber-500/25':'bg-[#1a1a1d] border-white/5 opacity-60'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${canConvert?'bg-amber-500/20 border border-amber-500/30':'bg-white/5'}`}>
                  <ArrowRightLeft size={22} className={canConvert?'text-amber-400':'text-zinc-500'} />
                </div>
                <span className={`font-bold text-sm ${canConvert?'text-white':'text-zinc-500'}`}>Convert</span>
                <span className="text-[10px] text-zinc-600 -mt-1.5">Coin → Taka</span>
              </motion.button>

              <motion.button whileTap={{scale:0.96}} onClick={() => canWithdraw ? setScreen('withdraw') : showToast(`Minimum ৳${cs.minWithdraw} দরকার!`,'error')}
                className={`rounded-[20px] p-4 flex flex-col items-center gap-2 border transition-all ${canWithdraw?'bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/25':'bg-[#1a1a1d] border-white/5 opacity-60'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${canWithdraw?'bg-emerald-500/20 border border-emerald-500/30':'bg-white/5'}`}>
                  <ArrowDownToLine size={22} className={canWithdraw?'text-emerald-400':'text-zinc-500'} />
                </div>
                <span className={`font-bold text-sm ${canWithdraw?'text-white':'text-zinc-500'}`}>Withdraw</span>
                <span className="text-[10px] text-zinc-600 -mt-1.5">bKash / Nagad</span>
              </motion.button>
            </div>

            {/* Rate info */}
            <div className="px-4 mb-4">
              <button onClick={() => setExpandRates(v=>!v)}
                className="w-full bg-[#1a1a1d] border border-white/5 rounded-[20px] px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <TrendingUp size={15} className="text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-bold">Coin → Taka Rate</p>
                    <p className="text-zinc-500 text-[11px]">{cs.coinRate.toLocaleString()} Coin = ৳10 · Min ৳{cs.minWithdraw}</p>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-200 ${expandRates?'rotate-180':''}`} />
              </button>
              <AnimatePresence>
                {expandRates && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                    <div className="bg-[#141418] border border-white/5 border-t-0 rounded-b-[20px] divide-y divide-white/5">
                      {[1,2,5,10].map((mult,i) => {
                        const c = cs.coinRate*mult; const t = 10*mult;
                        const has = (userData?.coins||0) >= c;
                        return (
                          <div key={i} className="flex items-center justify-between px-4 py-3">
                            <span className={`text-sm font-bold ${has?'text-amber-400':'text-zinc-600'}`}>🪙 {c.toLocaleString()}</span>
                            <span className={`text-sm font-black ${has?'text-emerald-400':'text-zinc-600'}`}>৳ {t}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Invite card */}
            <div className="px-4 mb-4">
              <div className="relative overflow-hidden rounded-[24px] border border-indigo-500/20"
                style={{background:'linear-gradient(135deg,#1e1b4b 0%,#1e2d5a 50%,#1a3a5c 100%)'}}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-[12px] bg-white/15 flex items-center justify-center border border-white/10">
                        <UserPlus size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white font-black text-base leading-tight">Invite & Earn</p>
                        <p className="text-blue-200 text-[11px]">প্রতি refer এ <span className="text-amber-300 font-black">{cs.coinPerRefer} Coins</span></p>
                      </div>
                    </div>
                    <div className="bg-black/30 px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
                      <Users size={11} className="text-blue-200" />
                      <span className="text-white font-black text-sm">{userData?.referralCount||0}</span>
                    </div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-[12px] flex items-center px-3 py-2.5 mb-3 gap-2 min-w-0">
                    {!settingsLoaded || !userData ? (
                      <span className="flex-1 text-zinc-500 text-[11px] italic">⏳ Loading...</span>
                    ) : referralLink ? (
                      <span className="flex-1 text-white/80 font-mono text-[11px] truncate">
                        {referralLink}
                      </span>
                    ) : (
                      <span className="flex-1 text-amber-400/70 text-[11px] italic">
                        ⚠️ Admin এ Bot Username set করো
                      </span>
                    )}
                    <button onClick={copyLink} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
                      {copied ? <CheckCheck size={15} className="text-emerald-400" /> : <Copy size={15} className="text-blue-200" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{scale:0.96}} onClick={copyLink}
                      className="flex-1 py-2.5 bg-white/10 border border-white/10 rounded-[12px] font-bold text-sm text-white flex items-center justify-center gap-2">
                      {copied ? <><CheckCheck size={13} className="text-emerald-400" />Copied!</> : <><Copy size={13} />Copy Link</>}
                    </motion.button>
                    <motion.button whileTap={{scale:0.96}} onClick={forwardLink}
                      className="flex-1 py-2.5 bg-white rounded-[12px] font-black text-sm text-blue-700 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,255,255,0.12)]">
                      <Send size={13} />Forward to Friends
                    </motion.button>
                  </div>
                  {settingsLoaded && !cs.referralBotUsername && (
                    <p className="text-amber-300/70 text-[10px] mt-2 flex items-center gap-1"><XCircle size={10} />Admin এ Referral Bot Username set নেই</p>
                  )}
                </div>
              </div>
            </div>

            {/* Milestone */}
            {nextMilestone && (
              <div className="px-4 mb-4">
                <div className="bg-purple-500/8 border border-purple-500/15 rounded-[20px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Award size={15} className="text-purple-400" />
                    <span className="text-purple-300 text-sm font-bold">পরের Milestone</span>
                    {claimedCount > 0 && <span className="ml-auto text-[10px] text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">{claimedCount} claimed ✓</span>}
                  </div>
                  <p className="text-white/80 text-sm mb-3">
                    আর <span className="text-amber-400 font-black">{nextMilestone.count-(userData?.referralCount||0)} জন</span> refer = <span className="text-amber-400 font-black">+{nextMilestone.bonus} Coin</span>
                  </p>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full" initial={{width:0}}
                      animate={{width:`${Math.min(100,((userData?.referralCount||0)/nextMilestone.count)*100)}%`}} transition={{duration:0.8}} />
                  </div>
                  <p className="text-purple-600 text-[10px] mt-1 text-right">{userData?.referralCount||0} / {nextMilestone.count}</p>
                </div>
              </div>
            )}

            {/* Nav links */}
            <div className="px-4 space-y-2.5 pb-28">
              {[
                { icon: ListChecks, label:'Tasks',               sub:'Ad দেখে টাকা/Coin পাও',           color:'text-blue-400',   bg:'bg-blue-500/10 border-blue-500/15',    s:'tasks'   as const },
                { icon: Gift,      label:'Earn More Coins',    sub:'Referral, Daily, Milestones',     color:'text-amber-400',  bg:'bg-amber-500/10 border-amber-500/15',  s:'earn'    as const },
                { icon: History,   label:'Transaction History', sub:'Withdrawals ও Coin activity',    color:'text-zinc-400',   bg:'bg-white/5 border-white/5',            s:'history' as const },
              ].map(item => (
                <motion.button key={item.s} whileTap={{scale:0.98}} onClick={() => setScreen(item.s)}
                  className="w-full bg-[#1a1a1d] border border-white/5 rounded-[20px] p-4 flex items-center gap-3.5 hover:bg-[#222226] transition-colors">
                  <div className={`w-11 h-11 rounded-[14px] ${item.bg} border flex items-center justify-center ${item.color} flex-shrink-0`}>
                    <item.icon size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-bold text-sm text-white block">{item.label}</span>
                    <span className="text-[11px] text-zinc-500">{item.sub}</span>
                  </div>
                  <ChevronRight size={15} className="text-zinc-600 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════ EARN ══════════════════════════════════ */}
        {screen==='earn' && (
          <motion.div key="earn" variants={pv} initial="initial" animate="animate" exit="exit" className="flex-1 overflow-y-auto no-scrollbar">
            <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5 sticky top-0 bg-[#09090c]/90 backdrop-blur-xl z-20">
              <button onClick={() => setScreen('main')} className="p-2.5 bg-[#1a1a1d] rounded-full"><ArrowLeft size={18} /></button>
              <div><h2 className="text-lg font-black">Earn Coins</h2><p className="text-zinc-500 text-[11px]">Coins আয়ের সব উপায়</p></div>
            </div>
            <div className="p-4 space-y-3 pb-24">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest px-1">কিভাবে Coin আয় করবে</p>
              {[
                { icon:'🎁', title:'নতুন Join',       desc:'প্রথমবার app open করলে',        coin:`+${cs.coinWelcome}`,     c:'emerald' },
                { icon:'👥', title:'Friend Refer',    desc:'বন্ধু প্রথম video click করলে', coin:`+${cs.coinPerRefer}`,    c:'amber' },
                { icon:'📅', title:'Daily Login',     desc:'প্রতিদিন app open করলে',       coin:`+${cs.coinDaily}`,       c:'blue' },
                { icon:'🎯', title:'5 Refer Bonus',   desc:'5 জন refer complete হলে',      coin:`+${cs.coinMilestone5}`,  c:'purple' },
                { icon:'⭐', title:'10 Refer Bonus',  desc:'10 জন refer complete হলে',     coin:`+${cs.coinMilestone10}`, c:'purple' },
                { icon:'🏆', title:'20 Refer Bonus',  desc:'20 জন refer complete হলে',     coin:`+${cs.coinMilestone20}`, c:'purple' },
                { icon:'💎', title:'50 Refer Bonus',  desc:'50 জন refer complete হলে',     coin:`+${cs.coinMilestone50}`, c:'yellow' },
              ].map((item,i) => {
                const cm: Record<string,string> = {
                  emerald:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  amber:'text-amber-400 bg-amber-500/10 border-amber-500/20',
                  blue:'text-blue-400 bg-blue-500/10 border-blue-500/20',
                  purple:'text-purple-400 bg-purple-500/10 border-purple-500/20',
                  yellow:'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                };
                return (
                  <motion.div key={i} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                    className="flex items-center gap-4 bg-[#1a1a1d] rounded-[18px] p-4 border border-white/5">
                    <span className="text-2xl w-10 flex-shrink-0 text-center">{item.icon}</span>
                    <div className="flex-1 min-w-0"><p className="text-white text-sm font-bold">{item.title}</p><p className="text-zinc-500 text-xs mt-0.5 truncate">{item.desc}</p></div>
                    <span className={`font-black text-sm px-3 py-1.5 rounded-xl border flex-shrink-0 ${cm[item.c]}`}>{item.coin}</span>
                  </motion.div>
                );
              })}

              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest px-1 pt-3">Coin → Taka হিসাব</p>
              <div className="bg-[#1a1a1d] rounded-[20px] overflow-hidden border border-white/5">
                {[1,2,5,10].map((mult,i) => {
                  const c = cs.coinRate*mult; const t = 10*mult;
                  const has = (userData?.coins||0) >= c;
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-3.5 ${i<3?'border-b border-white/5':''}`}>
                      <span className={`text-sm font-bold ${has?'text-amber-400':'text-zinc-600'}`}>🪙 {c.toLocaleString()}</span>
                      <span className="text-zinc-700 text-xs">→</span>
                      <span className={`text-sm font-bold ${has?'text-emerald-400':'text-zinc-600'}`}>৳{t}</span>
                    </div>
                  );
                })}
              </div>

              <motion.button whileTap={canConvert?{scale:0.98}:{}} onClick={() => canConvert ? setScreen('convert') : showToast(`${convertUnit.toLocaleString()} coin দরকার!`,'error')}
                className={`w-full py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 ${canConvert?'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-[0_4px_20px_rgba(245,158,11,0.3)]':'bg-white/5 text-zinc-500 border border-white/5'}`}>
                <Coins size={18} />{canConvert?'Coin Convert করো':`আরো ${Math.max(0,convertUnit-(userData?.coins||0)).toLocaleString()} coin দরকার`}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════ CONVERT ══════════════════════════════ */}
        {screen==='convert' && (
          <motion.div key="convert" variants={pv} initial="initial" animate="animate" exit="exit" className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5 sticky top-0 bg-[#09090c]/90 backdrop-blur-xl z-20">
              <button onClick={() => setScreen('main')} className="p-2.5 bg-[#1a1a1d] rounded-full"><ArrowLeft size={18} /></button>
              <div><h2 className="text-lg font-black">Convert Coins</h2><p className="text-zinc-500 text-[11px]">Coins → Taka তে রূপান্তর</p></div>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-5">
              {/* Available */}
              <div className="bg-[#1a1a1d] border border-white/5 rounded-[20px] p-4 flex justify-between items-center">
                <div><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">তোমার Coins</p><p className="text-amber-400 font-black text-2xl">{(userData?.coins||0).toLocaleString()} 🪙</p></div>
                <div className="text-right"><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Rate</p><p className="text-white font-bold text-sm">{cs.coinRate.toLocaleString()} 🪙 = ৳10</p></div>
              </div>

              {/* Quick select */}
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 px-1">Quick Select</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1,2,5,10].map(mult => {
                    const c = cs.coinRate*mult;
                    const has = (userData?.coins||0) >= c;
                    const sel = convertCoins === String(c);
                    return (
                      <motion.button key={mult} whileTap={{scale:0.95}}
                        onClick={() => { if(has){setConvertCoins(String(c));haptic('light');} else showToast('Coin কম!','error'); }}
                        className={`py-3 rounded-[16px] border text-center transition-all ${sel?'bg-amber-500/20 border-amber-500/50':has?'bg-[#1a1a1d] border-white/5':'bg-[#111] border-white/3 opacity-40'}`}>
                        <p className={`font-black text-sm ${sel?'text-amber-300':has?'text-white':'text-zinc-600'}`}>{c>=1000?`${c/1000}K`:c} 🪙</p>
                        <p className={`text-[10px] font-bold mt-0.5 ${sel?'text-emerald-400':has?'text-zinc-500':'text-zinc-700'}`}>৳{10*mult}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Manual input */}
              <div className="bg-[#1a1a1d] border border-white/5 rounded-[20px] p-4 focus-within:border-amber-500/30 transition-colors">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">অথবা নিজে লেখো (কমপক্ষে {cs.coinRate.toLocaleString()} Coin)</p>
                <div className="flex items-center gap-2">
                  <Coins size={20} className="text-amber-500 flex-shrink-0" />
                  <input type="number" value={convertCoins} onChange={e => setConvertCoins(e.target.value)} placeholder={String(cs.coinRate)}
                    className="w-full bg-transparent text-white text-2xl font-black outline-none placeholder:text-zinc-800" />
                </div>
              </div>

              {/* Preview */}
              {convertedTaka && (
                <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
                  className="bg-emerald-500/10 border border-emerald-500/25 rounded-[20px] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-xs mb-1">Convert করবে</p>
                    <p className="text-amber-400 font-black">{parseInt(convertCoins).toLocaleString()} Coin</p>
                  </div>
                  <Sparkles size={20} className="text-amber-400" />
                  <div className="text-right">
                    <p className="text-zinc-400 text-xs mb-1">পাবে</p>
                    <p className="text-emerald-400 font-black text-2xl">৳{convertedTaka}</p>
                  </div>
                </motion.div>
              )}

              <motion.button whileTap={convertedTaka?{scale:0.98}:{}} onClick={handleConvert} disabled={convertLoading||!convertedTaka}
                className={`w-full py-4 rounded-[20px] font-black text-lg flex items-center justify-center gap-2 mt-auto transition-all ${convertedTaka?'bg-white text-black shadow-lg':'bg-[#1a1a1d] text-zinc-600 border border-white/5 opacity-60'}`}>
                {convertLoading
                  ? <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full" />
                  : <><ArrowRightLeft size={20} />Confirm Conversion</>}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════ WITHDRAW ═════════════════════════════ */}
        {screen==='withdraw' && (
          <motion.div key="withdraw" variants={pv} initial="initial" animate="animate" exit="exit" className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5 sticky top-0 bg-[#09090c]/90 backdrop-blur-xl z-20">
              <button onClick={() => setScreen('main')} className="p-2.5 bg-[#1a1a1d] rounded-full"><ArrowLeft size={18} /></button>
              <div><h2 className="text-lg font-black">Withdraw</h2><p className="text-zinc-500 text-[11px]">Min ৳{cs.minWithdraw} · Available ৳{(userData?.takaBalance||0).toFixed(2)}</p></div>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4">
              <div className="bg-[#1a1a1d] border border-white/5 rounded-[20px] p-4 flex items-center justify-between">
                <span className="text-zinc-400 text-sm font-bold">Available Balance</span>
                <span className="text-emerald-400 font-black text-xl bg-emerald-500/10 px-3 py-1 rounded-xl">৳{(userData?.takaBalance||0).toFixed(2)}</span>
              </div>

              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 px-1">Payment Method</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {id:'bkash' as const, label:'bKash', color:'#E2136E', logo:'https://freelogopng.com/images/all_img/1656234841bkash-icon-png.png'},
                    {id:'nagad' as const, label:'Nagad', color:'#ED1C24', logo:'https://download.logo.wine/logo/Nagad/Nagad-Logo.wine.png'}
                  ].map(m => (
                    <motion.button whileTap={{scale:0.96}} key={m.id} onClick={() => {setWMethod(m.id);haptic('light');}}
                      className={`flex items-center gap-3 p-4 rounded-[20px] border-2 transition-all ${wMethod===m.id?'border-current':'border-white/5 bg-[#1a1a1d]'}`}
                      style={wMethod===m.id?{borderColor:m.color,backgroundColor:`${m.color}18`,color:m.color}:{}}>
                      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center bg-white overflow-hidden flex-shrink-0">
                        <img src={m.logo} alt={m.label} className={`w-full h-full object-contain ${m.id==='nagad'?'p-1':'p-1.5'}`}
                          onError={(e) => {e.currentTarget.style.display='none'; const p=e.currentTarget.parentElement; if(p){p.style.background=m.color;p.innerHTML=`<span style="color:white;font-weight:900;font-size:12px;width:100%;height:100%;display:flex;align-items:center;justify-content:center">${m.label[0]}</span>`;} }} />
                      </div>
                      <span className="text-white font-bold">{m.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-[#1a1a1d] border border-white/5 rounded-[20px] p-4 focus-within:border-emerald-500/30 transition-colors">
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Account Number</p>
                  <input type="tel" value={wNumber} onChange={e=>setWNumber(e.target.value)} placeholder="01XXXXXXXXX"
                    className="w-full bg-transparent text-white text-2xl font-black outline-none placeholder:text-zinc-800 tracking-wider" />
                </div>
                <div className="bg-[#1a1a1d] border border-white/5 rounded-[20px] p-4 focus-within:border-emerald-500/30 transition-colors">
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Amount (BDT)</p>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600 text-3xl font-black">৳</span>
                    <input type="number" value={wAmount} onChange={e=>setWAmount(e.target.value)} placeholder={String(cs.minWithdraw)}
                      className="w-full bg-transparent text-white text-3xl font-black outline-none placeholder:text-zinc-800" />
                  </div>
                </div>
              </div>

              <motion.button whileTap={wAmount&&wNumber.length>=11?{scale:0.98}:{}} onClick={handleWithdraw} disabled={wLoading||!wAmount||!wNumber}
                className={`w-full py-4 rounded-[20px] font-black text-lg flex items-center justify-center gap-2 mt-auto transition-all ${wAmount&&wNumber.length>=11?'bg-emerald-500 text-black shadow-[0_4px_20px_rgba(34,197,94,0.3)]':'bg-[#1a1a1d] text-zinc-600 opacity-60'}`}>
                {wLoading ? <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full" /> : 'Submit Request'}
              </motion.button>
            </div>
          </motion.div>
        )}


        {/* ══════════════════════════ TASKS ═══════════════════════════════ */}
        {screen==='tasks' && (
          <motion.div key="tasks" variants={pv} initial="initial" animate="animate" exit="exit"
            className="flex-1 overflow-y-auto no-scrollbar flex flex-col">

            <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5 sticky top-0 bg-[#09090c]/90 backdrop-blur-xl z-20">
              <button onClick={() => setScreen('main')} className="p-2.5 bg-[#1a1a1d] rounded-full">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-black">Tasks — আয় করো</h2>
                <p className="text-zinc-500 text-[11px]">Ad দেখো, টাকা/Coin পাও</p>
              </div>
            </div>

            <div className="p-4 space-y-3 pb-28">
              {tasks.length === 0 ? (
                <div className="bg-[#1a1a1d] border border-white/5 rounded-[20px] p-8 text-center">
                  <p className="text-3xl mb-3">📋</p>
                  <p className="text-zinc-400 text-sm font-bold">এখন কোনো Task নেই</p>
                  <p className="text-zinc-600 text-xs mt-1">Admin পরে যোগ করবে</p>
                </div>
              ) : tasks.filter((t:any) => t.enabled !== false).map((task:any) => {
                const todayStr = new Date().toDateString();
                const uid = tgUser ? String(tgUser.id) : '';
                const countKey = `cine_task_${uid}_${task.id}_${todayStr}`;
                const todayCount = parseInt(localStorage.getItem(countKey) || '0');
                const maxAds = task.maxAdsPerDay ?? 10;
                const rewardPerAd = task.rewardPerAd ?? 3;
                const rewardType = task.rewardType ?? 'taka'; // 'taka' or 'coin'
                const cooldownSecs = globalAdSettings.taskCooldownSecs ?? 5;
                const remaining = taskCooldown[task.id] || 0;
                const isLoading = taskAdLoading === task.id;
                const isDone = todayCount >= maxAds;
                const msg = taskMsg[task.id] || '';

                return (
                  <div key={task.id} className="bg-white rounded-[20px] overflow-hidden shadow-md">
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-[14px] flex items-center justify-center flex-shrink-0">
                          <PlayCircle size={26} className="text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-900 font-black text-base">{task.title || 'ভিডিও এড দেখে আয়🤑'}</p>
                          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                            {globalAdSettings.adsgramEnabled ? 'ADSGRAM' : globalAdSettings.adEnabled ? 'MONETAG' : 'AD'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-black text-lg ${rewardType==='coin'?'text-amber-500':'text-emerald-600'}`}>
                            {rewardType==='coin'?'🪙':' ৳'}{rewardPerAd}
                          </p>
                          <p className="text-gray-400 text-[10px]">/ Ad</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-500 text-[11px] font-bold uppercase">VIEWS: {todayCount}/{maxAds}</span>
                          <span className="text-gray-500 text-[11px]">মোট আয়: {rewardType==='coin'?'🪙':' ৳'}{maxAds*rewardPerAd}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100,(todayCount/maxAds)*100)}%` }} />
                        </div>
                      </div>

                      {/* Message */}
                      {msg && (
                        <div className={`w-full py-2.5 rounded-[12px] text-center font-bold text-sm mb-2 ${msg.startsWith('✅')?'bg-emerald-50 text-emerald-600':'bg-red-50 text-red-500'}`}>
                          {msg}
                        </div>
                      )}

                      {/* Cooldown bar */}
                      {remaining > 0 && (
                        <div className="w-full py-2.5 mb-2 rounded-[12px] bg-orange-50 border border-orange-200 flex items-center justify-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-orange-400 flex items-center justify-center">
                            <span className="text-orange-500 font-black text-xs">{remaining}</span>
                          </div>
                          <span className="text-orange-500 text-sm font-bold">পরের Ad এর জন্য অপেক্ষা করুন...</span>
                        </div>
                      )}

                      {/* Button */}
                      <motion.button
                        whileTap={!isDone && !isLoading && remaining === 0 ? {scale:0.97} : {}}
                        disabled={isLoading || isDone || remaining > 0}
                        onClick={async () => {
                          if (!tgUser) { setTaskMsg(m=>({...m,[task.id]:'❌ Telegram এ login করুন'})); setTimeout(()=>setTaskMsg(m=>({...m,[task.id]:''})),3000); return; }
                          if (!globalAdSettings.adsgramEnabled && !globalAdSettings.adEnabled) {
                            setTaskMsg(m=>({...m,[task.id]:'❌ Admin এ Ad চালু করুন'})); setTimeout(()=>setTaskMsg(m=>({...m,[task.id]:''})),3000); return;
                          }

                          setTaskAdLoading(task.id);
                          setTaskMsg(m=>({...m,[task.id]:''}));

                          // ── Show Ad (Adsgram OR Monetag) ──
                          const watched = await new Promise<boolean>(resolve => {
                            if (globalAdSettings.adsgramEnabled) {
                              let attempts = 0;
                              const try_ = () => {
                                // @ts-ignore
                                const AC = window.Adsgram;
                                if (typeof AC !== 'undefined') {
                                  try {
                                    // @ts-ignore
                                    AC.init({blockId: String(globalAdSettings.adsgramBlockId)}).show()
                                      .then(()=>resolve(true)).catch(()=>resolve(false));
                                  } catch { resolve(false); }
                                } else if (attempts < 25) { attempts++; setTimeout(try_, 400); }
                                else { resolve(false); }
                              };
                              try_();
                            } else {
                              // Monetag
                              const fnName = `show_${globalAdSettings.adZoneId}`;
                              let attempts = 0;
                              const try_ = () => {
                                // @ts-ignore
                                const fn = window[fnName];
                                if (typeof fn === 'function') {
                                  fn().then(()=>resolve(true)).catch(()=>resolve(false));
                                } else if (attempts < 30) { attempts++; setTimeout(try_, 200); }
                                else { resolve(false); }
                              };
                              try_();
                            }
                          });

                          setTaskAdLoading(null);

                          if (!watched) {
                            setTaskMsg(m=>({...m,[task.id]:'❌ Ad skip করলে reward নেই'}));
                            setTimeout(()=>setTaskMsg(m=>({...m,[task.id]:''})),3000);
                            // Cooldown even on skip
                            let s = cooldownSecs;
                            setTaskCooldown(cd=>({...cd,[task.id]:s}));
                            const iv = setInterval(()=>{ s--; if(s<=0){clearInterval(iv); setTaskCooldown(cd=>({...cd,[task.id]:0}));} else setTaskCooldown(cd=>({...cd,[task.id]:s})); },1000);
                            return;
                          }

                          // ✅ Reward দাও
                          const uid2 = String(tgUser.id);
                          const { updateDoc, doc:fd, increment:fi, addDoc:fa, collection:fc, serverTimestamp:fs } = await import('firebase/firestore');
                          const { db:fdb } = await import('../firebase');
                          try {
                            if (rewardType === 'coin') {
                              await updateDoc(fd(fdb,'users',uid2), { coins: fi(rewardPerAd) });
                              await fa(fc(fdb,`users/${uid2}/coinHistory`), { type:'earn', reason:`📺 Task — ${task.title||'Ad Watch'}`, amount:rewardPerAd, createdAt:fs() });
                            } else {
                              await updateDoc(fd(fdb,'users',uid2), { takaBalance: fi(rewardPerAd) });
                              await fa(fc(fdb,`users/${uid2}/coinHistory`), { type:'earn', reason:`📺 Task — ${task.title||'Ad Watch'}`, amount:rewardPerAd, isTaka:true, createdAt:fs() });
                            }
                            const newCount = todayCount + 1;
                            localStorage.setItem(countKey, String(newCount));
                            haptic('success');
                            setTaskMsg(m=>({...m,[task.id]:`✅ +${rewardType==='coin'?'🪙':' ৳'}${rewardPerAd} পেয়েছ!`}));
                            setTimeout(()=>setTaskMsg(m=>({...m,[task.id]:''})),3000);
                          } catch { setTaskMsg(m=>({...m,[task.id]:'❌ Error হয়েছে'})); setTimeout(()=>setTaskMsg(m=>({...m,[task.id]:''})),3000); }

                          // ✅ Cooldown শুরু
                          let s = cooldownSecs;
                          setTaskCooldown(cd=>({...cd,[task.id]:s}));
                          const iv = setInterval(()=>{ s--; if(s<=0){clearInterval(iv); setTaskCooldown(cd=>({...cd,[task.id]:0}));} else setTaskCooldown(cd=>({...cd,[task.id]:s})); },1000);
                        }}
                        className={`w-full py-3.5 rounded-[14px] font-black text-sm flex items-center justify-center gap-2 transition-all ${
                          isDone ? 'bg-gray-100 text-gray-400'
                          : remaining > 0 ? 'bg-orange-100 text-orange-400'
                          : 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.35)]'
                        }`}
                      >
                        {isLoading ? (
                          <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:'linear'}}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                        ) : isDone ? '🎉 আজকের Task শেষ!' : remaining > 0 ? `⏳ ${remaining}s` : <><PlayCircle size={18} />▶ অ্যাড দেখুন</>}
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════ HISTORY ══════════════════════════════ */}
        {screen==='history' && (
          <motion.div key="history" variants={pv} initial="initial" animate="animate" exit="exit" className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5 sticky top-0 bg-[#09090c]/90 backdrop-blur-xl z-20">
              <button onClick={() => setScreen('main')} className="p-2.5 bg-[#1a1a1d] rounded-full"><ArrowLeft size={18} /></button>
              <div><h2 className="text-lg font-black">Activity Log</h2><p className="text-zinc-500 text-[11px]">Withdrawals ও Coin history</p></div>
            </div>
            <div className="p-4 space-y-4 pb-24">
              {withdrawals.length > 0 && (
                <div>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 px-1">Withdrawal Requests</p>
                  <div className="space-y-2.5">
                    {withdrawals.map((w,i) => (
                      <motion.div key={w.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                        className="p-4 rounded-[20px] bg-[#1a1a1d] border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-[12px] bg-white overflow-hidden flex-shrink-0" style={{border:`1.5px solid ${w.method==='bkash'?'#E2136E':'#ED1C24'}`}}>
                              <img src={w.method==='bkash'?'https://freelogopng.com/images/all_img/1656234841bkash-icon-png.png':'https://download.logo.wine/logo/Nagad/Nagad-Logo.wine.png'}
                                alt={w.method} className={`w-full h-full object-contain ${w.method==='nagad'?'p-0.5':'p-1.5'}`}
                                onError={(e) => {e.currentTarget.style.display='none'; const p=e.currentTarget.parentElement; if(p){p.style.background=w.method==='bkash'?'#E2136E':'#ED1C24';p.innerHTML=`<span style="color:white;font-weight:900;font-size:11px;display:flex;align-items:center;justify-content:center;height:100%;width:100%">${w.method==='bkash'?'B':'N'}</span>`;} }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-bold text-sm truncate">{w.number}</p>
                              <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mt-0.5">{w.method}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-white font-black text-base">৳{w.amount}</p>
                            <div className={`inline-flex px-2 py-0.5 rounded-md mt-1 ${w.status==='pending'?'bg-amber-500/10':w.status==='success'?'bg-emerald-500/10':'bg-red-500/10'}`}>
                              <p className={`text-[9px] font-black uppercase tracking-widest ${w.status==='pending'?'text-amber-400':w.status==='success'?'text-emerald-400':'text-red-400'}`}>{w.status}</p>
                            </div>
                          </div>
                        </div>
                        {w.adminNote && <div className="mt-3 p-3 rounded-[12px] bg-black/40 border border-white/5"><p className="text-zinc-400 text-xs">{w.adminNote}</p></div>}
                        <p className="text-zinc-700 text-[10px] mt-2 flex items-center gap-1"><Clock size={9} />{ft(w.createdAt)}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 px-1">Coin Activity</p>
                {coinHistory.length===0 ? (
                  <div className="text-center py-14 bg-[#1a1a1d] rounded-[24px] border border-white/5">
                    <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3"><History size={22} className="text-zinc-600" /></div>
                    <p className="text-zinc-500 text-sm">কোনো history নেই</p>
                  </div>
                ) : (
                  <div className="bg-[#1a1a1d] border border-white/5 rounded-[24px] overflow-hidden">
                    {coinHistory.map((h,i) => (
                      <motion.div key={h.id} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{delay:i*0.025}}
                        className={`flex items-center gap-4 p-4 ${i!==coinHistory.length-1?'border-b border-white/5':''}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${h.type==='earn'?'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20':'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {h.type==='earn' ? <ArrowDownToLine size={14} /> : <Zap size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-bold truncate">{h.reason}</p>
                          <p className="text-zinc-600 text-[10px] font-bold mt-0.5">{ft(h.createdAt)}</p>
                        </div>
                        <span className={`font-black text-sm flex-shrink-0 ${h.type==='earn'?'text-emerald-400':'text-amber-400'}`}>
                          {h.type==='earn'?'+':'-'}{h.amount} 🪙
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
};

export default UserProfile;
