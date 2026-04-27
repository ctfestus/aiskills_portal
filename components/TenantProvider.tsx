'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { tenant } from '@/lib/tenant';

type TenantSettings = typeof tenant;

const TenantContext = createContext<TenantSettings>(tenant);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TenantSettings>(tenant);

  useEffect(() => {
    fetch('/api/platform-settings')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const d = json?.data;
        if (!d) return;
        setSettings({
          appName:      d.app_name      || tenant.appName,
          orgName:      d.org_name      || tenant.orgName,
          appUrl:       d.app_url       || tenant.appUrl,
          logoUrl:      d.logo_url      || tenant.logoUrl,
          logoDarkUrl:  d.logo_dark_url || tenant.logoDarkUrl,
          teamName:     d.team_name     || tenant.teamName,
          senderName:   d.sender_name   || tenant.senderName,
          supportEmail: d.support_email || tenant.supportEmail,
          brandColor:      d.brand_color      || tenant.brandColor,
          faviconUrl:      d.favicon_url      || tenant.faviconUrl,
          emailBannerUrl:  d.email_banner_url || tenant.emailBannerUrl,
          primaryColor:    d.primary_color    || tenant.primaryColor,
          accentColor:     d.accent_color     || tenant.accentColor,
          heroTitle:       d.hero_title       || tenant.heroTitle,
          heroTitleAccent: d.hero_title_accent || tenant.heroTitleAccent,
          heroSubheadline: d.hero_subheadline || tenant.heroSubheadline,
          heroPrimaryCta:  d.hero_primary_cta || tenant.heroPrimaryCta,
          footerTagline:   d.footer_tagline   || tenant.footerTagline,
          statsEnrolled:   d.stats_enrolled   || tenant.statsEnrolled,
          statsRating:     d.stats_rating     || tenant.statsRating,
        });
      })
      .catch(() => {});
  }, []);

  return <TenantContext.Provider value={settings}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
