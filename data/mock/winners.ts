export interface Winner {
  id: string;
  amount: number;
  currency: string;
  category: string;
  maskedPhone: string;
  timeAgo: string;
}

export const winners: Winner[] = [
  { id: "w1",  amount: 13224.94, currency: "GHS", category: "Sports Betting", maskedPhone: "233*****936", timeAgo: "2m ago" },
  { id: "w2",  amount: 4780.50,  currency: "GHS", category: "Live Betting",   maskedPhone: "233*****412", timeAgo: "7m ago" },
  { id: "w3",  amount: 17450.00, currency: "GHS", category: "Sports Betting", maskedPhone: "233*****711", timeAgo: "15m ago" },
  { id: "w4",  amount: 3850.00,  currency: "GHS", category: "Sports Betting", maskedPhone: "233*****083", timeAgo: "22m ago" },
  { id: "w5",  amount: 8920.30,  currency: "GHS", category: "Live Betting",   maskedPhone: "233*****297", timeAgo: "34m ago" },
  { id: "w6",  amount: 5600.00,  currency: "GHS", category: "Sports Betting", maskedPhone: "233*****558", timeAgo: "41m ago" },
  { id: "w7",  amount: 19800.00, currency: "GHS", category: "Sports Betting", maskedPhone: "233*****174", timeAgo: "1h ago" },
  { id: "w8",  amount: 3120.75,  currency: "GHS", category: "Live Betting",   maskedPhone: "233*****809", timeAgo: "1h ago" },
  { id: "w9",  amount: 7450.60,  currency: "GHS", category: "Live Betting",   maskedPhone: "233*****362", timeAgo: "2h ago" },
  { id: "w10", amount: 15300.00, currency: "GHS", category: "Sports Betting", maskedPhone: "233*****645", timeAgo: "3h ago" },
  { id: "w11", amount: 6740.00,  currency: "GHS", category: "Sports Betting", maskedPhone: "233*****921", timeAgo: "3h ago" },
  { id: "w12", amount: 9875.45,  currency: "GHS", category: "Live Betting",   maskedPhone: "233*****037", timeAgo: "4h ago" },
  { id: "w13", amount: 4200.00,  currency: "GHS", category: "Sports Betting", maskedPhone: "233*****768", timeAgo: "5h ago" },
  { id: "w14", amount: 18340.00, currency: "GHS", category: "Sports Betting", maskedPhone: "233*****503", timeAgo: "5h ago" },
  { id: "w15", amount: 11650.75, currency: "GHS", category: "Live Betting",   maskedPhone: "233*****119", timeAgo: "6h ago" },
];
