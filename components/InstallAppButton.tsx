'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { useC } from '@/lib/theme';
import { useTenant } from '@/components/TenantProvider';
import { useImmersive } from '@/lib/immersive';

// The browser's install event is not in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';

// Dismissible install banner. Shows only when the app is actually installable and
// not already installed:
//   - Android / desktop Chrome+Edge: captures beforeinstallprompt and triggers the
//     native install dialog on tap.
//   - iOS Safari (no such event): shows the manual Add-to-Home-Screen hint.
// Layout is fluid -- a near-full-width bottom banner on phones, a compact centered
// pill on desktop (capped width). Dismissal is remembered per browser so it never nags.
export default function InstallAppButton() {
  const C = useC();
  const { appName } = useTenant();
  const immersive = useImmersive();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed (launched from home screen / app window) -> never show.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* private mode */ }
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's default mini-infobar; we show our own
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => { setVisible(false); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari never fires beforeinstallprompt -> offer the manual hint instead.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    // Client-only environment read after hydration (matches ThemeProvider's idiom).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos && isSafari) { setIosHint(true); setVisible(true); }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Hide while a chromeless full-screen surface (e.g. the certification exam) is active.
  if (!visible || immersive) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  const title = iosHint ? 'Install this app' : `Install ${appName || 'the app'}`;

  return (
    <div
      role="dialog"
      aria-label="Install app"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        zIndex: 60,
        width: 'min(400px, calc(100vw - 20px))',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 16,
        background: C.card,
        color: C.text,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        boxSizing: 'border-box',
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: C.pill,
          color: C.cta,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Download size={22} />
      </div>

      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        {iosHint ? (
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.35, marginTop: 1 }}>
            Tap <Share size={13} style={{ verticalAlign: -2 }} /> then <b>Add to Home Screen</b>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 1,
            }}
          >
            Add it to your home screen
          </div>
        )}
      </div>

      {!iosHint && (
        <button
          onClick={install}
          style={{
            flexShrink: 0,
            border: 0,
            cursor: 'pointer',
            background: C.cta,
            color: C.ctaText,
            fontSize: 14,
            fontWeight: 600,
            height: 40,
            padding: '0 16px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
          }}
        >
          Install
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          border: 0,
          background: 'transparent',
          color: C.muted,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 8,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
