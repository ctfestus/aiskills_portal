'use client';

// SortableFieldCard (drag-sortable form-field editor row) + its FieldCardProps, extracted
// verbatim from app/create/page.tsx. inputStyle is local to the component.

import { motion, AnimatePresence } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import type { FormField } from '@/lib/course-schema';
import { useC } from '@/components/create/theme';
import { Toggle, FIELD_TYPE_LABELS, isRequired, inputCls, labelCls } from '@/components/create/shared';

interface FieldCardProps {
  f: FormField;
  isExpanded: boolean;
  toggleExpand: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
}

export function SortableFieldCard({ f, isExpanded, toggleExpand, onRemove, onUpdate, index = 0, accentColor }: FieldCardProps & { index?: number; accentColor?: string }) {
  const C = useC();
  const inputStyle = { background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text };
  const labelStyle = { color: C.faint };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1, borderRadius: 12, border: isDragging ? `2px dashed ${C.cardBorder}` : undefined };

  return (
    <motion.div
      ref={setNodeRef}
      style={{ ...style, background: C.card, border: `1px solid ${isExpanded ? 'rgba(0,0,0,0.15)' : C.cardBorder}`, boxShadow: C.cardShadow }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="group rounded-xl overflow-hidden transition-all"
    >
      {/* Top row: grip (drag handle) + label + delete + expand chevron */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 transition-colors"
          style={{ color: C.faint }}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={toggleExpand} className="flex-1 text-left min-w-0">
          <span className="text-sm font-medium truncate block" style={{ color: C.text }}>{f.label || <span className="italic" style={{ color: C.faint }}>Untitled</span>}</span>
          <span className="text-[10px]" style={{ color: C.faint }}>{FIELD_TYPE_LABELS[f.type]}</span>
        </button>
        <div className="flex items-center flex-shrink-0">
          <button onClick={onRemove} title="Remove" className="p-1 transition-colors opacity-0 group-hover:opacity-100 hover:text-red-400" style={{ color: C.faint }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={toggleExpand} className="p-1 transition-colors" style={{ color: C.faint }}>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
            style={{ borderTop: `1px solid ${C.divider}` }}
          >
            <div className="px-3 pt-3 pb-3 space-y-3">
              <div>
                <label className={labelCls} style={labelStyle}>{f.type === 'description' ? 'Heading (optional)' : 'Label'}</label>
                <input
                  type="text"
                  value={f.label}
                  onChange={e => onUpdate({ label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') || f.id })}
                  className={inputCls}
                  style={inputStyle}
                  placeholder={f.type === 'description' ? 'Section heading...' : 'Field label...'}
                />
              </div>
              {f.type === 'description' ? (
                <div>
                  <label className={labelCls}>Content</label>
                  <RichTextEditor
                    value={f.description ?? ''}
                    onChange={html => onUpdate({ description: html })}
                    placeholder="Write your description here..."
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls} style={labelStyle}>Helper text (optional)</label>
                    <RichTextEditor
                      value={f.description ?? ''}
                      onChange={html => onUpdate({ description: html || undefined })}
                      placeholder="Add helper text below the label..."
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className={`${labelCls} mb-0`}>Required</span>
                    <Toggle checked={isRequired(f)} onChange={() => onUpdate({ required: !isRequired(f) })} accentColor={accentColor} />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
