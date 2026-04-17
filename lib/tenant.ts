export const tenant = {
  appName:         process.env.NEXT_PUBLIC_APP_NAME          ?? 'AI Skills Africa',
  orgName:         process.env.NEXT_PUBLIC_ORG_NAME          ?? 'AI Skills Africa',
  appUrl:          process.env.NEXT_PUBLIC_APP_URL           ?? 'https://app.aiskillsafrica.com',
  logoUrl:         process.env.NEXT_PUBLIC_LOGO_URL          ?? 'https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/AI%20Skills%20Logo.svg',
  teamName:        process.env.NEXT_PUBLIC_TEAM_NAME         ?? 'The AI Skills Africa Team',
  senderName:      process.env.NEXT_PUBLIC_SENDER_NAME       ?? 'AI Skills Africa - Learning Experience Team',
  supportEmail:    process.env.NEXT_PUBLIC_SUPPORT_EMAIL     ?? 'support@app.aiskillsafrica.com',
  brandColor:      process.env.NEXT_PUBLIC_BRAND_COLOR       ?? '#006128',
  faviconUrl:      '/icon.png',
  emailBannerUrl:  process.env.NEXT_PUBLIC_EMAIL_BANNER_URL  ?? '',

  // Landing page branding
  primaryColor:    process.env.NEXT_PUBLIC_PRIMARY_COLOR     ?? '#0e09dd',
  accentColor:     process.env.NEXT_PUBLIC_ACCENT_COLOR      ?? '#ff9933',
  heroTitle:       process.env.NEXT_PUBLIC_HERO_TITLE        ?? 'Build the skills Africa',
  heroTitleAccent: process.env.NEXT_PUBLIC_HERO_TITLE_ACCENT ?? 'needs right now.',
  heroSubheadline: process.env.NEXT_PUBLIC_HERO_SUBHEADLINE  ?? 'Enrol in AI and data courses, attend live workshops, work through real industry projects, and earn certificates that employers in Africa and beyond recognise.',
  heroPrimaryCta:  process.env.NEXT_PUBLIC_HERO_PRIMARY_CTA  ?? 'Start learning free',
  footerTagline:   process.env.NEXT_PUBLIC_FOOTER_TAGLINE    ?? 'The AI and data skills platform built for African professionals. Learn, practise, and prove your skills.',
  statsEnrolled:   process.env.NEXT_PUBLIC_STATS_ENROLLED    ?? '10,000+',
  statsRating:     process.env.NEXT_PUBLIC_STATS_RATING      ?? '4.9',
};
