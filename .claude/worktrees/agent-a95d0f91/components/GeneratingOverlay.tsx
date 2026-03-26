'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Wand2, FileText, CheckCircle2, Check } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

type OverlayStep = {
  label: string;
  thresholdMs: number;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
};

const DEFAULT_STEPS: OverlayStep[] = [
  { label: 'Reading your request', thresholdMs: 0, Icon: Sparkles },
  { label: 'Planning the content', thresholdMs: 900, Icon: Wand2 },
  { label: 'Generating the draft', thresholdMs: 2600, Icon: FileText },
  { label: 'Polishing the result', thresholdMs: 5200, Icon: CheckCircle2 },
];

function getProgress(elapsedMs: number) {
  if (elapsedMs <= 1200) return 10 + (elapsedMs / 1200) * 18;
  if (elapsedMs <= 3200) return 28 + ((elapsedMs - 1200) / 2000) * 26;
  if (elapsedMs <= 7000) return 54 + ((elapsedMs - 3200) / 3800) * 24;
  return Math.min(94, 78 + ((elapsedMs - 7000) / 8000) * 16);
}

export default function GeneratingOverlay({
  visible,
  label,
  failed,
}: {
  visible: boolean;
  label?: string;
  failed?: boolean;
}) {
  const { theme } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const [completedLabel, setCompletedLabel] = useState('Your AI result is ready');
  const wasVisibleRef = useRef(false);
  const lastAnnouncedStepRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = async () => {
      try {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextCtor) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        audioUnlockedRef.current = audioContextRef.current.state === 'running';
      } catch {
        audioUnlockedRef.current = false;
      }
    };

    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach(eventName => {
      document.addEventListener(eventName, unlockAudio, { passive: true });
    });

    return () => {
      events.forEach(eventName => {
        document.removeEventListener(eventName, unlockAudio);
      });
    };
  }, []);

  const playStepCompleteSound = () => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx || !audioUnlockedRef.current || ctx.state !== 'running') return;
      const nowAt = ctx.currentTime;
      const notes = [740, 988];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = nowAt + index * 0.06;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch {
      // Ignore audio failures silently.
    }
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    let intervalId: number | null = null;
    const rafId = window.requestAnimationFrame(() => {
      const start = Date.now();
      setStartedAt(start);
      setNow(start);
      intervalId = window.setInterval(() => setNow(Date.now()), 160);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible && wasVisibleRef.current) {
      const toastLabel = label ? `${label.replace(/\.\.\.$/, '')} complete` : 'Your AI result is ready';
      const timeoutId = window.setTimeout(() => {
        if (!failed) {
          setCompletedLabel(toastLabel);
          setShowCompletionToast(true);
        }
        setStartedAt(null);
      }, 0);
      wasVisibleRef.current = false;
      return () => window.clearTimeout(timeoutId);
    }

    if (visible) {
      wasVisibleRef.current = true;
    }
  }, [label, visible, failed]);

  useEffect(() => {
    if (!showCompletionToast) return;
    const timeoutId = window.setTimeout(() => setShowCompletionToast(false), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [showCompletionToast]);

  const elapsedMs = visible && startedAt ? now - startedAt : 0;
  const steps = DEFAULT_STEPS;
  let activeStepIndex = 0;
  for (let index = 0; index < steps.length; index += 1) {
    if (elapsedMs >= steps[index].thresholdMs) activeStepIndex = index;
  }
  const activeStep = steps[activeStepIndex];
  const progress = getProgress(elapsedMs);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!visible) {
      lastAnnouncedStepRef.current = 0;
      return;
    }

    if (activeStepIndex > lastAnnouncedStepRef.current) {
      playStepCompleteSound();
      lastAnnouncedStepRef.current = activeStepIndex;
    }
  }, [activeStepIndex, visible]);

  const palette = isDark
    ? {
        backdrop: 'rgba(10,10,10,0.68)',
        panel: 'linear-gradient(180deg, rgba(19,19,19,0.98), rgba(10,10,10,0.98))',
        border: 'rgba(16,185,129,0.18)',
        text: '#f5f5f5',
        muted: '#9ca3af',
        track: 'rgba(255,255,255,0.08)',
        shadow: '0 30px 100px rgba(16,185,129,0.18)',
        progress: '#10b981',
        chipBg: 'rgba(16,185,129,0.14)',
        chipText: '#10b981',
        toastBg: 'rgba(12, 19, 16, 0.96)',
        toastBorder: 'rgba(16,185,129,0.22)',
        activeCard: 'rgba(16,185,129,0.1)',
        completedCard: 'rgba(255,255,255,0.02)',
        idleCard: 'rgba(255,255,255,0.03)',
        iconBg: 'rgba(255,255,255,0.05)',
      }
    : {
        backdrop: 'rgba(255,255,255,0.62)',
        panel: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(247,250,248,0.99))',
        border: 'rgba(16,185,129,0.16)',
        text: '#111111',
        muted: '#6b7280',
        track: 'rgba(0,0,0,0.08)',
        shadow: '0 24px 60px rgba(15,23,42,0.12), 0 10px 24px rgba(15,23,42,0.06)',
        progress: '#10b981',
        chipBg: 'rgba(16,185,129,0.1)',
        chipText: '#10b981',
        toastBg: 'rgba(255,255,255,0.96)',
        toastBorder: 'rgba(16,185,129,0.18)',
        activeCard: 'rgba(16,185,129,0.06)',
        completedCard: 'rgba(15,23,42,0.025)',
        idleCard: 'rgba(0,0,0,0.02)',
        iconBg: 'rgba(16,185,129,0.08)',
      };

  const ActiveIcon = activeStep.Icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="gen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9990] flex items-center justify-center px-4"
          style={{ background: palette.backdrop, backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="relative w-full max-w-md overflow-hidden rounded-[28px] border"
            style={{
              background: palette.panel,
              borderColor: palette.border,
              boxShadow: palette.shadow,
            }}
          >
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[28px]"
              style={{ boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.35)' }}
              animate={{
                boxShadow: [
                  'inset 0 0 0 1px rgba(16,185,129,0.22), 0 0 0 0 rgba(16,185,129,0)',
                  'inset 0 0 0 1px rgba(16,185,129,0.8), 0 0 28px 0 rgba(16,185,129,0.18)',
                  'inset 0 0 0 1px rgba(16,185,129,0.28), 0 0 0 0 rgba(16,185,129,0)',
                ],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div
              className="absolute inset-x-0 top-0 h-24"
              style={{
                background: isDark
                  ? 'radial-gradient(circle at top, rgba(16,185,129,0.18), transparent 68%)'
                  : 'radial-gradient(circle at top, rgba(16,185,129,0.12), transparent 68%)',
              }}
            />

            <div className="relative px-6 sm:px-7 py-6 sm:py-7 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase"
                    style={{ background: palette.chipBg, color: palette.chipText }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Working
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-tight" style={{ color: palette.text }}>
                      {label || 'Generating your content'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: palette.muted }}>
                      The draft is being built in stages, and the final step will stay here until the response is actually ready.
                    </p>
                  </div>
                </div>

                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background: palette.iconBg,
                    color: palette.chipText,
                  }}
                >
                  <ActiveIcon className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span style={{ color: palette.text }}>{activeStep.label}</span>
                  <span style={{ color: palette.muted }}>{Math.round(progress)}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: palette.track }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: palette.progress }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {steps.map((step, index) => {
                  const done = index < activeStepIndex;
                  const active = index === activeStepIndex;
                  const upcoming = index > activeStepIndex;
                  const StepIcon = step.Icon;
                  return (
                    <motion.div
                      key={step.label}
                      className="rounded-2xl border px-3 py-3"
                      animate={{
                        scale: active ? 1 : 0.985,
                        opacity: active ? 1 : done ? 0.56 : 0.66,
                      }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      style={{
                        borderColor: active
                          ? palette.chipText
                          : done
                            ? palette.border
                            : palette.border,
                        background: active
                          ? palette.activeCard
                          : done
                            ? palette.completedCard
                            : palette.idleCard,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StepIcon
                            className="w-4 h-4"
                            style={{
                              color: active ? palette.chipText : palette.muted,
                              opacity: done ? 0.6 : upcoming ? 0.72 : 1,
                            }}
                          />
                          <span
                            className="text-[11px] font-semibold"
                            style={{
                              color: active ? palette.chipText : palette.muted,
                              opacity: done ? 0.7 : upcoming ? 0.9 : 1,
                            }}
                          >
                            Step {index + 1}
                          </span>
                        </div>
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full border"
                          style={{
                            borderColor: active ? palette.chipText : done ? palette.border : palette.border,
                            background: active ? palette.chipBg : done ? 'transparent' : 'transparent',
                            color: active ? palette.chipText : done ? palette.muted : palette.muted,
                            opacity: done ? 0.7 : upcoming ? 0.8 : 1,
                          }}
                        >
                          {done ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-semibold">{index + 1}</span>}
                        </div>
                      </div>
                      <p
                        className="mt-2 text-xs leading-relaxed"
                        style={{
                          color: active ? palette.text : palette.muted,
                          opacity: done ? 0.82 : upcoming ? 0.92 : 1,
                        }}
                      >
                        {step.label}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showCompletionToast && (
        <motion.div
          key="gen-complete-toast"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed bottom-5 left-1/2 z-[9991] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
        >
          <div
            className="flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
            style={{
              background: palette.toastBg,
              borderColor: palette.toastBorder,
              backdropFilter: 'blur(14px)',
            }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: palette.chipBg, color: palette.chipText }}
            >
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: palette.text }}>
                Generation complete
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: palette.muted }}>
                {completedLabel}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
