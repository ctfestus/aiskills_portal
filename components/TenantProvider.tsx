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
          teamName:     d.team_name     || tenant.teamName,
          senderName:   d.sender_name   || tenant.senderName,
          supportEmail: d.support_email || tenant.supportEmail,
          brandColor:   d.brand_color   || tenant.brandColor,
        });
      })
      .catch(() => {});
  }, []);

  return <TenantContext.Provider value={settings}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
