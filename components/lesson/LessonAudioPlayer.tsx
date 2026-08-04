'use client';

import { useRef, useState } from 'react';
import { ChevronDown, FastForward, Pause, Play, Rewind, Volume2, VolumeX } from 'lucide-react';

interface LessonAudioPlayerProps {
  src: string;
  title?: string;
  transcript?: string;
  isDark?: boolean;
  accentColor?: string;
  className?: string;
  editorControls?: React.ReactNode;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function LessonAudioPlayer({ src, title, transcript, isDark = false, accentColor = '#10b981', className = '', editorControls }: LessonAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src) return null;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch { setFailed(true); }
    } else {
      audio.pause();
    }
  };

  const skip = (amount: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + amount));
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const changeVolume = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value;
    audio.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  const changeSpeed = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = value;
    setSpeed(value);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className={`lesson-audio-player ${className}`.trim()} data-theme={isDark ? 'dark' : 'light'} style={{ '--audio-accent': accentColor } as React.CSSProperties}>
      <style>{`
        .lesson-audio-player{--audio-surface:#f4f4f5;--audio-text:#27272a;--audio-muted:#71717a;--audio-track:#d4d4d8;--audio-buffer:#c4c4c8;display:flex;flex-direction:column;gap:7px;width:100%;max-width:560px;color:var(--audio-text);font-family:inherit}.lesson-audio-player[data-theme="dark"],.lesson-content.dark .lesson-audio-player{--audio-surface:rgba(255,255,255,.055);--audio-text:#f4f4f5;--audio-muted:#a1a1aa;--audio-track:#3f3f46;--audio-buffer:#52525b}.lesson-audio-player__surface{display:flex;align-items:center;gap:8px;padding:10px;border-radius:14px;background:var(--audio-surface)}.lesson-audio-player__icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;padding:0;border:0;border-radius:8px;color:var(--audio-muted);background:transparent;cursor:pointer}.lesson-audio-player__icon:hover{color:var(--audio-text);background:rgba(127,127,127,.09)}.lesson-audio-player__play{width:36px;height:36px;flex-basis:36px;border-radius:11px;color:#fff;background:var(--audio-accent)}.lesson-audio-player__play:hover{color:#fff;background:color-mix(in oklab,var(--audio-accent) 86%,#000)}.lesson-audio-player__main{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.lesson-audio-player__time{display:flex;justify-content:space-between;color:var(--audio-muted);font-size:9.5px;font-variant-numeric:tabular-nums}.lesson-audio-player__range{width:100%;height:4px;margin:0;appearance:none;border-radius:999px;outline:0;cursor:pointer}.lesson-audio-player__range::-webkit-slider-thumb{width:12px;height:12px;appearance:none;border:2px solid var(--audio-surface);border-radius:999px;background:var(--audio-accent);box-shadow:0 1px 4px rgba(0,0,0,.2)}.lesson-audio-player__range::-moz-range-thumb{width:10px;height:10px;border:2px solid var(--audio-surface);border-radius:999px;background:var(--audio-accent)}.lesson-audio-player__volume{display:flex;align-items:center;gap:1px}.lesson-audio-player__volume-range{width:54px}.lesson-audio-player__speed{height:27px;padding:0 4px;border:0;border-radius:7px;outline:0;color:var(--audio-muted);background:transparent;cursor:pointer;font:inherit;font-size:10px;font-weight:700}.lesson-audio-player__speed:hover{color:var(--audio-text);background:rgba(127,127,127,.09)}.lesson-audio-player__editor{display:inline-flex;align-items:center;gap:1px;padding-left:5px;border-left:1px solid rgba(127,127,127,.18)}.lesson-audio-player__caption{color:var(--audio-muted);font-size:12px;line-height:1.5}.lesson-audio-player__transcript-toggle{display:inline-flex;align-items:center;gap:5px;width:fit-content;padding:3px 0;border:0;color:var(--audio-muted);background:transparent;cursor:pointer;font:inherit;font-size:11px;font-weight:650}.lesson-audio-player__transcript-toggle:hover{color:var(--audio-text)}.lesson-audio-player__transcript-toggle svg{transition:transform .18s ease}.lesson-audio-player__transcript-toggle[data-open="true"] svg{transform:rotate(180deg)}.lesson-audio-player__transcript{padding:10px 12px;border-radius:10px;color:var(--audio-muted);background:var(--audio-surface);white-space:pre-wrap;font-size:12px;line-height:1.55}.lesson-audio-player__error{color:#dc2626;font-size:11px}.lesson-audio-player button:focus-visible,.lesson-audio-player select:focus-visible,.lesson-audio-player input:focus-visible{outline:2px solid var(--audio-accent)!important;outline-offset:2px}@media(hover:hover){.lesson-audio-player__editor{opacity:0;transition:opacity .15s ease}.lesson-audio-player:hover .lesson-audio-player__editor,.lesson-audio-player:focus-within .lesson-audio-player__editor{opacity:1}}@media(max-width:520px){.lesson-audio-player__surface{gap:5px;padding:8px}.lesson-audio-player__volume{display:none}.lesson-audio-player__icon{width:26px;height:26px;flex-basis:26px}.lesson-audio-player__play{width:34px;height:34px;flex-basis:34px}.lesson-audio-player__editor{padding-left:3px}}@media(prefers-reduced-motion:reduce){.lesson-audio-player__transcript-toggle svg{transition:none}}
      `}</style>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadStart={() => { setPlaying(false); setCurrent(0); setDuration(0); setBuffered(0); setFailed(false); }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onProgress={(event) => {
          const audio = event.currentTarget;
          if (audio.buffered.length) setBuffered(audio.buffered.end(audio.buffered.length - 1));
        }}
        onPlay={() => { setPlaying(true); setFailed(false); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div className="lesson-audio-player__surface">
        <button type="button" className="lesson-audio-player__icon lesson-audio-player__play" aria-label={playing ? 'Pause audio' : 'Play audio'} onClick={togglePlayback}>{playing ? <Pause width={16} height={16} fill="currentColor" /> : <Play width={16} height={16} fill="currentColor" />}</button>
        <button type="button" className="lesson-audio-player__icon" aria-label="Skip back 10 seconds" title="Back 10 seconds" onClick={() => skip(-10)}><Rewind width={15} height={15} /></button>
        <div className="lesson-audio-player__main">
          <input aria-label="Audio position" className="lesson-audio-player__range" type="range" min={0} max={duration || 0} step={0.1} value={Math.min(current, duration || 0)} onChange={(event) => seek(Number(event.target.value))} style={{ background: `linear-gradient(to right,var(--audio-accent) 0 ${progress}%,var(--audio-buffer) ${progress}% ${Math.max(progress, bufferedProgress)}%,var(--audio-track) ${Math.max(progress, bufferedProgress)}% 100%)` }} />
          <span className="lesson-audio-player__time"><span>{formatTime(current)}</span><span>-{formatTime(Math.max(0, duration - current))}</span></span>
        </div>
        <button type="button" className="lesson-audio-player__icon" aria-label="Skip forward 10 seconds" title="Forward 10 seconds" onClick={() => skip(10)}><FastForward width={15} height={15} /></button>
        <div className="lesson-audio-player__volume">
          <button type="button" className="lesson-audio-player__icon" aria-label={muted ? 'Unmute audio' : 'Mute audio'} onClick={toggleMute}>{muted || volume === 0 ? <VolumeX width={15} height={15} /> : <Volume2 width={15} height={15} />}</button>
          <input aria-label="Volume" className="lesson-audio-player__range lesson-audio-player__volume-range" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} style={{ background: `linear-gradient(to right,var(--audio-accent) 0 ${(muted ? 0 : volume) * 100}%,var(--audio-track) ${(muted ? 0 : volume) * 100}% 100%)` }} />
        </div>
        <select className="lesson-audio-player__speed" aria-label="Playback speed" value={speed} onChange={(event) => changeSpeed(Number(event.target.value))}>
          {[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}×</option>)}
        </select>
        {editorControls && <div className="lesson-audio-player__editor">{editorControls}</div>}
      </div>
      {title && <span className="lesson-audio-player__caption">{title}</span>}
      {transcript && (
        <>
          <button type="button" className="lesson-audio-player__transcript-toggle" data-open={transcriptOpen ? 'true' : 'false'} aria-expanded={transcriptOpen} onClick={() => setTranscriptOpen((open) => !open)}>Transcript <ChevronDown width={13} height={13} /></button>
          {transcriptOpen && <div className="lesson-audio-player__transcript">{transcript}</div>}
        </>
      )}
      {failed && <span className="lesson-audio-player__error">This audio could not be played. Check the source and try again.</span>}
    </div>
  );
}
