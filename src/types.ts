export interface Episode {
  id: string;
  number: number;
  season: number;
  title: string;
  duration: string;
  telegramCode: string;
  downloadCode?: string;
  downloadLink?: string;
  fileSize?: string;
  audioLanguage?: string;
  subtitles?: string;
  quality?: string;
  thumbnail?: string;
  isComingSoon?: boolean;
  releaseDate?: string;
  isUpcoming?: boolean;
  watchAdCount?: number;
  downloadAdCount?: number;
}

export interface SeasonInfo {
  season: number;
  isLocked?: boolean;
  isComingSoon?: boolean;
  releaseDate?: string;
  title?: string;
}

export interface Movie {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
  telegramCode: string;
  downloadCode?: string;
  downloadLink?: string;
  rating: number;
  views: string;
  year?: string;
  quality?: string;
  description?: string;
  episodes?: Episode[];
  seasons?: SeasonInfo[];
  isPremium?: boolean;
  createdAt?: any;
  fileSize?: string;
  duration?: string;
  audioLanguage?: string;
  subtitles?: string;
  videoQuality?: string;
  detailBanner?: string;
  screenshots?: string[];
  isUpcoming?: boolean;
  releaseDate?: string;
  isFeatured?: boolean;
  featuredOrder?: number;
  isTop10?: boolean;
  top10Position?: number;
  storyImage?: string;
  storyEnabled?: boolean;
  priority?: number;
  isExclusive?: boolean;
  watchAdCount?: number;
  downloadAdCount?: number;
}

export interface StoryItem {
  id: string;
  image: string;
  thumbnailUrl?: string;
  movieId?: string;
  link?: string;
  order: number;
  createdAt?: any;
  storyBadge?: string;
}

export interface BannerItem {
  id: string;
  movieId?: string;
  title: string;
  image: string;
  description?: string;
  link?: string;
  order: number;
  isActive: boolean;
  createdAt?: any;
}

export interface AppSettings {
  botUsername: string;
  channelLink: string;
  noticeChannelLink?: string;
  noticeText?: string;
  noticeEnabled?: boolean;
  autoViewIncrement?: boolean;
  categories?: string[];
  enableTop10?: boolean;
  enableStories?: boolean;
  enableBanners?: boolean;
  primaryColor?: string;
  appName?: string;
  // ✅ Referral Bot (আলাদা — referral link এর জন্য)
  referralBotUsername?: string;
  referralAppName?: string;
  // ✅ Ad Settings
  adEnabled?: boolean;
  adZoneId?: string;
  adScriptUrl?: string;
  adsgramEnabled?: boolean;
  adsgramBlockId?: string;
  defaultWatchAdCount?: number;
  defaultDownloadAdCount?: number;
  tutorialChannelLink?: string;
  // ✅ Coin Settings
  coinWelcome?: number;
  coinDaily?: number;
  coinPerRefer?: number;
  coinMilestone5?: number;
  coinMilestone10?: number;
  coinMilestone20?: number;
  coinMilestone50?: number;
  coinRate?: number;
  minWithdraw?: number;
  // ✅ Coin per Ad
  coinPerAd?: number;
  taskCooldownSecs?: number;
  maintenanceEnabled?: boolean;
  maintenanceMessage?: string;
  maintenanceStartTime?: string;
  maintenanceEndTime?: string;
  maintenanceButtonText?: string;
  maintenanceButtonLink?: string;
  appName?: string;
  // ✅ Ads-Free with Coin
  adsFreeEnabled?: boolean;
  adsFreeCoinsPerContent?: number;
  // ✅ 18+ Section
  adultDefaultPrice?: number;    // Default premium price in taka
  adultBannerUrl?: string;       // Home এ দেখানো YT size banner
  adultSectionHidden?: boolean;  // পুরো section hide করো
  adultTutorialBanner?: string;  // "কিভাবে দেখবেন" banner inside page
  adultTutorialLink?: string;    // Tutorial banner click link
}

export type Category = 'All' | 'Exclusive' | 'Movies' | 'Web Series' | 'K-Drama' | 'Anime' | string;

export interface AdultBannerItem {
  id: string;
  title: string;
  thumbnail: string;
  homeBanner?: string;
  channelLink: string;
  category?: string;
  duration?: string;
  views?: number;
  isPremium?: boolean;
  premiumPrice?: number;
  watchAdCount?: number;        // Ads to watch (free content)
  premiumWatchAdCount?: number; // Ads after paying (premium)
  order: number;
  isActive: boolean;
  createdAt?: any;
}
