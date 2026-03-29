'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    // Start progress -- these setStates initialize animation state in response to a
    // navigation event and cannot be deferred; the synchronous call is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);

    let w = 0;
    timerRef.current = setInterval(() => {
      w += Math.random() * 12 + 4;
      if (w >= 90) { w = 90; clearInterval(timerRef.current!); }
      setWidth(w);
    }, 120);

    // Finish after a short delay
    const finish = setTimeout(() => {
      clearInterval(timerRef.current!);
      setWidth(100);
      setTimeout(() => setVisible(false), 300);
    }, 600);

    return () => {
      clearInterval(timerRef.current!);
      clearTimeout(finish);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 3,
        width: `${width}%`,
        background: 'linear-gradient(90deg, #1f1bc3, #00a4ef)',
        zIndex: 99999,
        transition: 'width 0.12s ease, opacity 0.3s ease',
        opacity: width === 100 ? 0 : 1,
        borderRadius: '0 2px 2px 0',
        boxShadow: '0 0 10px #00a4ef80',
      }}
    />
  );
}
