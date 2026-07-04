'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { useC } from '@/lib/theme';
import { useImmersive } from '@/lib/immersive';

// The browser's install event is not in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';

// Floating, dismissible "Install" prompt. Shows only when the app is actually
// installable and not already installed:
// - Android / desktop Chrome+Edge: captures the browser's beforeinstallprompt
// event and triggers the native install dialog on tap.
// - iOS Safari (no such event): shows the manual Add-to-Home-Screen hint.
// Dismissal is remembered per browser so it never nags.
export default function InstallAppButton() {
  const C = useC();
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

  return (
    <div
      role="dialog"
      aria-label="Install app"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 24px)',
        padding: '10px 12px 10px 16px',
        borderRadius: 14,
        background: C.card,
        color: C.text,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      }}
    >
      {iosHint ? (
        <span style={{ fontSize: 14, lineHeight: 1.45 }}>
          Install this app: tap <Share size={15} style={{ verticalAlign: -2 }} /> then{' '}
          <b>Add to Home Screen</b>
        </span>
      ) : (
        <>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Install the app for quick access</span>
          <button
            onClick={install}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 10,
              border: 0,
              cursor: 'pointer',
              background: C.cta,
              color: C.ctaText,
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={16} /> Install
          </button>
        </>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          display: 'inline-flex',
          border: 0,
          background: 'transparent',
          color: C.muted,
          cursor: 'pointer',
          padding: 4,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
