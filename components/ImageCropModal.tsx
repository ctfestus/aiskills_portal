'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface Props {
  src: string;
  aspect?: number;       // width/height -- default 1 (square)
  shape?: 'rect' | 'round';
  title?: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = new Image();
  img.src = imageSrc;
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
  const canvas = document.createElement('canvas');
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas toBlob failed')), 'image/jpeg', 0.92)
  );
}

export function ImageCropModal({ src, aspect = 1, shape = 'round', title = 'Crop image', onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(src, croppedArea);
      onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: '#1c1c1c', borderRadius: 20, width: '100%', maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>{title}</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Crop area */}
        <div style={{ position: 'relative', width: '100%', height: 320, background: '#111' }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={shape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controls */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Zoom slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#888', width: 36, flexShrink: 0 }}>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#ADEE66' }}
            />
            <span style={{ fontSize: 11, color: '#888', width: 32, textAlign: 'right', flexShrink: 0 }}>{zoom.toFixed(1)}×</span>
          </div>

          {/* Hint */}
          <p style={{ fontSize: 11, color: '#555', margin: 0 }}>Drag to reposition · Pinch or scroll to zoom</p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={onCancel}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              style={{ flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#ADEE66', border: 'none', color: '#111', opacity: processing ? 0.6 : 1 }}
            >
              {processing ? 'Applying…' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
