/**
 * Blog seed data. Seeds the blog module's repository. The storefront no longer
 * reads this directly — it fetches via the API — but these articles bootstrap
 * the mock store so there is content on first run.
 *
 * The `Article` type now lives in `@/types`; it is re-exported here so older
 * imports (`import type { Article } from "@/data/articles"`) keep working.
 */

import type { Article, ArticleBlock } from "@/types";

export type { Article, ArticleBlock };

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const articles: Article[] = [
  {
    id: "art_choose",
    slug: "how-to-choose-your-gemstone",
    title: "How to Choose the Right Gemstone for You",
    excerpt:
      "Your birth chart, ruling planet and intention all matter. Here's a simple guide to picking a stone that truly works for you.",
    category: "Guide",
    readMins: 6,
    image:
      "https://images.unsplash.com/photo-1611425143678-08fc480cafde?auto=format&fit=crop&w=1600&q=85",
    author: "Pandit Astrounkle Sharma",
    authorRole: "Vedic Astrologer",
    date: "2026-09-28",
    tags: ["Gemstones", "Astrology", "Guide"],
    featured: true,
    status: "published",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
    body: [
      {
        type: "p",
        text: "Choosing a gemstone is not about picking the prettiest stone — it is about finding the one whose energy aligns with your birth chart and intentions. Worn correctly, the right gem can amplify the strengths of a benefic planet or soften the challenges of a difficult one.",
      },
      { type: "h2", text: "1. Start with your birth chart" },
      {
        type: "p",
        text: "Your janam kundli reveals which planets are strong, weak or afflicted. A gemstone is chosen to strengthen the planet that supports your goals — never blindly by zodiac sign alone.",
      },
      { type: "h2", text: "2. Match the stone to the planet" },
      {
        type: "list",
        items: [
          "Sun → Ruby (Manik) for confidence and leadership",
          "Moon → Pearl (Moti) for calm and emotional balance",
          "Jupiter → Yellow Sapphire (Pukhraj) for wisdom and fortune",
          "Saturn → Blue Sapphire (Neelam) for discipline and sudden gains",
        ],
      },
      { type: "h2", text: "3. Insist on certification" },
      {
        type: "p",
        text: "A genuine stone always comes with a lab certificate (IGI, GIA or GII). It confirms the gem is natural, untreated and of the stated carat weight — the foundation of its astrological value.",
      },
      {
        type: "quote",
        text: "A gemstone is a tool, not a shortcut. Pair it with the right intention and remedies for the best results.",
      },
      { type: "h2", text: "4. Consult before you wear" },
      {
        type: "p",
        text: "Especially for powerful stones like Blue Sapphire, a short consultation prevents mistakes. The right carat, metal, finger and muhurat make all the difference.",
      },
    ],
  },
  {
    id: "art_neelam",
    slug: "blue-sapphire-neelam-benefits",
    title: "Blue Sapphire (Neelam): Benefits & Who Should Wear It",
    excerpt:
      "The fastest-acting gem of Saturn can transform fortunes — but only when worn correctly. Everything you need to know.",
    category: "Astrology",
    readMins: 8,
    image:
      "https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=1600&q=85",
    author: "Pandit Astrounkle Sharma",
    authorRole: "Vedic Astrologer",
    date: "2026-09-20",
    tags: ["Blue Sapphire", "Saturn", "Benefits"],
    status: "published",
    createdAt: daysAgo(28),
    updatedAt: daysAgo(28),
    body: [
      {
        type: "p",
        text: "Blue Sapphire, or Neelam, is ruled by Saturn (Shani) and is famed as the fastest-acting gemstone in Vedic astrology. For the right wearer it can bring sudden wealth, focus and protection — but it demands respect.",
      },
      { type: "h2", text: "Key benefits" },
      {
        type: "list",
        items: [
          "Rapid financial and career growth",
          "Sharper focus, discipline and decision-making",
          "Protection from negativity and obstacles",
          "Relief from the effects of Shani sade-sati",
        ],
      },
      { type: "h2", text: "Who should wear it" },
      {
        type: "p",
        text: "Neelam suits those with Saturn as a yogakaraka or benefic in their chart — commonly Capricorn and Aquarius ascendants. Because it acts fast, a trial period and astrologer's advice are strongly recommended.",
      },
      {
        type: "quote",
        text: "If a stone suits you, you often feel its positive effect within days. If not, remove it immediately and consult.",
      },
      { type: "h2", text: "How to wear" },
      {
        type: "p",
        text: "Set an unheated, certified Neelam in silver or panchdhatu, worn on the middle finger on a Saturday evening after the proper mantra. Always start with a certified, natural stone.",
      },
    ],
  },
  {
    id: "art_natural_lab",
    slug: "natural-vs-lab-gemstones",
    title: "Natural vs Lab-Grown Gemstones: The Real Difference",
    excerpt:
      "Certification, pricing and astrological value — we break down what separates a natural stone from a synthetic one.",
    category: "Education",
    readMins: 5,
    image:
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=1600&q=85",
    author: "Astrounkle Gem Lab",
    authorRole: "Gemology Team",
    date: "2026-09-12",
    tags: ["Certification", "Natural", "Education"],
    status: "published",
    createdAt: daysAgo(36),
    updatedAt: daysAgo(36),
    body: [
      {
        type: "p",
        text: "Lab-grown gemstones share the same chemical makeup as natural ones, yet in astrology only naturally formed stones are believed to carry planetary energy. Here's what actually sets them apart.",
      },
      { type: "h2", text: "Formation" },
      {
        type: "p",
        text: "Natural gems form over millions of years inside the earth. Lab stones are created in weeks under controlled conditions — identical on paper, but without the natural origin astrology relies on.",
      },
      { type: "h2", text: "What to check before buying" },
      {
        type: "list",
        items: [
          "A certificate stating 'natural' origin",
          "Treatment disclosure (unheated is most valued)",
          "Carat weight and measurements",
          "A verifiable certificate number",
        ],
      },
      {
        type: "p",
        text: "At Astrounkle, every stone is natural, certified and energised before dispatch — so you never have to wonder.",
      },
    ],
  },
  {
    id: "art_pukhraj",
    slug: "yellow-sapphire-for-prosperity",
    title: "Yellow Sapphire (Pukhraj): The Gem of Jupiter",
    excerpt:
      "Wisdom, wealth and marital harmony — why Pukhraj is one of the most auspicious gemstones to wear.",
    category: "Astrology",
    readMins: 6,
    image:
      "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=1600&q=85",
    author: "Pandit Astrounkle Sharma",
    authorRole: "Vedic Astrologer",
    date: "2026-09-05",
    tags: ["Yellow Sapphire", "Jupiter", "Prosperity"],
    status: "published",
    createdAt: daysAgo(43),
    updatedAt: daysAgo(43),
    body: [
      {
        type: "p",
        text: "Yellow Sapphire, or Pukhraj, is the gemstone of Jupiter (Guru) — the planet of wisdom, expansion and good fortune. It is considered one of the safest and most benefic stones to wear.",
      },
      { type: "h2", text: "Benefits of Pukhraj" },
      {
        type: "list",
        items: [
          "Wealth and prosperity",
          "Wisdom and clarity of thought",
          "Marital harmony, especially for women",
          "Good fortune and new opportunities",
        ],
      },
      {
        type: "p",
        text: "Set in gold and worn on the index finger on a Thursday morning, Pukhraj is traditionally recommended for Sagittarius and Pisces ascendants.",
      },
    ],
  },
  {
    id: "art_care",
    slug: "caring-for-your-gemstones",
    title: "How to Care for Your Gemstones & Keep Them Energised",
    excerpt:
      "Simple cleansing and re-energising rituals to keep your stones radiant and effective for years.",
    category: "Guide",
    readMins: 4,
    image:
      "https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?auto=format&fit=crop&w=1600&q=85",
    author: "Astrounkle Gem Lab",
    authorRole: "Gemology Team",
    date: "2026-08-29",
    tags: ["Care", "Guide", "Rituals"],
    status: "published",
    createdAt: daysAgo(50),
    updatedAt: daysAgo(50),
    body: [
      {
        type: "p",
        text: "A gemstone is a lifelong companion. With a little care it stays brilliant and, many believe, spiritually active. Here are the essentials.",
      },
      { type: "h2", text: "Cleansing" },
      {
        type: "list",
        items: [
          "Rinse gently in clean water; avoid harsh chemicals",
          "Wipe with a soft, lint-free cloth",
          "Remove before swimming or heavy work",
        ],
      },
      { type: "h2", text: "Re-energising" },
      {
        type: "p",
        text: "On the planet's day, place the stone in raw milk or Ganga jal for a few minutes, chant its mantra, and wear it fresh. Many do this monthly to refresh the gem's energy.",
      },
    ],
  },
  {
    id: "art_rudraksha",
    slug: "rudraksha-benefits-guide",
    title: "Rudraksha Beads: Types, Benefits & How to Wear",
    excerpt:
      "From the 5 Mukhi for peace to rarer beads for specific goals — a beginner's guide to sacred Rudraksha.",
    category: "Spirituality",
    readMins: 7,
    image:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1600&q=85",
    author: "Pandit Astrounkle Sharma",
    authorRole: "Vedic Astrologer",
    date: "2026-08-18",
    tags: ["Rudraksha", "Spirituality", "Guide"],
    status: "published",
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
    body: [
      {
        type: "p",
        text: "Rudraksha beads, sacred to Lord Shiva, are worn for peace, protection and spiritual growth. Each 'mukhi' (face) carries a distinct energy.",
      },
      { type: "h2", text: "Popular types" },
      {
        type: "list",
        items: [
          "5 Mukhi — peace of mind, meditation (most common)",
          "1 Mukhi — highest spiritual awareness (rare)",
          "7 Mukhi — wealth and prosperity",
          "Gauri Shankar — harmony in relationships",
        ],
      },
      {
        type: "quote",
        text: "A genuine Rudraksha sinks in water and shows natural, well-defined faces (mukhis).",
      },
    ],
  },
];
