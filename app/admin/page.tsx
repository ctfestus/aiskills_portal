'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Users, FileText, BarChart2, Award,
  Search, TrendingUp, AlertTriangle, LogOut,
  ChevronDown, ChevronUp, Settings2, Check,
  Sparkles, Mail, CalendarDays, BookOpen,
} from 'lucide-react';

interface Instructor {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  form_count: number;
  course_count: number;
  event_count: number;
  response_count: number;
}

interface Stats {
  instructors: number;
  forms: number;
  responses: number;
  certificates: number;
  responsesThisMonth: number;
}

interface PlanRow {
  plan: string;
  forms: number;
  events: number;
  courses: number;
  ai_generations: number;
  responses_per_form: number;
  emails: number;
}

const PLAN_META: Record<string, { label: string; accent: string; mutedAccent: string; heroBg: string }> = {
  free:     { label: 'Free',     accent: '#6b7280', mutedAccent: '#6b728020', heroBg: '#f9fafb' },
  pro:      { label: 'Pro',      accent: '#006128', mutedAccent: '#ADEE6640', heroBg: '#f0fdf4' },
  business: { label: 'Business', accent: '#7c3aed', mutedAccent: '#7c3aed20', heroBg: '#faf5ff' },
};

type FeatureDef = {
  key: keyof Omit<PlanRow, 'plan'>;
  label: string;
  type: 'numeric' | 'toggle';
  Icon: any;
  defaultLimit: number;
};

const FEATURE_DEFS: FeatureDef[] = [
  { key: 'forms',              label: 'Forms',            type: 'numeric', Icon: FileText,    defaultLimit: 2  },
  { key: 'events',             label: 'Events',           type: 'numeric', Icon: CalendarDays,defaultLimit: 2  },
  { key: 'responses_per_form', label: 'Responses / Form', type: 'numeric', Icon: BarChart2,   defaultLimit: 50 },
  { key: 'courses',            label: 'Courses',          type: 'toggle',  Icon: BookOpen,    defaultLimit: -1 },
  { key: 'ai_generations',     label: 'AI Generation',    type: 'toggle',  Icon: Sparkles,    defaultLimit: -1 },
  { key: 'emails',             label: 'Emails',           type: 'toggle',  Icon: Mail,        defaultLimit: -1 },
];

export default function AdminDashboard() {
  const [loading, setLoading]       = useState(true);
  const [authError, setAuthError]   = useState('');
  const [token, setToken]           = useState('');
  const [stats, setStats]           = useState<Stats | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [planConfig, setPlanConfig]   = useState<PlanRow[]>([]);
  const [planEdits, setPlanEdits]     = useState<Record<string, Partial<PlanRow>>>({});
  const [planSaving, setPlanSaving]   = useState<string | null>(null);
  const [planSaved, setPlanSaved]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/auth'; return; }

      const tok = session.access_token;

      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${tok}` },
      });

      if (res.status === 403) {
        setAuthError('Access denied. Admin only.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setStats(data);
      setToken(tok);
      await Promise.all([
        fetchInstructors(tok),
        fetch('/api/admin/plan-config', { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.ok ? r.json() : [])
          .then((rows: PlanRow[]) => { setPlanConfig(rows); setPlanEdits({}); }),
      ]);
      setLoading(false);
    });
  }, []);

  const fetchInstructors = useCallback(async (tok?: string) => {
    const res = await fetch('/api/admin?action=instructors', {
      headers: { Authorization: `Bearer ${tok ?? token}` },
    });
    const json = await res.json();
    if (res.ok) setInstructors(json);
  }, [token]);

  const savePlanConfig = async (plan: string) => {
    const edits = planEdits[plan];
    if (!edits || !Object.keys(edits).length) return;
    setPlanSaving(plan);
    try {
      const res = await fetch('/api/admin/plan-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, ...edits }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Failed to save');
        return;
      }
      setPlanConfig(prev => prev.map(row =>
        row.plan === plan ? { ...row, ...edits } : row
      ));
      setPlanEdits(prev => { const n = { ...prev }; delete n[plan]; return n; });
      setPlanSaved(plan);
      setTimeout(() => setPlanSaved(p => p === plan ? null : p), 2000);
    } finally {
      setPlanSaving(null);
    }
  };

  const filtered = instructors.filter(m =>
    !search ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const C = {
    page:'#EEEAE3', nav:'rgba(238,234,227,0.92)', navBorder:'rgba(0,0,0,0.07)',
    card:'white', cardBorder:'rgba(0,0,0,0.07)', cardShadow:'0 1px 4px rgba(0,0,0,0.06)',
    green:'#006128', lime:'#ADEE66', text:'#111', muted:'#555', faint:'#888',
    divider:'rgba(0,0,0,0.07)', pill:'#F4F1EB', input:'#F8F6F1',
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.page }}>
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.green }}/>
    </div>
  );

  if (authError) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.page }}>
      <div className="text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3"/>
        <p className="font-medium" style={{ color: C.text }}>{authError}</p>
        <a href="/dashboard" className="text-sm mt-2 block hover:opacity-60 transition-opacity" style={{ color: C.muted }}>Go to Dashboard</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-16" style={{ background: C.page }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{font-family:'Inter',sans-serif;}`}</style>

      <div className="fixed top-0 right-0 pointer-events-none" style={{ width:240,height:240,borderRadius:'50%',background:C.lime,transform:'translate(35%,-25%)',opacity:0.5,zIndex:0 }}/>

      <header className="sticky top-0 z-20 backdrop-blur-md border-b px-6 h-14 flex items-center justify-between"
        style={{ background: C.nav, borderColor: C.navBorder }}>
        <div className="flex items-center gap-2.5">
          <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/powered%20by%20FestMan%20(1).png" alt="AI Skills Africa" className="h-7 w-auto" />
          <div>
            <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: C.faint }}>AI Skills Africa</p>
            <h1 className="font-semibold text-sm leading-none" style={{ color: C.text }}>Admin Console</h1>
          </div>
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-60" style={{ color: C.muted }}>
          <LogOut className="w-4 h-4"/>
          <span className="hidden sm:block text-xs">Sign out</span>
        </button>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label:'Instructors',  value:stats.instructors,        icon:Users,      color:'#006128' },
              { label:'Forms',        value:stats.forms,              icon:FileText,   color:'#7c3aed' },
              { label:'Responses',    value:stats.responses,          icon:BarChart2,  color:'#059669' },
              { label:'Certificates', value:stats.certificates,       icon:Award,      color:'#d97706' },
              { label:'This Month',   value:stats.responsesThisMonth, icon:TrendingUp, color:'#dc2626' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4" style={{ background:C.card, border:`1px solid ${C.cardBorder}`, boxShadow:C.cardShadow }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color:C.faint }}>{s.label}</span>
                  <s.icon className="w-3.5 h-3.5" style={{ color:s.color }}/>
                </div>
                <span className="text-2xl font-bold" style={{ color:C.text }}>{s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Instructors */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color:C.faint }}>Instructors ({filtered.length})</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color:C.faint }}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="rounded-xl pl-8 pr-4 py-2 text-sm border outline-none w-48"
                style={{ background:C.input, border:`1px solid ${C.cardBorder}`, color:C.text }}/>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map(m => (
                <motion.div key={m.id} layout initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-4 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ background:C.card, border:`1px solid ${C.cardBorder}`, boxShadow:C.cardShadow }}>
                  <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: C.lime, color: C.green }}>
                      {(m.full_name || m.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color:C.text }}>{m.full_name || m.email?.split('@')[0] || 'Unnamed'}</p>
                      <p className="text-xs truncate" style={{ color:C.faint }}>{m.email}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-xs flex-shrink-0" style={{ color:C.faint }}>
                      <span>{m.form_count} forms</span>
                      <span>{m.response_count} responses</span>
                    </div>
                    {expandedId === m.id ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color:C.faint }}/> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color:C.faint }}/>}
                  </div>

                  <AnimatePresence>
                    {expandedId === m.id && (
                      <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }} transition={{ duration:0.2 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t pt-3" style={{ borderColor:C.divider }}>
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {[{label:'Forms',value:m.form_count},{label:'Courses',value:m.course_count},{label:'Events',value:m.event_count},{label:'Responses',value:m.response_count}].map(s => (
                              <div key={s.label} className="rounded-xl px-3 py-2 text-center" style={{ background:C.pill }}>
                                <p className="text-sm font-semibold" style={{ color:C.text }}>{s.value}</p>
                                <p className="text-[10px]" style={{ color:C.faint }}>{s.label}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px]" style={{ color:C.faint }}>Joined {new Date(m.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color:C.faint }}>{search ? 'No instructors match your search' : 'No instructors yet'}</div>
            )}
          </div>
        </section>

        {/* Plan Config */}
        {planConfig.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" style={{ color: C.faint }}/>
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.faint }}>Plan Limits</h2>
              </div>
              <span className="text-[10px]" style={{ color: C.faint }}>Toggle = on/off &nbsp;·&nbsp; ∞ = unlimited</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {planConfig.map(row => {
                const meta = PLAN_META[row.plan] ?? PLAN_META.free;
                const edits = planEdits[row.plan] || {};
                const merged = { ...row, ...edits } as PlanRow;
                const dirty = Object.keys(edits).length > 0;

                const update = (key: keyof Omit<PlanRow,'plan'>, val: number) =>
                  setPlanEdits(prev => ({ ...prev, [row.plan]: { ...prev[row.plan], [key]: val } }));

                return (
                  <div key={row.plan} className="rounded-2xl overflow-hidden flex flex-col"
                    style={{ background: C.card, border: `1px solid ${dirty ? meta.accent + '60' : C.cardBorder}`, boxShadow: C.cardShadow, transition: 'border-color 0.2s' }}>

                    <div className="px-5 pt-4 pb-3 flex items-center justify-between"
                      style={{ background: meta.heroBg, borderBottom: `1px solid ${C.divider}` }}>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: meta.accent }}>Plan</p>
                        <h3 className="text-base font-bold" style={{ color: C.text }}>{meta.label}</h3>
                      </div>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: meta.mutedAccent }}>
                        <span className="text-sm font-bold" style={{ color: meta.accent }}>{meta.label[0]}</span>
                      </div>
                    </div>

                    <div className="px-5 py-3 flex-1 space-y-1">
                      {FEATURE_DEFS.map((f, fi) => {
                        const val = merged[f.key];
                        const { Icon } = f;
                        return (
                          <div key={f.key} className="flex items-center justify-between py-2"
                            style={{ borderBottom: fi < FEATURE_DEFS.length - 1 ? `1px solid ${C.divider}` : undefined }}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                              <span className="text-xs font-medium" style={{ color: C.muted }}>{f.label}</span>
                            </div>
                            {f.type === 'toggle' ? (
                              <button onClick={() => update(f.key, val !== 0 ? 0 : -1)}
                                className="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors duration-200"
                                style={{ background: val !== 0 ? meta.accent : '#d1d5db' }}>
                                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                                  style={{ left: '2px', transform: val !== 0 ? 'translateX(20px)' : 'translateX(0)' }}/>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {val === -1 ? (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: meta.mutedAccent, color: meta.accent }}>∞</span>
                                ) : (
                                  <input type="number" value={val} min={0} step={1}
                                    onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) update(f.key, n); }}
                                    className="w-14 rounded-lg px-2 py-1 text-xs text-center border outline-none focus:ring-1 transition-colors"
                                    style={{ background: C.input, border: `1px solid ${C.cardBorder}`, color: C.text }}/>
                                )}
                                <button onClick={() => update(f.key, val === -1 ? f.defaultLimit : -1)}
                                  className="text-[10px] px-2 py-1 rounded-lg font-medium transition-colors"
                                  style={{ background: val === -1 ? '#fef3c7' : C.pill, color: val === -1 ? '#d97706' : C.faint }}>
                                  {val === -1 ? 'limit' : '∞'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-5 pb-4 pt-1">
                      <button onClick={() => savePlanConfig(row.plan)} disabled={!dirty || planSaving === row.plan}
                        className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
                        style={{
                          background: planSaved === row.plan ? '#f0fdf4' : dirty ? meta.accent : C.pill,
                          color: planSaved === row.plan ? '#16a34a' : dirty ? 'white' : C.faint,
                          cursor: !dirty ? 'default' : undefined,
                        }}>
                        {planSaving === row.plan ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto"/>
                          : planSaved === row.plan ? <><Check className="w-3.5 h-3.5 inline mr-1"/>Saved</>
                          : dirty ? 'Save changes' : 'No changes'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
