'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, ArrowRight, ArrowLeft, Check, Camera,
  Twitter, Linkedin, Instagram, Globe, Github, Youtube,
  ChevronDown, MapPin, User, Briefcase, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// -- Constants -----------------------------------------------------------------
const INDUSTRIES = [
  'Accounting & Finance', 'Advertising & Marketing', 'Aerospace & Defence',
  'Agriculture & Farming', 'Architecture & Urban Planning', 'Arts & Entertainment',
  'Automotive', 'Banking', 'Biotechnology', 'Broadcasting & Media',
  'Business Consulting', 'Chemical & Materials', 'Civic & Non-Profit',
  'Civil Engineering', 'Construction & Real Estate', 'Consumer Goods',
  'Cybersecurity', 'Data & Analytics', 'Design & Creative', 'E-Commerce',
  'Education & Training', 'Energy & Utilities', 'Environmental Services',
  'Events & Hospitality', 'Fashion & Apparel', 'Film & Production',
  'Financial Technology', 'Food & Beverage', 'Gaming & Esports',
  'Government & Public Sector', 'Healthcare & Medical', 'Human Resources',
  'Insurance', 'Interior Design', 'Internet of Things', 'Investment',
  'Law & Legal Services', 'Logistics & Supply Chain', 'Luxury Goods',
  'Manufacturing', 'Market Research', 'Mining & Resources', 'Music & Audio',
  'Oil & Gas', 'Pharmaceuticals', 'Photography & Videography',
  'Product Management', 'Public Relations', 'Publishing & Writing',
  'Recruitment & Staffing', 'Retail', 'Robotics & Automation',
  'SaaS & Software', 'Sales & Business Development', 'Science & Research',
  'Social Impact', 'Sports & Fitness', 'Telecommunications',
  'Tourism & Travel', 'Transportation', 'UX & Product Design',
  'Venture Capital & Private Equity', 'Web Development', 'Wellness & Beauty',
];

const SOCIAL_FIELDS = [
  { key: 'twitter',   label: 'X / Twitter', Icon: Twitter,   placeholder: 'https://x.com/username' },
  { key: 'linkedin',  label: 'LinkedIn',     Icon: Linkedin,  placeholder: 'https://linkedin.com/in/username' },
  { key: 'instagram', label: 'Instagram',    Icon: Instagram, placeholder: 'https://instagram.com/username' },
  { key: 'github',    label: 'GitHub',       Icon: Github,    placeholder: 'https://github.com/username' },
  { key: 'youtube',   label: 'YouTube',      Icon: Youtube,   placeholder: 'https://youtube.com/@channel' },
  { key: 'website',   label: 'Website',      Icon: Globe,     placeholder: 'https://yoursite.com' },
];

const STEPS = [
  { title: 'Who are you?',       subtitle: 'Set up your creator identity',        optional: false },
  { title: 'Your background',    subtitle: 'Help your audience know you better',   optional: true  },
  { title: 'Profile photo',      subtitle: 'Put a face to your name',              optional: true  },
  { title: 'Social links',       subtitle: 'Connect your platforms',               optional: true  },
];

// -- Logo ---------------------------------------------------------------------
function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-xl bg-[#006128] flex items-center justify-center">
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <rect x="3"  y="3"  width="6" height="6" rx="1.5" fill="#ADEE66" />
          <rect x="11" y="3"  width="6" height="6" rx="1.5" fill="#ADEE66" />
          <rect x="3"  y="11" width="6" height="6" rx="1.5" fill="#ADEE66" />
          <rect x="11" y="11" width="6" height="6" rx="1.5" fill="#ADEE66" fillOpacity="0.45" />
        </svg>
      </div>
      <span className="font-bold text-[#111] text-lg tracking-tight">FestForms</span>
    </div>
  );
}

// -- Industry dropdown ---------------------------------------------------------
function IndustrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const ref                   = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const filtered = INDUSTRIES.filter(i => i.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#e2e4e8] bg-[#f5f6f7] text-sm text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#006128]/10 focus:border-[#006128]/40"
      >
        <span className={value ? 'text-[#111]' : 'text-[#aaa]'}>{value || 'Select your industry'}</span>
        <ChevronDown className={`w-4 h-4 text-[#888] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 rounded-xl border border-[#e2e4e8] bg-white shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[#e2e4e8]">
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search industries…"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f5f6f7] border border-[#e2e4e8] outline-none placeholder-[#aaa] text-[#111]"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0
                ? <p className="text-xs text-[#888] text-center py-4">No match</p>
                : filtered.map(ind => (
                  <button key={ind} type="button"
                    onClick={() => { onChange(ind); setOpen(false); setQuery(''); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === ind ? 'bg-[#f0fdf4] text-[#006128] font-medium' : 'text-[#111] hover:bg-[#f5f6f7]'}`}
                  >{ind}</button>
                ))
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -- Main page -----------------------------------------------------------------
export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep]     = useState(0); // 0-indexed
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  // Step 1 — identity
  const [name, setName]               = useState('');
  const [username, setUsername]       = useState('');
  const [accountType, setAccountType] = useState<'creator' | 'company'>('creator');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');

  // Step 2 — background
  const [bio, setBio]           = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');

  // Step 3 — avatar
  const [avatarUrl, setAvatarUrl]         = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Step 4 — socials
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  // -- Init ------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/auth'); return; }

      const { data: p } = await supabase
        .from('profiles')
        .select('onboarding_completed, name, username, account_type, bio, industry, location, avatar_url, social_links')
        .eq('id', session.user.id)
        .single();

      if (p?.onboarding_completed) { router.replace('/dashboard'); return; }

      setUserId(session.user.id);
      if (p?.name)         setName(p.name);
      if (p?.username)     setUsername(p.username);
      if (p?.account_type) setAccountType(p.account_type);
      if (p?.bio)          setBio(p.bio);
      if (p?.industry)     setIndustry(p.industry);
      if (p?.location)     setLocation(p.location);
      if (p?.avatar_url)   setAvatarUrl(p.avatar_url);
      if (p?.social_links) setSocialLinks(p.social_links);

      setLoading(false);
    })();
  }, [router]);

  // -- Username check --------------------------------------------------------
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const checkUsername = useCallback(async (val: string) => {
    if (!val || val.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const { data } = await supabase
      .from('profiles').select('id').eq('username', val)
      .neq('id', userId).maybeSingle();
    setUsernameStatus(data ? 'taken' : 'available');
  }, [userId]);

  const onUsernameChange = (raw: string) => {
    const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(clean);
    setUsernameStatus('idle');
    clearTimeout(usernameTimer.current);
    if (clean.length >= 3) usernameTimer.current = setTimeout(() => checkUsername(clean), 500);
  };

  // -- Avatar upload ---------------------------------------------------------
  const handleAvatarFile = async (file: File) => {
    if (!file || !userId) return;
    setAvatarUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/avatar.${ext}`;
      await supabase.storage.from('form-assets').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('form-assets').getPublicUrl(path);
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch { /* ignore */ }
    setAvatarUploading(false);
  };

  // -- Navigation ------------------------------------------------------------
  const canProceed = () => {
    if (step === 0) return name.trim().length >= 2 && usernameStatus !== 'taken' && usernameStatus !== 'checking';
    return true;
  };

  const go = (delta: number) => {
    setDirection(delta);
    setError('');
    setStep(s => s + delta);
  };

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: rpcErr } = await supabase.rpc('update_own_profile', {
        p_name:                 name.trim() || null,
        p_username:             username.trim() || null,
        p_bio:                  bio.trim() || null,
        p_avatar_url:           avatarUrl || null,
        p_account_type:         accountType,
        p_industry:             industry || null,
        p_location:             location.trim() || null,
        p_social_links:         Object.keys(socialLinks).length ? socialLinks : null,
        p_onboarding_completed: true,
      });
      if (rpcErr) throw rpcErr;
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;

  // -- Loading ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#006128]" />
      </div>
    );
  }

  // -- Step content ----------------------------------------------------------
  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-[#e2e4e8] bg-[#f5f6f7] text-sm text-[#111] placeholder-[#aaa] outline-none focus:ring-2 focus:ring-[#006128]/10 focus:border-[#006128]/40 transition-all";
  const labelCls = "block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* -- Top bar --------------------------------------------------------- */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(0,0,0,0.06)]">
        <Logo />
        <span className="text-xs text-[#888] font-medium">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      {/* -- Progress bar --------------------------------------------------- */}
      <div className="h-0.5 bg-[#f0f0f0]">
        <motion.div
          className="h-full bg-[#006128]"
          animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>

      {/* -- Content -------------------------------------------------------- */}
      <div className="flex-1 flex items-start justify-center px-6 py-12 overflow-hidden">
        <div className="w-full max-w-md">

          {/* Step heading */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`head-${step}`}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="mb-8"
            >
              {/* Step dots */}
              <div className="flex items-center gap-1.5 mb-5">
                {STEPS.map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 h-2 bg-[#006128]' :
                    i < step   ? 'w-2 h-2 bg-[#ADEE66]' :
                                 'w-2 h-2 bg-[#e2e4e8]'
                  }`} />
                ))}
              </div>

              <h1 className="text-2xl font-bold text-[#111] mb-1">{STEPS[step].title}</h1>
              <p className="text-sm text-[#888]">{STEPS[step].subtitle}</p>
            </motion.div>
          </AnimatePresence>

          {/* Step body */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`body-${step}`}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-4"
            >

              {/* -- Step 0: Identity ------------------------------------- */}
              {step === 0 && (
                <>
                  {/* Account type */}
                  <div>
                    <label className={labelCls}>I am a</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['creator', 'company'] as const).map(type => (
                        <button key={type} type="button"
                          onClick={() => setAccountType(type)}
                          className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
                            accountType === type
                              ? 'border-[#006128] bg-[#f0fdf4] text-[#006128]'
                              : 'border-[#e2e4e8] bg-[#f5f6f7] text-[#555] hover:border-[#ccc]'
                          }`}
                        >
                          {type === 'creator' ? <User className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                          <span className="capitalize">{type}</span>
                          {accountType === type && <Check className="w-3.5 h-3.5 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className={labelCls}>Display name <span className="text-red-400 normal-case font-normal">required</span></label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={accountType === 'company' ? 'Your company name' : 'Your full name'}
                      className={inputCls}
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className={labelCls}>Username</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#aaa] select-none">@</span>
                      <input
                        value={username}
                        onChange={e => onUsernameChange(e.target.value)}
                        placeholder="yourhandle"
                        className={`${inputCls} pl-8 pr-10`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus === 'checking'   && <Loader2 className="w-4 h-4 animate-spin text-[#888]" />}
                        {usernameStatus === 'available'  && <Check className="w-4 h-4 text-[#006128]" />}
                        {usernameStatus === 'taken'      && <X className="w-4 h-4 text-red-500" />}
                      </div>
                    </div>
                    {usernameStatus === 'taken' && (
                      <p className="mt-1.5 text-xs text-red-500">This username is already taken.</p>
                    )}
                    {usernameStatus === 'available' && (
                      <p className="mt-1.5 text-xs text-[#006128]">Available!</p>
                    )}
                    <p className="mt-1.5 text-[11px] text-[#aaa]">Only lowercase letters, numbers, and underscores. Min 3 characters.</p>
                  </div>
                </>
              )}

              {/* -- Step 1: Background ----------------------------------- */}
              {step === 1 && (
                <>
                  <div>
                    <label className={labelCls}>Bio</label>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Tell people a little about yourself…"
                      rows={3}
                      maxLength={120}
                      className={`${inputCls} resize-none`}
                    />
                    <p className="mt-1 text-[11px] text-[#aaa] text-right">{bio.length}/120</p>
                  </div>

                  <div>
                    <label className={labelCls}>Industry</label>
                    <IndustrySelect value={industry} onChange={setIndustry} />
                  </div>

                  <div>
                    <label className={labelCls}>Location</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#aaa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="City, Country"
                        className={`${inputCls} pl-10`}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* -- Step 2: Avatar --------------------------------------- */}
              {step === 2 && (
                <div className="flex flex-col items-center py-4">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }}
                  />

                  {/* Avatar circle */}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-[#f5f6f7] flex items-center justify-center group transition-all hover:shadow-2xl"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-[#ccc]" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                      {avatarUploading
                        ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                        : <Camera className="w-6 h-6 text-white" />
                      }
                    </div>
                  </button>

                  <p className="mt-5 text-sm font-medium text-[#111]">
                    {avatarUrl ? 'Looking good!' : 'Upload a profile photo'}
                  </p>
                  <p className="mt-1 text-xs text-[#aaa] text-center max-w-xs">
                    Click the circle to upload. JPG, PNG or GIF. You can change this anytime in settings.
                  </p>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="mt-4 text-xs text-[#888] hover:text-red-500 transition-colors underline underline-offset-2"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              )}

              {/* -- Step 3: Socials -------------------------------------- */}
              {step === 3 && (
                <div className="space-y-3">
                  {SOCIAL_FIELDS.map(({ key, label, Icon, placeholder }) => (
                    <div key={key}>
                      <label className={labelCls}>{label}</label>
                      <div className="relative">
                        <Icon className="w-4 h-4 text-[#aaa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          value={socialLinks[key] ?? ''}
                          onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className={`${inputCls} pl-10`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* -- Error ---------------------------------------------------- */}
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
              >{error}</motion.p>
            )}
          </AnimatePresence>

          {/* -- Actions -------------------------------------------------- */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {/* Back */}
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-[#888] hover:text-[#111] hover:bg-[#f5f6f7] disabled:opacity-0 disabled:pointer-events-none transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-2">
              {/* Skip (optional steps only) */}
              {STEPS[step].optional && (
                <button
                  type="button"
                  onClick={() => isLastStep ? finish() : go(1)}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm text-[#888] hover:text-[#111] hover:bg-[#f5f6f7] transition-all"
                >
                  Skip
                </button>
              )}

              {/* Continue / Finish */}
              <button
                type="button"
                onClick={() => isLastStep ? finish() : go(1)}
                disabled={!canProceed() || saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 active:scale-[0.98]"
                style={{ background: '#ADEE66', color: '#004d1a' }}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : isLastStep ? (
                  <><Check className="w-4 h-4" /> Finish setup</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
