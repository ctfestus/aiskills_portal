'use client';
import { createContext, useContext } from 'react';
import { tenant } from '@/lib/tenant';
import type { TenantSettings } from '@/lib/get-tenant-settings';

const TenantContext = createContext<TenantSettings>(tenant);

export function TenantProvider({
  children,
  initialSettings,
}: {
  children: React.ReactNode;
  initialSettings: TenantSettings;
}) {
  return <TenantContext.Provider value={initialSettings}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
