// Shared export helpers for the dashboard (content, assignments, datasets).
// Extracted from app/dashboard/page.tsx so individual sections can import them
// once they are split into their own files.

import { supabase } from '@/lib/supabase';

export function downloadJSON(data: any, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportContent(form: any) {
  downloadJSON({
    exportVersion: 1,
    type: form.content_type,
    title: form.title,
    exportedAt: new Date().toISOString(),
    config: form.config,
  }, form.title);
}

export async function exportAssignment(a: any) {
  const { data: resources } = await supabase
    .from('assignment_resources')
    .select('name, url, resource_type')
    .eq('assignment_id', a.id);
  downloadJSON({
    exportVersion: 1,
    type: 'assignment',
    title: a.title,
    exportedAt: new Date().toISOString(),
    data: {
      title: a.title,
      scenario: a.scenario ?? null,
      brief: a.brief ?? null,
      tasks: a.tasks ?? null,
      requirements: a.requirements ?? null,
      submission_instructions: a.submission_instructions ?? null,
      cover_image: a.cover_image ?? null,
      type: a.type ?? null,
      config: a.config ?? null,
    },
    resources: (resources ?? []).map((r: any) => ({ name: r.name, url: r.url, resource_type: r.resource_type })),
  }, a.title);
}

export async function exportAllInSection(forms: any[], contentType: string, label: string) {
  const items = forms
    .filter(f => f.content_type === contentType)
    .map(f => ({
      exportVersion: 1,
      type: f.content_type,
      title: f.title,
      exportedAt: new Date().toISOString(),
      config: f.config,
    }));
  downloadJSON({ exportVersion: 1, bulkExport: true, exportedAt: new Date().toISOString(), items }, label);
}

export async function exportAllAssignments(assignments: any[], label: string) {
  if (!assignments.length) return;
  const ids = assignments.map(a => a.id);
  const { data: allResources } = await supabase
    .from('assignment_resources')
    .select('assignment_id, name, url, resource_type')
    .in('assignment_id', ids);
  const byId: Record<string, any[]> = {};
  for (const r of (allResources ?? [])) {
    if (!byId[r.assignment_id]) byId[r.assignment_id] = [];
    byId[r.assignment_id].push({ name: r.name, url: r.url, resource_type: r.resource_type });
  }
  const items = assignments.map(a => ({
    exportVersion: 1,
    type: 'assignment',
    title: a.title,
    exportedAt: new Date().toISOString(),
    data: {
      title: a.title,
      scenario: a.scenario ?? null,
      brief: a.brief ?? null,
      tasks: a.tasks ?? null,
      requirements: a.requirements ?? null,
      submission_instructions: a.submission_instructions ?? null,
      cover_image: a.cover_image ?? null,
      type: a.type ?? null,
      config: a.config ?? null,
    },
    resources: byId[a.id] ?? [],
  }));
  downloadJSON({ exportVersion: 1, bulkExport: true, exportedAt: new Date().toISOString(), items }, label);
}

export function exportCSV(rows: any[], title: string) {
  const headers = ['Name', 'Email', 'Status', 'Score', 'Result', 'Submitted At'];
  const csvRows = rows.map(row => {
    const sub = row.sub;
    const status = sub?.status ?? 'Not Started';
    const score  = sub?.score != null ? sub.score : '';
    const result = sub?.score != null ? (sub.score >= 85 ? 'Passed' : 'Failed') : '';
    const date   = sub?.updated_at ? new Date(sub.updated_at).toLocaleDateString() : '';
    return [row.full_name || '', row.email || '', status, score, result, date]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${title.replace(/\s+/g, '_')}_responses.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function exportGroupCSV(rows: any[], title: string) {
  const headers = ['Group', 'Leader', 'Members', 'Participants', 'Status', 'Score', 'Result', 'Submitted By', 'Submitted At'];
  const csvRows = rows.map(row => {
    const sub = row.sub;
    const status = sub?.status ?? 'Not Started';
    const score  = sub?.score != null ? sub.score : '';
    const result = sub?.score != null ? (sub.score >= 85 ? 'Passed' : 'Failed') : '';
    const date   = sub?.updated_at ? new Date(sub.updated_at).toLocaleDateString() : '';
    return [
      row.name || '',
      row.leader?.full_name || row.leader?.email || '',
      row.members.length,
      sub ? `${row.participants.length}/${row.members.length}` : '',
      status,
      score,
      result,
      sub?.submitted_by_student?.full_name || sub?.student?.full_name || '',
      date,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${title.replace(/\s+/g, '_')}_group_responses.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function reportExportCSV(headers: string[], rows: (string | number | null | undefined)[][], filename: string) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
