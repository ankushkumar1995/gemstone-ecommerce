/**
 * FAQ content — plain data (no "use client") so it can be imported by both
 * client view components and server components (pages that build FAQ JSON-LD).
 */

export interface Faq {
  q: string;
  a: string;
}

export const gemstoneFaqs: Faq[] = [
  {
    q: "Are your gemstones natural and certified?",
    a: "Yes. Every gemstone we sell is 100% natural and untreated unless explicitly stated. Each stone ships with a certificate from a recognised lab such as IGI, GIA or GII, which you can independently verify online.",
  },
  {
    q: "How do I know which gemstone is right for me?",
    a: "You can shop by your zodiac sign or ruling planet, or book a free consultation with our in-house Vedic astrologers. They assess your birth chart and recommend the most suitable stone and carat weight.",
  },
  {
    q: "What is gemstone energisation (prana pratishtha)?",
    a: "Before dispatch, learned pandits perform a traditional abhimantran ritual to activate the gemstone's astrological energy. This complimentary service is included with every order.",
  },
  {
    q: "What is your return and buyback policy?",
    a: "We offer a 7-day easy return on unused, certified stones in original condition. We also provide lifetime buyback on certified gemstones at prevailing market value.",
  },
  {
    q: "How long does delivery take?",
    a: "Orders are dispatched within 2–4 business days after certification and energisation. Delivery across India typically takes 3–7 business days with fully insured, tracked shipping.",
  },
  {
    q: "Is shipping free?",
    a: "Shipping is free and fully insured on all orders above ₹5,000. For orders below that, a nominal insured-shipping fee of ₹199 applies.",
  },
  {
    q: "Can I wear any gemstone without consultation?",
    a: "Certain powerful stones (like Blue Sapphire / Neelam) are best worn after astrological guidance. We strongly recommend a quick free consultation before purchasing high-impact stones.",
  },
];

export const kundliFaqs: Faq[] = [
  { q: "Is the free kundli really free?", a: "Yes. Your Janam Kundli with Lagna, Moon sign, Nakshatra and all nine planetary positions is generated instantly and completely free — no sign-up required." },
  { q: "How accurate is the online kundli?", a: "Planetary positions are computed with high-precision astronomy using the Lahiri ayanamsa — the standard for Vedic astrology. The Ascendant (Lagna) depends on your exact birth time, so an accurate time gives the most precise chart." },
  { q: "What if I don't know my exact birth time?", a: "You can still generate a kundli — we use noon as a default. For an accurate Ascendant and house analysis, an exact birth time is recommended, or our astrologers can do birth-time rectification." },
  { q: "What is the difference between Sun sign and Moon sign?", a: "Western astrology uses the Sun sign, but Vedic astrology treats the Moon sign (Rashi) and its Nakshatra as the core of the chart — governing your mind, emotions and life-timing periods (Dasha)." },
  { q: "Which gemstone should I wear according to my kundli?", a: "It depends on your Lagna and the strength of planets in your chart. After generating your kundli, book a free consultation and our astrologers will recommend a certified, energised gemstone matched to you." },
];

export const matchingFaqs: Faq[] = [
  { q: "What is Kundli Matching (Gun Milan)?", a: "Kundli Matching, or Ashtakoot Gun Milan, is the Vedic method of checking marriage compatibility by comparing the Moon's Nakshatra and Rashi of both partners across eight kootas, scored out of 36 gunas." },
  { q: "How many gunas are considered a good match?", a: "A total of 18 or more gunas out of 36 is traditionally acceptable, and 28+ is excellent. A lower score doesn't necessarily rule out marriage — many doshas have remedies." },
  { q: "What is Nadi dosha and Bhakoot dosha?", a: "Nadi dosha occurs when both partners share the same Nadi (0 of 8 points) and Bhakoot dosha arises from certain Moon-sign distances (0 of 7 points). Both can usually be remedied; an astrologer's review is advised." },
  { q: "Is Manglik dosha checked here?", a: "This free tool computes the 36-guna Ashtakoot score. A full Manglik (Mangal dosha) analysis requires the complete chart — book a consultation for a detailed matchmaking report." },
  { q: "Do I need exact birth times for matching?", a: "Gun Milan is based on the Moon's Nakshatra, which needs the date, time and place of birth for both partners. More accurate times give a more reliable result." },
];

export const moonSignFaqs: Faq[] = [
  { q: "What is the difference between Moon sign and Sun sign?", a: "Your Sun sign (used in Western astrology) is where the Sun was at birth. Your Moon sign (Rashi), central to Vedic astrology, is where the Moon was — it governs your mind, emotions and the timing of life events." },
  { q: "How do I find my Moon sign?", a: "Enter your date, time and place of birth. We compute the sidereal (Lahiri) position of the Moon to give your exact Rashi and Nakshatra instantly." },
  { q: "Why is the Moon sign important in Vedic astrology?", a: "Daily rashifal, kundli matching and gemstone recommendations are all based on the Moon sign, making it the most practical sign to know." },
];

export const gemstoneFaqsTool: Faq[] = [
  { q: "How is my gemstone decided?", a: "We analyse your Ascendant (Lagna) lord for your life stone and your Moon-sign lord for your lucky stone — the two gemstones most commonly recommended in Vedic astrology." },
  { q: "Can I wear any gemstone I like?", a: "Powerful stones like Blue Sapphire (Neelam) should be worn only after astrological advice, as they act fast. We recommend a quick free consultation before wearing a new high-impact stone." },
  { q: "Are your gemstones certified?", a: "Yes — every Astrounkle gemstone is 100% natural, lab-certified (IGI/GIA/GII) and energised before dispatch." },
];

export const doshaFaqs: Faq[] = [
  { q: "What is Manglik dosha?", a: "Manglik (Mangal) dosha forms when Mars occupies certain houses from the Ascendant or Moon. It's mainly considered during marriage matching and often has remedies or cancellations (bhanga)." },
  { q: "Is Kaal Sarp dosha dangerous?", a: "No. Kaal Sarp dosha (all planets between Rahu and Ketu) can bring ups and downs, but its intensity varies and it has well-known remedies like puja and mantra." },
  { q: "What is Sade Sati?", a: "Sade Sati is the ~7.5-year period when Saturn transits the 12th, 1st and 2nd signs from your Moon. With discipline and the right remedies it becomes a period of growth." },
  { q: "Do doshas mean I can't marry or succeed?", a: "Not at all. A dosha highlights an area needing care and timing. Most are remediable, and an astrologer can tell you exactly what applies to you." },
];

export const rudrakshaFaqs: Faq[] = [
  { q: "Which Rudraksha should I wear?", a: "It depends on your Ascendant lord. Our tool recommends the mukhi linked to that planet; the 5 Mukhi is the most popular and universally wearable." },
  { q: "How do I wear a Rudraksha?", a: "A genuine Rudraksha should be cleansed and energised with the appropriate mantra before wearing. Our astrologers can guide the process." },
];

export const pitraDoshFaqs: Faq[] = [
  { q: "What is Pitra Dosha?", a: "Pitra Dosha is an astrological condition tied to unresolved ancestral karma, usually when the Sun or Moon is afflicted by Rahu/Ketu or the 9th house is afflicted. It can bring obstacles in career, marriage or childbirth." },
  { q: "How do I remove Pitra Dosha?", a: "Common remedies are Shraddh and Tarpan during Pitru Paksha, Pind Daan at holy sites, charity and specific pujas. The right remedy depends on how the dosha forms in your chart." },
  { q: "Is Pitra Dosha permanent?", a: "No. It indicates an area needing attention and is eased with sincere remedies and good karma. An astrologer can assess its strength and guide you." },
];

export const loveCalcFaqs: Faq[] = [
  { q: "Is the love calculator accurate?", a: "It's a fun, name-based tool (including the classic FLAMES game), not real astrology. For genuine compatibility, use Kundli Matching with both birth charts." },
  { q: "What does FLAMES mean?", a: "FLAMES stands for Friends, Lovers, Affectionate, Marriage, Enemies and Siblings — a nostalgic game that gives a playful relationship label from two names." },
];

export const luckyDatesFaqs: Faq[] = [
  { q: "What is Mulank and Bhagyank?", a: "Mulank (root number) is the single digit of your birth date; Bhagyank (destiny number) is derived from your full date of birth. Both are core to Vedic numerology." },
  { q: "How are lucky dates calculated?", a: "Lucky dates are the days of the month whose digit-sum matches your Mulank or Bhagyank — considered favourable for important activities." },
  { q: "Can numerology pick a wedding or launch date?", a: "Yes, numerology is often used to choose auspicious dates. For the most precise muhurat, combine it with your birth chart in a consultation." },
];

export const askAstrologerFaqs: Faq[] = [
  { q: "How will I receive my answer?", a: "Your personalised written answer is sent to you via WhatsApp and email, usually within 24 hours of submission." },
  { q: "Can I ask a follow-up question?", a: "Each answer covers your submitted question in full. For deeper guidance, you can purchase an additional question pack or book a call." },
  { q: "How accurate are the answers?", a: "Answers are prepared by senior astrologers after a careful study of your birth chart. Astrology offers guidance, not guarantees." },
  { q: "What if I don't know my exact birth time?", a: "Share your best estimate. Our astrologers can still work with approximate details, though a precise time improves accuracy." },
  { q: "Is my information kept private?", a: "Absolutely. Your birth details and questions are strictly confidential and never shared with anyone." },
  { q: "Can I get a refund?", a: "Because each answer is prepared manually by an expert, we're unable to offer refunds once your question has been submitted." },
];
