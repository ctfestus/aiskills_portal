'use client';

// Text input/textarea for use inside TipTap node views (accordion/tab labels,
// knowledge-check fields).
//
// The field is UNCONTROLLED and only commits to the ProseMirror document on blur (or
// Enter, for single-line). Dispatching a transaction on every keystroke steals focus
// back to the editor, making the field feel untypable -- committing on blur keeps
// typing smooth. `key={value}` remounts the field if the value changes from outside
// (e.g. undo) so it stays in sync without per-keystroke state.

interface NodeTextInputProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  multiline?: boolean;
}

export function NodeTextInput({ value, onCommit, placeholder, className, onFocus, multiline }: NodeTextInputProps) {
  if (multiline) {
    return (
      <textarea
        key={value}
        className={className}
        defaultValue={value}
        placeholder={placeholder}
        rows={2}
        onFocus={onFocus}
        onBlur={(e) => { const v = e.target.value; if (v !== value) onCommit(v); }}
        onMouseDown={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <input
      key={value}
      className={className}
      defaultValue={value}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={(e) => { const v = e.target.value; if (v !== value) onCommit(v); }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}
