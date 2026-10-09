export const BRAND_NAME = "StiveBet";

export interface NavItem {
  label: string;
  href: string;
  enabled: boolean;
}

/** Only Sports, Games and Live Betting are real destinations; the rest are
 * shown for visual completeness but intentionally do nothing. */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Sports", href: "/sports", enabled: true },
  { label: "Games", href: "/games", enabled: true },
  { label: "Live Betting", href: "/live-betting", enabled: true },
  { label: "Scheduled Virtuals", href: "#", enabled: false },
  { label: "Jackpot", href: "#", enabled: false },
  { label: "Livescore", href: "#", enabled: false },
  { label: "Results", href: "#", enabled: false },
  { label: "Promotions", href: "#", enabled: false },
  { label: "Stive Loyalty", href: "#", enabled: false },
  { label: "App", href: "#", enabled: false },
];

export const ACCOUNT_NAV: NavItem[] = [
  { label: "My Account Info", href: "/account", enabled: true },
  { label: "Sporty Loyalty", href: "/account/loyalty", enabled: true },
  { label: "Daily Streak", href: "/account/daily-streak", enabled: true },
  { label: "Deposit", href: "/account/deposit", enabled: true },
  { label: "Withdraw", href: "/account/withdraw", enabled: true },
  { label: "Bet History", href: "/account/bet-history", enabled: true },
  { label: "Transactions", href: "/account/transactions", enabled: true },
  { label: "Notification Center", href: "/account/notifications", enabled: true },
  { label: "Gifts", href: "/account/gifts", enabled: true },
  { label: "Safety & Security", href: "/account/security", enabled: true },
];

/** Fixed reference "now" for the demo's mock kickoff times — deterministic
 * (not wall-clock), so the start-time filter behaves the same on every
 * render instead of drifting as real time passes. */
export const DEMO_NOW = "2026-07-23T00:00:00Z";

export const START_TIME_HOURS: Record<string, number | null> = {
  "1h": 1,
  "3h": 3,
  "6h": 6,
  "24h": 24,
  All: null,
};

export const MIN_DEPOSIT_AMOUNT = 400;
export const MAX_DEPOSIT_AMOUNT = 50000;

export const MIN_WITHDRAWAL_AMOUNT = 3000;
export const MIN_BET_AMOUNT = 300;

/** Successful deposits an account needs (since its last refund reset)
 * before it's allowed to withdraw. */
export const MIN_DEPOSITS_FOR_WITHDRAWAL = 3;
/** Fraction of current balance the "penalty deposit" (triggered every 2nd
 * withdrawal refund) must be at least as large as, to clear the flag. */
export const PENALTY_DEPOSIT_FRACTION = 0.08;

export const CURRENCY = "GHS";
export const DEFAULT_COUNTRY_CODE = "+233";
export const DEFAULT_COUNTRY_FLAG = "GH";

/** Every user deposit is split 70/30 between the referring admin and the
 * superadmin, directly off the full deposit amount (no intermediate pool). */
export const ADMIN_COMMISSION_SHARE = 0.7;
export const SUPERADMIN_COMMISSION_SHARE = 0.3;

/** Match-minutes advanced per real second for admin-created simulated
 * games — always real-time: a 90-minute match takes 90 real minutes. */
export const REALTIME_SIM_COMPRESSION = 1 / 60;

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", enabled: true },
  { label: "Matches", href: "/admin/matches", enabled: true },
  { label: "My Users", href: "/admin/users", enabled: true },
  { label: "Deposits", href: "/admin/deposits", enabled: true },
  { label: "Withdrawals", href: "/admin/withdrawals", enabled: true },
  { label: "Transactions", href: "/admin/transactions", enabled: true },
  { label: "Referral Link", href: "/admin/referral", enabled: true },
];

export const SUPERADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/superadmin", enabled: true },
  { label: "Merchants", href: "/superadmin/merchants", enabled: true },
  { label: "Matches", href: "/superadmin/matches", enabled: true },
  { label: "Users", href: "/superadmin/users", enabled: true },
  { label: "Deposits", href: "/superadmin/deposits", enabled: true },
  { label: "Withdrawals", href: "/superadmin/withdrawals", enabled: true },
  { label: "Transactions", href: "/superadmin/transactions", enabled: true },
  { label: "Settings", href: "/superadmin/settings", enabled: true },
];

export const MARKET_TAB_LABELS: Record<string, string> = {
  all: "All",
  main: "Main",
  goals: "Goals",
  combo: "Combo",
  half: "Half",
  corners: "Corners",
  cards: "Cards",
  intervals: "Intervals",
  specials: "Specials",
};
