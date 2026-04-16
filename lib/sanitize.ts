import DOMPurify from 'isomorphic-dompurify';

// Force all links to open in a new tab safely.
// Without rel="noopener noreferrer", a new tab can access window.opener
// and redirect the original tab (reverse tabnapping).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Strip HTML tags and null bytes from plain-text input fields. */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')   // strip any HTML tags
    .replace(/\0/g, '');       // remove null bytes
  // Note: do NOT trim here -- trimming on every keystroke prevents users from typing spaces
}

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li',
                   'h1', 'h2', 'h3', 'h4', 'blockquote', 'a', 'code', 'pre', 'hr', 'span',
                   'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'scope'],
    // Prevent javascript: and data: URIs in href
    ALLOW_DATA_ATTR: false,
  });
}
