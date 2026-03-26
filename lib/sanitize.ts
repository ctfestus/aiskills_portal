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

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li',
                   'h1', 'h2', 'h3', 'h4', 'blockquote', 'a', 'code', 'pre', 'hr', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    // Prevent javascript: and data: URIs in href
    ALLOW_DATA_ATTR: false,
  });
}
