/** FAQs for /consultation (shown on the page and as FAQPage structured data). */
export type ConsultationFaq = { q: string; a: string };

export const CONSULTATION_FAQS: ConsultationFaq[] = [
  { q: "How does an online astrology consultation work?", a: "Fill the form with your birth details and your question. Our team calls you to confirm the time and the astrologer. The astrologer studies your birth chart and then talks to you over call, chat or video." },
  { q: "What details do I need to share?", a: "Your full name, date of birth, place of birth and, if you know it, the time of birth. Gender and marital status help the astrologer read your chart in the right context." },
  { q: "What if I don't know my exact birth time?", a: "You can still book. Leave the time empty. The astrologer can use other methods, such as your date and place of birth or prashna kundli, to guide you." },
  { q: "How soon will I get a call back?", a: "Usually within a few hours during working hours. Requests made late at night are called back the next morning." },
  { q: "Is my information kept private?", a: "Yes. Your birth details and everything you discuss are confidential. They are shared only with the astrologer handling your session and are never sold or published." },
  { q: "Can I choose the astrologer?", a: "Yes. Use \"Consult Now\" on an astrologer's card on the homepage, or tell our team on the call. If you have no preference, we match you with the right expert for your question." },
  { q: "Will I get remedies?", a: "Yes. Along with the reading, astrologers suggest practical remedies such as mantras, daan, fasting or gemstones only when they are really needed. There is no pressure to buy anything." },
  { q: "Can I consult for a family member?", a: "Yes. Fill the form with their birth details and mention in your question that the consultation is for them." },
];
