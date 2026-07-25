// Curated RSS/Atom sources for the news strip in the feed. These are
// operator-editable: add or remove feeds here. Only headline, excerpt, source
// name, and link are ever stored or shown — never the full article text — and
// every card links back to the original with attribution.
//
// Each entry must be a valid RSS 2.0 or Atom feed served over HTTPS.

export type NewsFeed = {
  name: string;         // human-readable source shown on the card
  url: string;          // the RSS/Atom endpoint
  sourceUrl?: string;   // the source homepage
  category?: string;    // coarse label for filtering/badging
};

export const NEWS_FEEDS: NewsFeed[] = [
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', sourceUrl: 'https://news.ycombinator.com', category: 'Tech' },
  { name: 'We Work Remotely', url: 'https://weworkremotely.com/remote-jobs.rss', sourceUrl: 'https://weworkremotely.com', category: 'Remote work' },
  { name: 'Lifehacker', url: 'https://lifehacker.com/rss', sourceUrl: 'https://lifehacker.com', category: 'Career' },
];

// Cap per feed so one busy source can't dominate the strip.
export const MAX_ITEMS_PER_FEED = 15;
