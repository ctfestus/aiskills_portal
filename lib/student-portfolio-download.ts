'use client';

import { supabase } from '@/lib/supabase';

export async function downloadPortfolioPack() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const res = await fetch('/api/portfolio', { headers });
  if (!res.ok) throw new Error('Download failed');

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = 'portfolio-builder.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
