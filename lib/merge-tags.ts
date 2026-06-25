/**
 * Personalization merge tags for VE workplace emails. Authors drop one of these
 * tokens into a manager email body and we swap in the taker's real name at render
 * time, so the simulation greets each student personally and feels realistic.
 *
 *   {{name}} / {{student_name}} / {{full_name}}  -> full name
 *   {{first_name}}                               -> first name only
 *
 * Used by the two VE players (components/VirtualExperienceTaker.tsx and
 * components/AssignmentExperiencePlayer.tsx). Apply this BEFORE sanitizeEmailContent
 * so any markup in a name is cleaned by the sanitizer downstream.
 */

const FIRST_NAME_TAG = /\{\{\s*first_name\s*\}\}/gi;
const FULL_NAME_TAG = /\{\{\s*(?:student_name|full_name|name)\s*\}\}/gi;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Replace name tags in `html` with the student's name. When no name is on file the
 * tokens degrade to a neutral "there" so a greeting never reads as raw `{{...}}`.
 */
export function applyNameTags(html: string, studentName?: string | null): string {
  if (!html) return html;
  const full = (studentName || '').trim();
  const first = full ? full.split(/\s+/)[0] : '';
  return html
    .replace(FIRST_NAME_TAG, first ? escapeHtml(first) : 'there')
    .replace(FULL_NAME_TAG, full ? escapeHtml(full) : 'there');
}
