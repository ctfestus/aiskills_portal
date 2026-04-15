export const tenant = {
  appName:      process.env.NEXT_PUBLIC_APP_NAME     ?? 'AI Skills Africa',
  orgName:      process.env.NEXT_PUBLIC_ORG_NAME     ?? 'AI Skills Africa',
  appUrl:       process.env.NEXT_PUBLIC_APP_URL      ?? 'https://app.aiskillsafrica.com',
  logoUrl:      'https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/AI%20Skills%20Logo.svg',
  teamName:     process.env.NEXT_PUBLIC_TEAM_NAME    ?? 'The AI Skills Africa Team',
  senderName:   process.env.NEXT_PUBLIC_SENDER_NAME  ?? 'AI Skills Africa - Learning Experience Team',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@app.aiskillsafrica.com',
  brandColor:   process.env.NEXT_PUBLIC_BRAND_COLOR  ?? '#006128',
  faviconUrl:   '/icon.png',
};
