export const VE_SUBMISSION_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.zip,.py,.js,.ts,.sql,.html,.css';
export const VE_SUBMISSION_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED = new Set(VE_SUBMISSION_ACCEPT.split(','));

export function validateVeSubmissionFile(file: File): string | null {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!ALLOWED.has(ext)) return 'This file type is not supported. Upload a document, image, spreadsheet, presentation, code file, or ZIP archive.';
  if (file.size > VE_SUBMISSION_MAX_BYTES) return 'This file is larger than the 25 MB upload limit.';
  if (file.size === 0) return 'This file is empty. Choose a file that contains your work.';
  return null;
}

export function safeVeUploadName(name: string): string {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'submission';
}
