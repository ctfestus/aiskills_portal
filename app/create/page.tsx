'use client';

import { useState, useEffect, useRef } from 'react';
import { sanitizeRichText } from '@/lib/sanitize';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Loader2, CheckCircle2, ArrowRight, Check,
  Plus, Trash2, Image as ImageIcon, Sun, Moon,
  LayoutDashboard, Save, X, MapPin,
  ArrowUpRight, ChevronDown, ChevronUp,
  Building2, Share2, GripVertical,
  CalendarDays, HelpCircle, ClipboardList, Video, BookOpen, Search,
} from 'lucide-react';
import { AnimatedField, ThemeColor, ThemeMode } from '@/components/AnimatedField';
import dynamic from 'next/dynamic';
// CourseTaker is only shown in preview mode -- load it lazily to keep initial bundle small
const CourseTaker = dynamic(() => import('@/components/CourseTaker').then(m => ({ default: m.CourseTaker })), { ssr: false });
import GeneratingOverlay from '@/components/GeneratingOverlay';
import { RichTextEditor } from '@/components/RichTextEditor';
import { getFontById, loadGoogleFont } from '@/lib/fonts';
import { FontPickerModal } from '@/components/FontPickerModal';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
type FieldType = 'text' | 'email' | 'textarea' | 'number' | 'select' | 'phone' | 'company' | 'social' | 'description';

interface FormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  socialPlatforms?: string[];
  description?: string;
}

type QuestionType = 'multiple_choice' | 'fill_blank' | 'arrange' | 'image' | 'code';

interface CourseQuestion {
  id: string;
  type?: QuestionType;
  question: string;
  options: string[];          // MC: option text; arrange: items in correct order; fill_blank: []; image: ['0','1','2',...]
  correctAnswer: string;      // MC: option text; fill_blank: pipe-separated; arrange: options.join('|||'); image: index string
  explanation?: string;
  optionImages?: string[];    // image type only -- one base64 per option, same length as options
  hint?: string;
  codeSnippet?: string;
  codeLanguage?: string;
  lessonOnly?: boolean;
  isSection?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  lesson?: {
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
  };
}

interface Speaker {
  id: string;
  name: string;
  title?: string;
  bio?: string;
  avatar_url?: string;
  linkedin_url?: string;
}

interface EventDetails {
  isEvent: boolean;
  date?: string;
  time?: string;
  location?: string;
  timezone?: string;
  isPrivate?: boolean;
  capacity?: number;
  eventType?: 'in-person' | 'virtual';
  meetingLink?: string;
  speakers?: Speaker[];
}

interface PostSubmission {
  type: 'default' | 'redirect' | 'button' | 'events' | 'notice';
  redirectUrl?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  relatedEventIds?: string[];
  noticeTitle?: string;
  noticeBody?: string;
}

interface PointsMilestone {
  id: string;
  points: number;
  label: string;
  description: string;
  rewardUrl?: string;
}

interface PointsSystem {
  enabled: boolean;
  basePoints: number;
  timeBonusEnabled: boolean;
  timeBonusSeconds: number;
  timeBonusMultiplier: number;
  streakEnabled: boolean;
  streakCount: number;
  streakBonus: number;
  hintPenalty: number;
  milestones: PointsMilestone[];
}

interface FormConfig {
  title: string;
  description: string;
  coverImage: string;
  theme: ThemeColor;
  customAccent?: string;
  mode: ThemeMode;
  font: string;
  fields: FormField[];
  eventDetails?: EventDetails;
  isCourse?: boolean;
  questions?: CourseQuestion[];
  learnOutcomes?: string[];
  showAnswers?: 'per_question' | 'after_quiz' | 'none';
  lessonTiming?: 'before' | 'after';
  passmark?: number;
  courseTimer?: number;
  maxAttempts?: number;
  postSubmission?: PostSubmission;
  pointsSystem?: PointsSystem;
  deadline_days?: number | null;
}

// --- Constants ---
const buttonThemes: Record<ThemeColor, string> = {
  forest:  'bg-[#006128] hover:bg-[#004d1e] text-white',
  lime:    'bg-[#ADEE66] hover:bg-[#9ad94d] text-black',
  emerald: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  rose:    'bg-rose-500 hover:bg-rose-600 text-white',
  amber:   'bg-amber-500 hover:bg-amber-600 text-white',
};

const themeAccentColors: Record<ThemeColor, string> = {
  forest:  '#006128',
  lime:    '#ADEE66',
  emerald: '#10b981',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
};

const SOCIAL_PLATFORMS = [
  { id: 'linkedin',  name: 'LinkedIn',    placeholder: 'linkedin.com/in/username' },
  { id: 'twitter',   name: 'X (Twitter)', placeholder: 'x.com/username'           },
  { id: 'instagram', name: 'Instagram',   placeholder: 'instagram.com/username'   },
  { id: 'facebook',  name: 'Facebook',    placeholder: 'facebook.com/username'    },
  { id: 'tiktok',    name: 'TikTok',      placeholder: 'tiktok.com/@username'     },
  { id: 'youtube',   name: 'YouTube',     placeholder: 'youtube.com/@channel'     },
  { id: 'github',    name: 'GitHub',      placeholder: 'github.com/username'      },
  { id: 'website',   name: 'Website',     placeholder: 'https://yourwebsite.com' },
];

const SOCIAL_SVGS: Record<string, React.ReactNode> = {
  linkedin: (
    <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-full h-full">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="#1877F2" className="w-full h-full">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="#FF0000" className="w-full h-full">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
};

function SocialIcon({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="inline-flex flex-shrink-0">
      {SOCIAL_SVGS[id] ?? null}
    </span>
  );
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  email: 'Email',
  textarea: 'Long Text',
  number: 'Number',
  select: 'Dropdown',
  phone: 'Phone',
  company: 'Company',
  social: 'Social Profile',
  description: 'Description Block',
};

const EXAMPLE_PROMPTS = [
  'Event registration for a tech conference',
  'Customer feedback survey',
  'Job application form',
  'Course on world capitals',
];

const uid = () => Math.random().toString(36).slice(2, 9);

const TEMPLATES: { key: string; label: string; description: string; icon: React.ElementType; color: string; config: FormConfig }[] = [
  {
    key: 'event',
    label: 'Event Registration',
    description: 'Collect RSVPs with ticket type, dietary needs & more.',
    icon: CalendarDays,
    color: '#1f1bc3',
    config: {
      title: 'Event Registration',
      description: 'Join us for an unforgettable experience. Fill in your details below to secure your spot.',
      coverImage: '',
      theme: 'forest',
      mode: 'dark',
      font: 'sans',
      eventDetails: { isEvent: true, date: '', time: '', location: '', timezone: '' },
      fields: [
        { id: uid(), name: 'first_name', label: 'First Name', type: 'text', placeholder: 'Enter your first name...', required: true },
        { id: uid(), name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Enter your last name...', required: true },
        { id: uid(), name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com', required: true },
        { id: uid(), name: 'phone', label: 'Mobile Phone', type: 'phone', required: true },
        { id: uid(), name: 'ticket_type', label: 'Ticket Type', type: 'select', options: ['General Admission', 'VIP', 'Student'], required: true },
        { id: uid(), name: 'dietary', label: 'Dietary Requirements', type: 'select', options: ['None', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-Free'], required: false },
        { id: uid(), name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], required: false },
      ],
    },
  },
  {
    key: 'course',
    label: 'Course',
    description: 'Interactive course with scoring, timer & answer reveal.',
    icon: HelpCircle,
    color: '#ff9933',
    config: {
      title: 'Knowledge Course',
      description: 'Test your knowledge with this interactive course. Answer all questions and submit to see your results.',
      coverImage: '',
      theme: 'amber',
      mode: 'dark',
      font: 'sans',
      isCourse: true,
      fields: [],
      showAnswers: 'per_question',
      passmark: 50,
      questions: [
        { id: uid(), type: 'multiple_choice', question: 'What is your first question?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correctAnswer: 'Option A' },
      ],
    },
  },
  {
    key: 'survey',
    label: 'Survey',
    description: 'Gather feedback with rating scales and open questions.',
    icon: ClipboardList,
    color: '#10b981',
    config: {
      title: 'Customer Feedback Survey',
      description: 'We value your opinion. Help us improve by sharing your experience. It only takes 2 minutes.',
      coverImage: '',
      theme: 'emerald',
      mode: 'dark',
      font: 'sans',
      fields: [
        { id: uid(), name: 'first_name', label: 'First Name', type: 'text', placeholder: 'Enter your first name...', required: true },
        { id: uid(), name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com', required: false },
        { id: uid(), name: 'overall_rating', label: 'Overall Experience', type: 'select', options: ['⭐ Poor', '⭐⭐ Fair', '⭐⭐⭐ Good', '⭐⭐⭐⭐ Very Good', '⭐⭐⭐⭐⭐ Excellent'], required: true },
        { id: uid(), name: 'what_liked', label: 'What did you like most?', type: 'textarea', placeholder: 'Tell us what stood out...', required: false },
        { id: uid(), name: 'improvements', label: 'What could we improve?', type: 'textarea', placeholder: 'Your suggestions help us grow...', required: false },
        { id: uid(), name: 'recommend', label: 'Would you recommend us?', type: 'select', options: ['Definitely Yes', 'Probably Yes', 'Not Sure', 'Probably Not', 'Definitely Not'], required: true },
      ],
    },
  },
  {
    key: 'webinar',
    label: 'Webinar',
    description: 'Register attendees for your online session or live stream.',
    icon: Video,
    color: '#00a4ef',
    config: {
      title: 'Webinar Registration',
      description: 'Reserve your spot for our upcoming online session. We look forward to seeing you there.',
      coverImage: '',
      theme: 'forest',
      mode: 'dark',
      font: 'sans',
      eventDetails: { isEvent: true, date: '', time: '', location: '', timezone: '' },
      fields: [
        { id: uid(), name: 'first_name', label: 'First Name', type: 'text', placeholder: 'Enter your first name...', required: true },
        { id: uid(), name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Enter your last name...', required: true },
        { id: uid(), name: 'email', label: 'Email Address', type: 'email', placeholder: 'work@company.com', required: true },
        { id: uid(), name: 'company', label: 'Company', type: 'company', required: false },
        { id: uid(), name: 'job_title', label: 'Job Title', type: 'text', placeholder: 'e.g. Marketing Manager', required: false },
        { id: uid(), name: 'heard_from', label: 'How did you hear about this?', type: 'select', options: ['Social Media', 'Email Newsletter', 'Colleague', 'Search Engine', 'Other'], required: false },
      ],
    },
  },
];

// --- Helpers ---
const formatDateParts = (dateString?: string) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return {
      monthShort: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.toLocaleDateString('en-US', { day: 'numeric' }),
      fullDate: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    };
  } catch { return null; }
};

const formatLocation = (locationString?: string) => {
  if (!locationString) return { main: '', sub: '' };
  const parts = locationString.split(',');
  return parts.length > 1
    ? { main: parts[0].trim(), sub: parts.slice(1).join(',').trim() }
    : { main: locationString, sub: '' };
};

const isRequired = (f: FormField) => f.required !== false;

const parseJsonResponse = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'AI request failed');
  return data;
};

const normalizeGeneratedQuestion = (question: any): CourseQuestion => ({
  id: question?.id || Math.random().toString(36).slice(2, 9),
  type: question?.type || 'multiple_choice',
  question: question?.question || 'Untitled question',
  options: Array.isArray(question?.options) ? question.options : [],
  correctAnswer: question?.correctAnswer || '',
  explanation: question?.explanation || '',
  hint: question?.hint || '',
  lesson: question?.lesson,
  optionImages: Array.isArray(question?.optionImages) ? question.optionImages : undefined,
  codeSnippet: question?.codeSnippet || '',
  codeLanguage: question?.codeLanguage || 'javascript',
});

const normalizeGeneratedField = (field: any): FormField => ({
  id: field?.id || Math.random().toString(36).slice(2, 9),
  name: field?.name || (field?.label || 'field').toLowerCase().replace(/\s+/g, '_'),
  label: field?.label || 'Untitled Field',
  type: field?.type || 'text',
  placeholder: field?.placeholder,
  options: Array.isArray(field?.options) ? field.options : undefined,
  required: field?.required !== false,
  socialPlatforms: Array.isArray(field?.socialPlatforms) ? field.socialPlatforms : undefined,
  description: field?.description,
});

const buildBaseEventFields = (): FormField[] => [
  { id: 'default_first_name', name: 'first_name', label: 'First Name', type: 'text', placeholder: 'Enter your first name...', required: true },
  { id: 'default_last_name', name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Enter your last name...', required: true },
  { id: 'default_email', name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com', required: true },
  { id: 'default_phone', name: 'phone', label: 'Mobile Phone', type: 'phone', required: true },
];

const mergeEventFields = (existingFields: FormField[] = [], generatedFields: any[] = []) => {
  const baseFields = buildBaseEventFields();
  const normalizedGenerated = generatedFields.map(normalizeGeneratedField);
  const byName = new Map<string, FormField>();

  [...baseFields, ...existingFields, ...normalizedGenerated].forEach(field => {
    const key = (field.name || field.label).toLowerCase();
    if (!byName.has(key)) byName.set(key, field);
  });

  return Array.from(byName.values());
};

// --- Design tokens ---
const LIGHT_C = {
  page: '#ffffff', nav: 'rgba(255,255,255,0.97)', navBorder: 'rgba(0,0,0,0.06)',
  card: '#ffffff', cardBorder: 'rgba(0,0,0,0.07)', cardShadow: '0 1px 3px rgba(0,0,0,0.04)',
  green: '#006128', lime: '#ADEE66', cta: '#006128', ctaText: 'white',
  text: '#111', muted: '#555', faint: '#999', toggleOff: '#e5e7eb',
  divider: 'rgba(0,0,0,0.06)', pill: '#f5f6f7', input: '#f5f6f7', inputBorder: '#e2e4e8',
  segmentActive: '#fff', segmentActiveText: '#111',
  groupBg: '#f8f9fa', groupBorder: 'rgba(0,0,0,0.06)',
};
const DARK_C = {
  page: '#111111', nav: 'rgba(17,17,17,0.90)', navBorder: 'rgba(255,255,255,0.07)',
  card: '#1c1c1c', cardBorder: 'rgba(255,255,255,0.07)', cardShadow: '0 1px 4px rgba(0,0,0,0.40)',
  green: '#ADEE66', lime: '#ADEE66', cta: '#ADEE66', ctaText: '#111',
  text: '#f0f0f0', muted: '#aaa', faint: '#555', toggleOff: '#3a3a3a',
  divider: 'rgba(255,255,255,0.07)', pill: '#242424', input: '#1a1a1a', inputBorder: 'rgba(255,255,255,0.09)',
  segmentActive: '#2e2e2e', segmentActiveText: '#f0f0f0',
  groupBg: 'rgba(255,255,255,0.03)', groupBorder: 'rgba(255,255,255,0.06)',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

// --- UI primitives ---
const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors placeholder:text-[#bbb]";
const labelCls = "block text-xs mb-1.5";

function Toggle({ checked, onChange, accentColor }: { checked: boolean; onChange: () => void; accentColor?: string }) {
  const C = useC();
  return (
    <button type="button" onClick={onChange} className="flex items-center gap-1.5">
      <span className="relative inline-flex w-7 h-4 rounded-full transition-colors"
        style={{ background: checked ? (accentColor ?? C.green) : C.toggleOff }}>
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-3' : ''}`} />
      </span>
      <span className="text-[11px] font-medium" style={{ color: checked ? (accentColor ?? C.green) : C.faint }}>
        {checked ? 'Required' : 'Optional'}
      </span>
    </button>
  );
}

function SwitchToggle({ checked, onChange, accentColor }: { checked: boolean; onChange: (v: boolean) => void; accentColor?: string }) {
  const C = useC();
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex-shrink-0">
      <span
        className="relative inline-flex w-9 h-5 rounded-full transition-colors"
        style={{ background: checked ? (accentColor ?? C.green) : C.toggleOff }}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

function EditorSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const C = useC();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="last:border-b-0" style={{ borderBottom: `1px solid ${C.divider}` }}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 px-1 group">
        <span className="text-[11px] font-semibold tracking-widest uppercase transition-colors" style={{ color: C.faint }}>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" style={{ color: C.faint }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: C.faint }} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="pb-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- FormPreview ---
function FormPreview({ config, isSubmitting, onSubmit, isSuccess, onReset, isSharedView }: {
  config: FormConfig;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, data?: any) => void;
  isSuccess: boolean;
  onReset: () => void;
  isSharedView: boolean;
}) {
  const [isRegistering, setIsRegistering] = useState(false);
  const fontOption = getFontById(config.font ?? 'sans');
  useEffect(() => { loadGoogleFont(fontOption); }, [fontOption]);
  const fontStyle = { fontFamily: fontOption.cssFamily };
  const containerBg = config.mode === 'light' ? 'bg-white border-zinc-200 shadow-2xl shadow-black/10' : 'bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm';
  const textColor = config.mode === 'light' ? 'text-zinc-900' : 'text-white';
  const mutedTextColor = config.mode === 'light' ? 'text-zinc-500' : 'text-zinc-400';
  const labelColor = config.mode === 'light' ? 'text-zinc-700' : 'text-zinc-300';
  const inputBg = config.mode === 'light' ? 'bg-transparent text-zinc-900 placeholder:text-zinc-400' : 'bg-transparent text-white placeholder:text-zinc-600';
  const selectOptionBg = config.mode === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white';
  const dividerCls = config.mode === 'light' ? 'bg-zinc-200' : 'bg-zinc-700';

  if (config.isCourse) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        {/* Course cover / header */}
        {(config.coverImage || config.title || config.description) && (
          <div className={`border rounded-2xl overflow-hidden ${containerBg}`} style={fontStyle}>
            {config.coverImage && (
              <img src={config.coverImage} alt="Cover" className="w-full h-44 object-cover" />
            )}
            <div className="p-7">
              <h2 className={`text-xl font-semibold tracking-tight ${textColor}`}>{config.title}</h2>
              {config.description && (
                <div className={`mt-2 text-sm leading-relaxed ${mutedTextColor} rich-preview`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(config.description) }} />
              )}
            </div>
          </div>
        )}
        <CourseTaker config={config} isSubmitting={isSubmitting} onSubmit={onSubmit} isSuccess={isSuccess} onReset={onReset} isSharedView={isSharedView} inlineMode={!isSharedView} />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`max-w-xl mx-auto text-center py-16 border rounded-3xl p-8 space-y-6 ${containerBg}`} style={fontStyle}>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className={`text-3xl font-medium ${textColor}`}>Successfully Submitted!</h2>
        <p className={mutedTextColor}>Your response has been recorded.</p>
        {!isSharedView && <button onClick={onReset} className="text-brand-accent hover:text-brand-accent text-sm transition-colors">Back to Editor</button>}
        {isSharedView && <button onClick={() => window.location.href = '/create'} className="text-brand-accent hover:text-brand-accent text-sm transition-colors">Create your own AI form</button>}
      </motion.div>
    );
  }

  const renderField = (field: FormField) => {
    const req = isRequired(field);
    switch (field.type) {
      case 'phone':
        return (
          <input
            type="tel"
            required={req}
            placeholder={field.placeholder || '+233 24 000 0000'}
            className={`w-full border-none outline-none px-4 py-3 text-sm ${inputBg}`}
          />
        );

      case 'company':
        return (
          <div className="flex items-center w-full">
            <span className={`px-3 py-3 flex-shrink-0 ${config.mode === 'light' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              <Building2 className="w-4 h-4" />
            </span>
            <span className={`w-px self-stretch my-2 ${dividerCls}`} />
            <input type="text" required={req} placeholder={field.placeholder || 'Company name...'} className={`flex-1 border-none outline-none px-4 py-3 text-sm ${inputBg}`} />
          </div>
        );

      case 'social': {
        const platforms = SOCIAL_PLATFORMS.filter(p =>
          !field.socialPlatforms?.length || field.socialPlatforms.includes(p.id)
        );
        return (
          <div className="space-y-3">
            {platforms.map((platform, pIdx) => (
              <AnimatedField key={platform.id} theme={config.theme} mode={config.mode}>
                <div className="flex items-center">
                  <span className={`px-3 py-3 flex-shrink-0`}>
                    <SocialIcon id={platform.id} size={18} />
                  </span>
                  <span className={`w-px self-stretch my-2 ${dividerCls}`} />
                  <input
                    type="url"
                    required={pIdx === 0 && req}
                    placeholder={platform.placeholder}
                    className={`flex-1 border-none outline-none px-4 py-3 text-sm ${inputBg}`}
                  />
                </div>
              </AnimatedField>
            ))}
          </div>
        );
      }

      case 'textarea':
        return <textarea required={req} placeholder={field.placeholder} className={`w-full border-none outline-none px-4 py-3 min-h-[110px] resize-y text-sm ${inputBg}`} />;

      case 'select':
        return (
          <select required={req} defaultValue="" className={`w-full border-none outline-none px-4 py-3 appearance-none cursor-pointer text-sm ${inputBg}`}>
            <option value="" disabled className={selectOptionBg}>{field.placeholder || 'Select an option...'}</option>
            {field.options?.map(opt => <option key={opt} value={opt} className={selectOptionBg}>{opt}</option>)}
          </select>
        );

      default:
        return (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
            required={req}
            placeholder={field.placeholder}
            className={`w-full border-none outline-none px-4 py-3 text-sm ${inputBg}`}
          />
        );
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className={`max-w-xl mx-auto border rounded-3xl overflow-hidden ${containerBg}`} style={fontStyle}>
      {config.coverImage && <img src={config.coverImage} alt="Cover" className="w-full h-52 object-cover" />}
      <div className="p-8 md:p-10">
        <div className="mb-8">
          <h2 className={`text-2xl font-semibold mb-2 tracking-tight ${textColor}`}>{config.title}</h2>
          <div className={`text-sm leading-relaxed ${mutedTextColor} rich-preview`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(config.description) }} />

          {config.eventDetails?.isEvent && (
            <div className={`mt-8 p-6 rounded-2xl border space-y-5 ${config.mode === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-800/40 border-zinc-700/50'}`}>
              {(config.eventDetails.date || config.eventDetails.time) && (
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-11 h-11 rounded-xl border flex flex-col overflow-hidden ${config.mode === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                    <div className={`h-4 flex items-center justify-center text-[9px] font-bold tracking-wider ${config.mode === 'light' ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-700 text-zinc-300'}`}>
                      {formatDateParts(config.eventDetails.date)?.monthShort || 'DAT'}
                    </div>
                    <div className={`flex-1 flex items-center justify-center text-base font-bold ${textColor}`}>
                      {formatDateParts(config.eventDetails.date)?.day || '--'}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${textColor}`}>{formatDateParts(config.eventDetails.date)?.fullDate || config.eventDetails.date || 'Date TBD'}</div>
                    {(config.eventDetails.time || config.eventDetails.timezone) && (
                      <div className={`text-xs mt-0.5 ${mutedTextColor}`}>{config.eventDetails.time} {config.eventDetails.timezone}</div>
                    )}
                  </div>
                </div>
              )}
              {config.eventDetails.location && (
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${config.mode === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                    <MapPin className={`w-4 h-4 ${mutedTextColor}`} />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold flex items-center gap-1 ${textColor}`}>
                      {formatLocation(config.eventDetails.location).main}
                      <ArrowUpRight className={`w-3 h-3 ${mutedTextColor}`} />
                    </div>
                    {formatLocation(config.eventDetails.location).sub && (
                      <div className={`text-xs mt-0.5 ${mutedTextColor}`}>{formatLocation(config.eventDetails.location).sub}</div>
                    )}
                  </div>
                </div>
              )}
              {!isRegistering && (
                <button type="button" onClick={() => setIsRegistering(true)} className={`w-full py-3 rounded-xl font-medium transition-all active:scale-[0.98] text-sm ${buttonThemes[config.theme]}`}>
                  Register Now
                </button>
              )}
            </div>
          )}
        </div>

        {(!config.eventDetails?.isEvent || isRegistering) && (
          <form onSubmit={onSubmit} className="space-y-5">
            {config.fields.map((field, idx) => (
              <motion.div key={field.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="space-y-1.5">
                {field.type === 'description' ? (
                  <div className={`py-1 ${config.mode === 'light' ? 'border-zinc-200' : 'border-zinc-800'}`}>
                    {field.label && field.label !== 'Section' && (
                      <p className={`text-sm font-semibold mb-1 ${textColor}`}>{field.label}</p>
                    )}
                    {field.description && (
                      <div className={`text-sm leading-relaxed ${mutedTextColor} rich-preview`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(field.description) }} />
                    )}
                  </div>
                ) : (
                  <>
                    <div className="ml-0.5 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <label className={`text-xs font-medium ${labelColor}`}>{field.label}</label>
                        {!isRequired(field) && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${config.mode === 'light' ? 'bg-zinc-100 text-zinc-400' : 'bg-zinc-800 text-zinc-600'}`}>optional</span>
                        )}
                      </div>
                      {field.description && (
                        <div className={`text-[11px] leading-relaxed ${mutedTextColor} rich-preview`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(field.description) }} />
                      )}
                    </div>
                    {field.type === 'social' ? renderField(field) : (
                      <AnimatedField theme={config.theme} mode={config.mode}>
                        {renderField(field)}
                      </AnimatedField>
                    )}
                  </>
                )}
              </motion.div>
            ))}
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} type="submit" disabled={isSubmitting} className={`w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 mt-6 disabled:opacity-60 text-sm ${buttonThemes[config.theme]}`}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Submit</span><ArrowRight className="w-4 h-4" /></>}
            </motion.button>
          </form>
        )}
      </div>
    </motion.div>
  );
}

// --- Sortable Field Card ---
interface FieldCardProps {
  f: FormField;
  isExpanded: boolean;
  toggleExpand: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
}

function SortableFieldCard({ f, isExpanded, toggleExpand, onRemove, onUpdate, index = 0, accentColor }: FieldCardProps & { index?: number; accentColor?: string }) {
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

// --- Main Page ---
export default function Page() {
  const C = useC();
  const { toggle: toggleTheme, theme } = useTheme();
  const { logoUrl } = useTenant();
  const router = useRouter();
  const inputStyle = { background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text };
  const labelStyle = { color: C.faint };
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(true); // stays true until useEffect resolves
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
const [isSaving, setIsSaving] = useState(false);
  const [savingAs, setSavingAs] = useState<'draft' | 'published' | null>(null);
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('published');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [savedFormId, setSavedFormId] = useState<string | null>(null);
  const [customSlug, setCustomSlug] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  // Add-field state
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newSocialPlatforms, setNewSocialPlatforms] = useState<string[]>(['linkedin', 'twitter']);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>('multiple_choice');
  const [learnOutcomeInput, setLearnOutcomeInput] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiQuestionType, setAiQuestionType] = useState<'multiple_choice' | 'fill_blank' | 'arrange'>('multiple_choice');
  const [aiDescriptionStyle, setAiDescriptionStyle] = useState<'professional' | 'casual' | 'friendly'>('professional');
  const [aiDescriptionLength, setAiDescriptionLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [aiDescriptionPrompt, setAiDescriptionPrompt] = useState('');
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const [eventAssistantOpen, setEventAssistantOpen] = useState(false);
  const [eventAssistantPrompt, setEventAssistantPrompt] = useState('');
  const [aiLoadingLabel, setAiLoadingLabel] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');
  const [aiFailed, setAiFailed] = useState(false);
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [lessonPrompts, setLessonPrompts] = useState<Record<string, string>>({});
  const [lessonPromptModal, setLessonPromptModal] = useState<{ q: CourseQuestion } | null>(null);
  // Bunny video picker
  const [bunnyPickerOpen, setBunnyPickerOpen] = useState(false);
  const [bunnyPickerQId, setBunnyPickerQId] = useState<string | null>(null);
  const [bunnyVideos, setBunnyVideos] = useState<any[]>([]);
  const [bunnyCollections, setBunnyCollections] = useState<any[]>([]);
  const [bunnyCollection, setBunnyCollection] = useState('');
  const [bunnyLoading, setBunnyLoading] = useState(false);
  const [bunnySearch, setBunnySearch] = useState('');
  const [bunnyError, setBunnyError] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [availableForms, setAvailableForms] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const toggleCohort = (id: string) =>
    setSelectedCohortIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Meeting integrations
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<string, { email?: string }>>({});
  const [creatingMeeting, setCreatingMeeting] = useState<string | null>(null);
  const [meetingError, setMeetingError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/auth'); return; }

      // Role guard -- only instructors and admins can access create pages
      const { data: studentProfile } = await supabase
        .from('students')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!studentProfile || !['instructor', 'admin'].includes(studentProfile.role)) {
        router.replace('/dashboard');
        return;
      }

      setUser(session.user);

      // cohorts loaded in separate effect below

      fetch('/api/integrations/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.ok ? r.json() : {})
        .then(data => setConnectedPlatforms(data))
        .catch(() => {});

    });
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get('s');
    const editId = params.get('edit');

    if (s) {
      try {
        setFormConfig(JSON.parse(decodeURIComponent(atob(s))));
        setIsSharedView(true);
      } catch (e) { console.error('Invalid shared schema', e); }
      setIsLoadingEdit(false);
    } else if (editId) {
      // Load existing content from purpose-built tables
      Promise.all([
        supabase.from('courses').select('id, title, description, slug, status, cohort_ids, questions, fields, passmark, course_timer, learn_outcomes, points_enabled, points_base, post_submission, cover_image, deadline_days, theme, mode, font, custom_accent').eq('id', editId).maybeSingle(),
        supabase.from('events').select('id, title, description, slug, status, cohort_ids, fields, event_date, event_time, timezone, location, event_type, capacity, meeting_link, is_private, post_submission, cover_image, deadline_days, theme, mode, font, custom_accent, speakers').eq('id', editId).maybeSingle(),
      ]).then(([{ data: course }, { data: event }]) => {
        let id: string | null = null;
        let config: any = null;
        let slug = '';
        let cohortIds: string[] = [];
        let status = '';

        if (course) {
          id = course.id; slug = course.slug || ''; cohortIds = course.cohort_ids || []; status = course.status;
          config = { isCourse: true, title: course.title, description: course.description,
            questions: course.questions ?? [], fields: course.fields ?? [],
            passmark: course.passmark, course_timer: course.course_timer,
            learnOutcomes: course.learn_outcomes, points_enabled: course.points_enabled,
            points_base: course.points_base,
            pointsSystem: { enabled: course.points_enabled ?? false, basePoints: course.points_base ?? 100 },
            postSubmission: course.post_submission,
            coverImage: course.cover_image, deadline_days: course.deadline_days,
            theme: course.theme, mode: course.mode, font: course.font, customAccent: course.custom_accent };
        } else if (event) {
          id = event.id; slug = event.slug || ''; cohortIds = event.cohort_ids || []; status = event.status;
          config = { title: event.title, description: event.description,
            fields: event.fields ?? [],
            eventDetails: { isEvent: true, date: event.event_date, time: event.event_time,
              timezone: event.timezone, location: event.location, eventType: event.event_type,
              capacity: event.capacity, meetingLink: event.meeting_link, isPrivate: event.is_private,
              speakers: event.speakers ?? [] },
            postSubmission: event.post_submission, coverImage: event.cover_image,
            deadline_days: event.deadline_days, theme: event.theme, mode: event.mode,
            font: event.font, customAccent: event.custom_accent };
        }

        if (id && config) { setFormConfig(config); setSavedFormId(id); setCustomSlug(slug); if (cohortIds.length) setSelectedCohortIds(cohortIds); if (status === 'draft' || status === 'published') setFormStatus(status); }
        setIsLoadingEdit(false);
      });
    } else {
      const type = params.get('type');
      if (type) {
        const match = TEMPLATES.find(t => t.key === type);
        if (match) setFormConfig({ ...match.config });
      }
      setIsLoadingEdit(false);
    }
  }, []);

  useEffect(() => {
    supabase.from('cohorts').select('id, name').order('name').then(({ data }) => {
      if (data) setCohorts(data);
    });
  }, []);

  useEffect(() => {
    if (formConfig?.postSubmission?.type !== 'events') return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const [{ data: events }, { data: courses }] = await Promise.all([
        supabase.from('events').select('id, title, slug, cover_image').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('courses').select('id, title, slug, cover_image').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      ]);
      const all = [
        ...(events ?? []).map((e: any) => ({ ...e, _type: 'event', config: { title: e.title, coverImage: e.cover_image } })),
        ...(courses ?? []).map((c: any) => ({ ...c, _type: 'course', config: { title: c.title, coverImage: c.cover_image } })),
      ].filter(f => f.id !== savedFormId);
      setAvailableForms(all);
    })();
  }, [formConfig?.postSubmission?.type, savedFormId]);

  // -- Create meeting via integration --
  const handleCreateMeeting = async (provider: string) => {
    if (!user) return;
    setCreatingMeeting(provider);
    setMeetingError('');
    const ev = formConfig?.eventDetails;
    const startTime = ev?.date && ev?.time ? `${ev.date}T${ev.time}:00` : undefined;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/integrations/create-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ provider, title: formConfig?.title || 'Event', startTime }),
    });
    const data = await res.json();
    if (data.url) {
      updateConfig({ eventDetails: { ...formConfig!.eventDetails!, meetingLink: data.url } });
    } else {
      setMeetingError(data.error || 'Failed to create meeting.');
    }
    setCreatingMeeting(null);
  };

  // -- Supabase save/share --
  const handleShare = async (saveStatus: 'draft' | 'published' = 'published') => {
    if (!formConfig) return;
    if (!user) { showToast('Please sign in to save and share your work.', 'info'); window.location.href = '/auth'; return; }
    setIsSaving(true);
    setSavingAs(saveStatus);
    try {
      let formId = savedFormId;
      // Use custom slug if provided, otherwise auto-generate a 5-char alphanumeric slug
      const shortSlug = () => Math.random().toString(36).slice(2, 7);
      const slugValue = customSlug.trim() || shortSlug();

      if (!formId) {
        // Create via API -- server enforces plan limits via DB trigger
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/forms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            title: formConfig.title,
            description: formConfig.description,
            config: formConfig,
            slug: slugValue,
            cohort_ids: selectedCohortIds,
            deadline_days: formConfig.deadline_days ?? null,
            status: saveStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? 'Failed to save form.');
          setIsSaving(false);
          setSavingAs(null);
          return;
        }
        formId = data.id; setSavedFormId(formId);
        setFormStatus(data.status ?? saveStatus);
        if (!customSlug.trim()) setCustomSlug(data.slug);
        // Always redirect to the detail page after the first save
        router.push(`/dashboard/${formId}?tab=settings`);
        return;
      } else {
        // Fetch current cohort_ids to detect newly added cohorts
        const { data: { session: fetchSession } } = await supabase.auth.getSession();
        const [{ data: existingCourse }, { data: existingEvent }] = await Promise.all([
          supabase.from('courses').select('cohort_ids').eq('id', formId!).maybeSingle(),
          supabase.from('events').select('cohort_ids').eq('id', formId!).maybeSingle(),
        ]);
        const existingForm = existingCourse ?? existingEvent;
        const patchRes = await fetch('/api/forms', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fetchSession?.access_token}` },
          body: JSON.stringify({ id: formId, title: formConfig.title, description: formConfig.description, config: formConfig, slug: slugValue, cohort_ids: selectedCohortIds, status: saveStatus }),
        });
        const patchData = await patchRes.json();
        const error = patchRes.ok ? null : patchData;
        if (!error) setFormStatus(saveStatus);
        if (error) { if (patchRes.status === 409 || error.error?.includes('slug')) { showToast('This URL slug is already taken. Try a different one.'); setIsSaving(false); return; } throw new Error(error.error ?? 'Update failed'); }
        // Re-index via authenticated proxy -- secret stays server-side
        if (saveStatus === 'published') {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.access_token) return;
            fetch('/api/vector/trigger-index', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body:    JSON.stringify({ formId }),
            }).catch(() => {});
          });
        }
        // Notify students in newly added cohorts only
        const oldCohortIds: string[] = Array.isArray(existingForm?.cohort_ids) ? existingForm.cohort_ids : [];
        const addedCohortIds = selectedCohortIds.filter((id: string) => !oldCohortIds.includes(id));
        const { data: { session: editSession } } = await supabase.auth.getSession();
        if (addedCohortIds.length) {
          fetch('/api/notify-assignment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editSession?.access_token}` },
            body: JSON.stringify({ formId }),
          }).catch(() => {});
        }
        // Upsert cohort_assignments for all selected cohorts (preserves original assigned_at)
        if (selectedCohortIds.length) {
          fetch('/api/cohort-assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editSession?.access_token}` },
            body: JSON.stringify({ formId, cohortIds: selectedCohortIds }),
          }).catch(() => {});
        }
      }
      const url = `${window.location.origin}/${slugValue}`;
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url);
        else throw new Error('');
      } catch {
        window.prompt('Copy your form link:', url);
      }
      setPreviewKey(k => k + 1);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      console.error('Failed to save form', e);
      showToast('Failed to save. Please check your connection and try again.');
    } finally { setIsSaving(false); setSavingAs(null); }
  };

  // -- Template selection --
  const handleSelectTemplate = (template: typeof TEMPLATES[number]) => {
    setFormConfig(template.config);
    setIsSuccess(false);
    setSavedFormId(null);
    setCustomSlug('');
  };

  // -- AI generation --
  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setFormConfig(null);
    setIsSuccess(false);
    setSavedFormId(null);
    setCustomSlug('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(await res.text());
      const parsed = await res.json();
      if (parsed) {
        const defaultFields: FormField[] = [
          { id: 'default_first_name', name: 'first_name', label: 'First Name', type: 'text', placeholder: 'Enter your first name...', required: true },
          { id: 'default_last_name', name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Enter your last name...', required: true },
          { id: 'default_email', name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com', required: true },
          { id: 'default_phone', name: 'phone', label: 'Mobile Phone', type: 'phone', required: true },
        ];
        const skipKeywords = ['first name', 'last name', 'email', 'phone', 'mobile', 'telephone'];
        const aiFields = (parsed.fields || []).filter(
          (f: FormField) => !skipKeywords.some(kw => f.label.toLowerCase().includes(kw) || f.name.toLowerCase().includes(kw))
        ).map((f: FormField) => ({ ...f, required: f.required !== false }));
        setFormConfig({ ...parsed, fields: parsed.isCourse ? [] : [...defaultFields, ...aiFields], questions: parsed.questions || [], coverImage: '', theme: 'forest', mode: 'dark', font: 'sans' });
      }
    } catch (error) {
      console.error('Failed to generate form:', error);
      showToast('Failed to generate. Please try again.');
    } finally { setIsGenerating(false); }
  };

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  const updateConfig = (updates: Partial<FormConfig>) => {
    if (formConfig) setFormConfig({ ...formConfig, ...updates });
  };

  const runAiAction = async <T,>(label: string, task: () => Promise<T>) => {
    setAiError('');
    setAiSuccess('');
    setAiFailed(false);
    setAiLoadingLabel(label);
    try {
      const result = await task();
      setAiSuccess('Done!');
      setTimeout(() => setAiSuccess(''), 2500);
      return result;
    } catch (e: any) {
      const msg = e?.message || 'AI request failed';
      setAiError(msg);
      setAiFailed(true);
      showToast(msg);
      return null;
    } finally {
      setAiLoadingLabel('');
      setBusyQuestionId(null);
    }
  };

  const generateQuestions = async () => {
    const topic = aiTopic.trim();
    if (!topic) {
      setAiError('Enter a topic first so AI knows what to generate.');
      return;
    }

    const data = await runAiAction('Generating questions...', async () => {
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` },
        body: JSON.stringify({
          action: 'generate_questions',
          topic,
          count: aiQuestionCount,
          type: aiQuestionType,
        }),
      });
      return parseJsonResponse(res);
    });

    if (!data?.questions) return;
    setFormConfig(prev => prev ? {
      ...prev,
      isCourse: true,
      fields: [],
      questions: [...(prev.questions || []), ...data.questions.map(normalizeGeneratedQuestion)],
    } : prev);
  };

  const generateOutcomes = async () => {
    const questions = formConfig?.questions || [];
    if (!questions.length) {
      setAiError('Add at least one question before generating learning outcomes.');
      return;
    }

    const data = await runAiAction('Generating learning outcomes...', async () => {
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` },
        body: JSON.stringify({
          action: 'generate_outcomes',
          questions: questions.map(q => ({ question: q.question, correctAnswer: q.correctAnswer })),
        }),
      });
      return parseJsonResponse(res);
    });

    if (!data?.outcomes) return;
    setFormConfig(prev => prev ? { ...prev, learnOutcomes: data.outcomes } : prev);
  };

  const generateCourseDescription = async () => {
    if (!formConfig?.isCourse) return;

    const hasCourseContext =
      formConfig.title.trim() ||
      (formConfig.questions || []).length > 0 ||
      (formConfig.learnOutcomes || []).length > 0;

    if (!hasCourseContext) {
      setAiError('Add a course title, questions, or outcomes before generating a description.');
      return;
    }

    setDescriptionModalOpen(false);
    const data = await runAiAction('Generating course description...', async () => {
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` },
        body: JSON.stringify({
          action: 'generate_course_description',
          title: formConfig.title,
          description: formConfig.description,
          style: aiDescriptionStyle,
          length: aiDescriptionLength,
          prompt: aiDescriptionPrompt.trim(),
          questions: (formConfig.questions || []).map(q => ({
            question: q.question,
            correctAnswer: q.correctAnswer,
          })),
          learnOutcomes: formConfig.learnOutcomes || [],
        }),
      });
      return parseJsonResponse(res);
    });

    if (!data?.description) return;
    setFormConfig(prev => prev ? { ...prev, description: data.description } : prev);
  };

  const generateEventSetup = async () => {
    if (!formConfig?.eventDetails?.isEvent) return;
    const brief = eventAssistantPrompt.trim();
    if (!brief) {
      setAiError('Describe the event so AI can generate the setup.');
      return;
    }

    setEventAssistantOpen(false);
    const data = await runAiAction('Generating event setup...', async () => {
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` },
        body: JSON.stringify({
          action: 'generate_event_setup',
          brief,
          existingTitle: formConfig.title,
          existingDescription: formConfig.description,
          eventDetails: formConfig.eventDetails,
        }),
      });
      return parseJsonResponse(res);
    });

    if (!data) return;
    setFormConfig(prev => prev ? {
      ...prev,
      title: data.title || prev.title,
      description: data.description || prev.description,
      fields: mergeEventFields(prev.fields || [], data.fields || []),
      eventDetails: {
        ...prev.eventDetails,
        ...data.eventDetails,
        isEvent: true,
      },
      postSubmission: data.postSubmission?.type
        ? {
            ...prev.postSubmission,
            ...data.postSubmission,
          }
        : prev.postSubmission,
    } : prev);
  };

  const generateQuestionAsset = async (
    q: CourseQuestion,
    action: 'generate_distractors' | 'generate_lesson' | 'generate_hint' | 'generate_explanation',
    instruction?: string
  ) => {
    const isLessonAction = action === 'generate_lesson';
    const prompt = instruction ?? lessonPrompts[q.id] ?? '';
    // For lesson generation: allow if there's a prompt OR a question; for other actions always need question+answer
    if (!isLessonAction && (!q.question.trim() || !q.correctAnswer.trim())) {
      setAiError('Each AI action needs both the question text and a correct answer.');
      return;
    }
    if (isLessonAction && !q.question.trim() && !prompt.trim()) {
      setAiError('Add a question or type a topic/instructions for the lesson.');
      return;
    }

    setBusyQuestionId(q.id);
    const labelMap = {
      generate_distractors: 'Generating distractors...',
      generate_lesson: 'Generating lesson...',
      generate_hint: 'Generating hint...',
      generate_explanation: 'Generating explanation...',
    } as const;

    const data = await runAiAction(labelMap[action], async () => {
      const payload: any = {
        action,
        question: q.question,
        correctAnswer: q.correctAnswer,
      };
      if (isLessonAction && prompt.trim()) payload.instruction = prompt.trim();
      if (action === 'generate_distractors') payload.count = Math.max(0, 4 - q.options.length) || 3;

      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` },
        body: JSON.stringify(payload),
      });
      return parseJsonResponse(res);
    });

    if (!data) return;

    setFormConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: (prev.questions || []).map(item => {
          if (item.id !== q.id) return item;
          if (action === 'generate_distractors') {
            const wrongAnswers = (data.distractors || []).filter((opt: string) => opt && opt !== item.correctAnswer);
            const existingWrong = item.options.filter(opt => opt !== item.correctAnswer);
            return {
              ...item,
              options: [item.correctAnswer, ...existingWrong, ...wrongAnswers].slice(0, 4),
            };
          }
          if (action === 'generate_lesson') {
            return {
              ...item,
              lesson: {
                title: data.title || item.lesson?.title || '',
                body: data.body || item.lesson?.body || '',
                imageUrl: item.lesson?.imageUrl || '',
                videoUrl: data.videoUrl || item.lesson?.videoUrl || '',
              },
            };
          }
          if (action === 'generate_hint') return { ...item, hint: data.hint || item.hint || '' };
          return { ...item, explanation: data.explanation || item.explanation || '' };
        }),
      };
    });
  };

  // -- Field management --
  const handleUpdateField = (id: string, updates: Partial<FormField>) => {
    if (!formConfig) return;
    updateConfig({ fields: formConfig.fields.map(f => f.id === id ? { ...f, ...updates } : f) });
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !formConfig) return;
    const oldIdx = formConfig.fields.findIndex(f => f.id === active.id);
    const newIdx = formConfig.fields.findIndex(f => f.id === over.id);
    updateConfig({ fields: arrayMove(formConfig.fields, oldIdx, newIdx) });
  };

  const handleRemoveField = (id: string) => {
    if (!formConfig) return;
    updateConfig({ fields: formConfig.fields.filter(f => f.id !== id) });
  };

  const handleAddField = () => {
    if (newFieldType !== 'description' && !newFieldLabel.trim()) return;
    if (!formConfig) return;
    const id = Math.random().toString(36).substring(7);
    const label = newFieldLabel.trim() || (newFieldType === 'description' ? 'Section' : '');
    const newField: FormField = {
      id,
      name: label.toLowerCase().replace(/\s+/g, '_') || id,
      label,
      type: newFieldType,
      placeholder: newFieldType === 'phone' || newFieldType === 'company' || newFieldType === 'social' || newFieldType === 'description' ? undefined : `Enter ${label.toLowerCase()}...`,
      options: newFieldType === 'select' ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      required: newFieldRequired,
      socialPlatforms: newFieldType === 'social' ? [...newSocialPlatforms] : undefined,
      description: newFieldType === 'description' ? '' : undefined,
    };
    updateConfig({ fields: [...formConfig.fields, newField] });
    setExpandedFields(prev => new Set(prev).add(id));
    setNewFieldLabel('');
    setNewFieldOptions('');
    setNewSocialPlatforms(['linkedin', 'twitter']);
    setNewFieldRequired(true);
  };

  // -- Course management --
  const handleAddQuestion = () => {
    if (!formConfig) return;
    const id = Math.random().toString(36).substring(7);
    const defaults: Record<QuestionType, Partial<CourseQuestion>> = {
      multiple_choice: { options: ['Option A', 'Option B', 'Option C', 'Option D'], correctAnswer: 'Option A' },
      fill_blank:      { options: [], correctAnswer: '' },
      arrange:         { options: ['Step 1', 'Step 2', 'Step 3', 'Step 4'], correctAnswer: 'Step 1|||Step 2|||Step 3|||Step 4' },
      image:           { options: ['0', '1', '2', '3'], correctAnswer: '0', optionImages: ['', '', '', ''] },
      code:            { options: ['Option A', 'Option B', 'Option C', 'Option D'], correctAnswer: 'Option A', codeSnippet: '', codeLanguage: 'javascript' },
    };
    updateConfig({
      questions: [...(formConfig.questions || []), {
        id,
        type: newQuestionType,
        question: 'New Question',
        ...defaults[newQuestionType],
      } as CourseQuestion],
    });
  };

  const handleAddSection = () => {
    if (!formConfig) return;
    const id = Math.random().toString(36).substring(7);
    updateConfig({
      questions: [...(formConfig.questions || []), {
        id, isSection: true, sectionTitle: 'New Section', sectionDescription: '', question: '', options: [], correctAnswer: '',
      } as CourseQuestion],
    });
  };

  const handleQuestionImageUpload = async (qId: string, e: React.ChangeEvent<HTMLInputElement>, optionIdx?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large. Maximum size is 5MB.'); return; }
    e.target.value = '';
    if (optionIdx === undefined) return;

    const applyUrl = (src: string) => {
      const q = formConfig?.questions?.find(q => q.id === qId);
      if (!q) return;
      const newImages = [...(q.optionImages || q.options.map(() => ''))];
      newImages[optionIdx] = src;
      handleUpdateQuestion(qId, { optionImages: newImages });
    };

    try {
      const publicUrl = await uploadToCloudinary(file, 'course-options');
      applyUrl(publicUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = ev => applyUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveQuestion = (id: string) => {
    if (!formConfig) return;
    updateConfig({ questions: formConfig.questions?.filter(q => q.id !== id) || [] });
  };

  const handleUpdateQuestion = (id: string, updates: Partial<CourseQuestion>) => {
    if (!formConfig) return;
    updateConfig({ questions: formConfig.questions?.map(q => q.id === id ? { ...q, ...updates } : q) || [] });
  };

  const openBunnyPicker = async (qId: string, search = '', collection = '') => {
    setBunnyPickerQId(qId);
    setBunnyPickerOpen(true);
    setBunnyLoading(true);
    setBunnyError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      // Fetch collections + videos in parallel on first open
      const qs = new URLSearchParams({ ...(search ? { search } : {}), ...(collection ? { collection } : {}) });
      const [videosRes, collectionsRes] = await Promise.all([
        fetch(`/api/bunny?${qs}`, { headers: { Authorization: `Bearer ${token}` } }),
        bunnyCollections.length === 0
          ? fetch('/api/bunny?collections=1', { headers: { Authorization: `Bearer ${token}` } })
          : Promise.resolve(null),
      ]);
      const videosJson = await videosRes.json();
      if (!videosRes.ok) { setBunnyError(videosJson.error || 'Failed to load videos'); return; }
      setBunnyVideos(videosJson.videos ?? []);
      if (collectionsRes) {
        const colJson = await collectionsRes.json();
        setBunnyCollections(colJson.collections ?? []);
      }
    } catch {
      setBunnyError('Network error. Please try again.');
    } finally {
      setBunnyLoading(false);
    }
  };

  const selectBunnyVideo = (embedUrl: string) => {
    if (!bunnyPickerQId || !formConfig) return;
    const q = formConfig.questions?.find(q => q.id === bunnyPickerQId);
    if (!q) return;
    handleUpdateQuestion(bunnyPickerQId, { lesson: { ...q.lesson, videoUrl: embedUrl } });
    setBunnyPickerOpen(false);
    setBunnyPickerQId(null);
    setBunnySearch('');
    setBunnyCollection('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('File size exceeds 20MB limit.'); return; }
    e.target.value = '';

    try {
      const publicUrl = await uploadToCloudinary(file, 'covers');
      updateConfig({ coverImage: publicUrl });
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => updateConfig({ coverImage: ev.target?.result as string });
      reader.readAsDataURL(file);
    }
  };

  // -- Shared view --
  if (isSharedView && formConfig) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6 py-16">
        <FormPreview config={formConfig} isSubmitting={isSubmitting} onSubmit={handleSubmitForm} isSuccess={isSuccess} onReset={() => setIsSuccess(false)} isSharedView={true} />
      </main>
    );
  }

  // -- Loading edit --
  if (isLoadingEdit) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: C.page }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.green }} />
      </main>
    );
  }

  // -- Landing --
  if (!formConfig) {
    return (
      <main className="min-h-screen flex flex-col" style={{ background: C.page, color: C.text }}>
        <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 backdrop-blur-sm" style={{ borderBottom: `1px solid ${theme === 'dark' ? C.navBorder : '#0b07b3'}`, background: theme === 'dark' ? C.nav : '#0e09dd' }}>
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src={logoUrl} alt="" className="h-7 w-auto" />
            <span className="text-sm font-semibold tracking-tight" style={{ color: theme === 'dark' ? C.text : 'white' }}>AI Skills Africa</span>
          </Link>
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2 text-sm transition-colors hover:opacity-60" style={{ color: theme === 'dark' ? C.muted : 'rgba(255,255,255,0.8)' }}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
          ) : (
            <Link href="/auth" className="text-sm transition-colors hover:opacity-60" style={{ color: theme === 'dark' ? C.muted : 'rgba(255,255,255,0.8)' }}>Sign in</Link>
          )}
        </nav>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 max-w-3xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center space-y-5 mb-12">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1]" style={{ color: C.text }}>
              Build forms in<br /><span style={{ color: C.green, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>seconds</span>, not <span style={{ color: '#d97706', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>hours.</span>
            </h1>
            <p className="text-lg max-w-md mx-auto leading-relaxed" style={{ color: C.muted }}>
              Describe what you need. We generate a polished, interactive form instantly.
            </p>
          </motion.div>

          <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} onSubmit={handleGenerate} className="w-full">
            <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
              <div className="p-3 flex flex-col gap-3">
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(e as any); } }}
                  placeholder="e.g. A registration form for a 3-day music festival with t-shirt size and meal preference..."
                  className="w-full border-none outline-none text-sm px-2 py-1 resize-none min-h-[72px] leading-relaxed bg-transparent"
                  style={{ color: C.text }}
                  disabled={isGenerating}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs hidden sm:inline" style={{ color: C.faint }}>Enter to generate · Shift+Enter for new line</span>
                  <button type="submit" disabled={isGenerating || !prompt.trim()} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: C.cta, color: C.ctaText }}>
                    {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.form>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2 mt-5 justify-center">
            {EXAMPLE_PROMPTS.map(ex => (
              <button key={ex} type="button" onClick={() => { setPrompt(ex); promptRef.current?.focus(); }} className="px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-70" style={{ background: C.pill, color: C.muted, border: `1px solid ${C.cardBorder}` }}>
                {ex}
              </button>
            ))}
          </motion.div>

          {/* Templates */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="w-full mt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: C.divider }} />
              <span className="text-xs font-medium tracking-wider uppercase" style={{ color: C.faint }}>or start from a template</span>
              <div className="flex-1 h-px" style={{ background: C.divider }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TEMPLATES.map((t, i) => {
                const Icon = t.icon;
                return (
                  <motion.button
                    key={t.key}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.07 }}
                    onClick={() => handleSelectTemplate(t)}
                    className="group relative flex flex-col items-start gap-3 p-4 rounded-2xl transition-all text-left hover:shadow-md"
                    style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${t.color}18` }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: t.color, width: 18, height: 18 }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight" style={{ color: C.text }}>{t.label}</p>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: C.faint }}>{t.description}</p>
                    </div>
                    <span className="absolute bottom-3 right-3 text-[10px] font-medium transition-colors" style={{ color: C.faint }}>
                      Use
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
        <GeneratingOverlay visible={isGenerating || !!aiLoadingLabel} label={aiLoadingLabel || (isGenerating ? 'Generating your form' : undefined)} failed={aiFailed} />
      </main>
    );
  }

  // -- Editor --
  const accentColor = formConfig.customAccent ?? themeAccentColors[formConfig.theme];

  const defaultPoints: PointsSystem = {
    enabled: false,
    basePoints: 100,
    timeBonusEnabled: true,
    timeBonusSeconds: 10,
    timeBonusMultiplier: 1.5,
    streakEnabled: true,
    streakCount: 3,
    streakBonus: 50,
    hintPenalty: 20,
    milestones: [],
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: C.page }}>
      {/* -- Editor header: Logo + Dashboard link + Save -- */}
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: theme === 'dark' ? C.nav : '#0e09dd', borderBottom: `1px solid ${theme === 'dark' ? C.navBorder : '#0b07b3'}` }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <img src={logoUrl} alt="" className="h-6 w-auto" />
              <span className="text-sm font-semibold tracking-tight" style={{ color: theme === 'dark' ? C.text : 'white' }}>AI Skills Africa</span>
            </Link>
            <div className="w-px h-4" style={{ background: theme === 'dark' ? C.divider : 'rgba(255,255,255,0.2)' }} />
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-60" style={{ color: theme === 'dark' ? C.muted : 'rgba(255,255,255,0.8)' }}>
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
            {savedFormId && formConfig?.title && (
              <>
                <span className="text-xs" style={{ color: theme === 'dark' ? C.faint : 'rgba(255,255,255,0.5)' }}>/</span>
                <span className="text-xs truncate max-w-[180px]" style={{ color: theme === 'dark' ? C.muted : 'rgba(255,255,255,0.8)' }}>{formConfig.title}</span>
              </>
            )}
          </div>
          <button onClick={toggleTheme} type="button" className="p-2 rounded-lg transition-colors ff-hover" title="Toggle theme" style={{ color: theme === 'dark' ? C.faint : 'white' }}>
            {theme === 'dark' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <div className="flex items-center gap-2">
            {/* Draft status pill -- only shown when form is already saved as draft */}
            {savedFormId && formStatus === 'draft' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: C.pill, color: C.muted }}>Draft</span>
            )}
            <button
              type="button"
              onClick={() => handleShare('draft')}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-60 hover:opacity-80"
              style={{ background: C.pill, color: C.text }}
            >
              {savingAs === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleShare('published')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60 hover:opacity-90"
              style={{ background: accentColor, color: C.ctaText }}
            >
              {savingAs === 'published' ? <Loader2 className="w-4 h-4 animate-spin" /> : copied ? <Check className="w-4 h-4" /> : null}
              {copied && savingAs !== 'published' ? 'Saved!' : savedFormId && formStatus === 'published' ? 'Save' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* -- Left Editor Panel -- */}
        <aside className="w-full md:w-[400px] flex-shrink-0 overflow-y-auto custom-scrollbar" style={{ background: C.card, borderRight: `1px solid ${C.cardBorder}` }}>
          <div className="px-5 py-4 space-y-0">

            <EditorSection title="Content">
              <div>
                <label className={labelCls} style={labelStyle}>Form Title</label>
                <input type="text" value={formConfig.title} onChange={e => updateConfig({ title: e.target.value })} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <label className={labelCls} style={{ ...labelStyle, marginBottom: 0 }}>Description</label>
                  {formConfig.isCourse && (
                    <button
                      type="button"
                      onClick={() => setDescriptionModalOpen(true)}
                      disabled={!!aiLoadingLabel}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity disabled:opacity-50"
                      style={{ background: `${accentColor}16`, color: accentColor, border: `1px solid ${accentColor}22` }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Description
                    </button>
                  )}
                </div>
                <RichTextEditor value={formConfig.description} onChange={html => updateConfig({ description: html })} />
              </div>

              {/* Learning outcomes -- course only */}
              {formConfig.isCourse && (
                <div>
                  <label className={labelCls} style={labelStyle}>What students will learn</label>
                  <div className="space-y-1.5">
                    {(formConfig.learnOutcomes || []).map((outcome, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                        <div className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ background: `${accentColor}22` }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }}/>
                        </div>
                        <span className="flex-1 text-xs leading-relaxed" style={{ color: C.text }}>{outcome}</span>
                        <button
                          type="button"
                          onClick={() => updateConfig({ learnOutcomes: (formConfig.learnOutcomes || []).filter((_, idx) => idx !== i) })}
                          className="flex-shrink-0 transition-opacity hover:opacity-70"
                          style={{ color: C.faint }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={learnOutcomeInput}
                        onChange={e => setLearnOutcomeInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const v = learnOutcomeInput.trim();
                            if (v) { updateConfig({ learnOutcomes: [...(formConfig.learnOutcomes || []), v] }); setLearnOutcomeInput(''); }
                          }
                        }}
                        placeholder="Add a learning outcome..."
                        className={`${inputCls} flex-1`}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = learnOutcomeInput.trim();
                          if (v) { updateConfig({ learnOutcomes: [...(formConfig.learnOutcomes || []), v] }); setLearnOutcomeInput(''); }
                        }}
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ background: accentColor }}
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    {(formConfig.learnOutcomes || []).length === 0 && (
                      <p className="text-[10px] leading-relaxed pt-0.5" style={{ color: C.faint }}>Bullet points shown on the course overview page. Press Enter or click + to add.</p>
                    )}
                  </div>
                </div>
              )}
            </EditorSection>

            {formConfig.eventDetails?.isEvent && (
              <EditorSection title="Event Details">
                <div className="mb-3 rounded-xl p-3 space-y-2" style={{ background: C.groupBg, border: `1px solid ${C.groupBorder}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label className={labelCls} style={{ ...labelStyle, marginBottom: 0 }}>AI Event Assistant</label>
                      <p className="text-[10px] mt-1 leading-relaxed" style={{ color: C.faint }}>
                        Generate the event setup, suggested registration fields, and confirmation copy from a short brief.
                      </p>
                    </div>
                    <div className="px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ background: `${accentColor}18`, color: accentColor }}>
                      AI
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setEventAssistantOpen(true)}
                      disabled={!!aiLoadingLabel}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: accentColor, color: C.ctaText }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Open Event Assistant
                    </button>
                  </div>
                </div>
                {/* Event type toggle */}
                <div className="flex gap-1 p-1 rounded-xl mb-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                  {(['in-person', 'virtual'] as const).map(type => {
                    const active = (formConfig.eventDetails!.eventType ?? 'in-person') === type;
                    return (
                      <button key={type} type="button"
                        onClick={() => updateConfig({ eventDetails: { ...formConfig.eventDetails!, eventType: type } })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                        style={{ background: active ? C.segmentActive : 'transparent', color: active ? C.segmentActiveText : C.faint, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : undefined }}>
                        {type === 'in-person' ? '📍 In-Person' : '🎥 Virtual'}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls} style={labelStyle}>Date</label>
                    <input type="date" value={formConfig.eventDetails.date || ''} onChange={e => updateConfig({ eventDetails: { ...formConfig.eventDetails!, date: e.target.value } })} className={`${inputCls} [color-scheme:light]`} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Time</label>
                    <input type="time" value={formConfig.eventDetails.time || ''} onChange={e => updateConfig({ eventDetails: { ...formConfig.eventDetails!, time: e.target.value } })} className={`${inputCls} [color-scheme:light]`} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Timezone</label>
                    <select value={formConfig.eventDetails.timezone || ''} onChange={e => updateConfig({ eventDetails: { ...formConfig.eventDetails!, timezone: e.target.value } })} className={inputCls} style={inputStyle}>
                      <option value="">Select timezone…</option>
                      <optgroup label="Africa">
                        <option value="GMT+0 (Accra)">GMT+0 -- Accra</option>
                        <option value="GMT+1 (Lagos)">GMT+1 -- Lagos</option>
                        <option value="GMT+2 (Cairo)">GMT+2 -- Cairo</option>
                        <option value="GMT+2 (Johannesburg)">GMT+2 -- Johannesburg</option>
                        <option value="GMT+3 (Nairobi)">GMT+3 -- Nairobi</option>
                      </optgroup>
                      <optgroup label="Americas">
                        <option value="GMT-5 (EST)">GMT-5 -- Eastern (EST)</option>
                        <option value="GMT-4 (EDT)">GMT-4 -- Eastern Daylight (EDT)</option>
                        <option value="GMT-6 (CST)">GMT-6 -- Central (CST)</option>
                        <option value="GMT-5 (CDT)">GMT-5 -- Central Daylight (CDT)</option>
                        <option value="GMT-7 (MST)">GMT-7 -- Mountain (MST)</option>
                        <option value="GMT-8 (PST)">GMT-8 -- Pacific (PST)</option>
                        <option value="GMT-7 (PDT)">GMT-7 -- Pacific Daylight (PDT)</option>
                        <option value="GMT-9 (AKST)">GMT-9 -- Alaska (AKST)</option>
                        <option value="GMT-10 (HST)">GMT-10 -- Hawaii (HST)</option>
                        <option value="GMT-3 (BRT)">GMT-3 -- Brasilia (BRT)</option>
                        <option value="GMT-5 (COT)">GMT-5 -- Colombia (COT)</option>
                        <option value="GMT-4 (AMT)">GMT-4 -- Amazon (AMT)</option>
                        <option value="GMT-3 (ART)">GMT-3 -- Argentina (ART)</option>
                      </optgroup>
                      <optgroup label="Europe">
                        <option value="GMT+0 (GMT)">GMT+0 -- London (GMT)</option>
                        <option value="GMT+1 (BST)">GMT+1 -- London Daylight (BST)</option>
                        <option value="GMT+1 (CET)">GMT+1 -- Central Europe (CET)</option>
                        <option value="GMT+2 (CEST)">GMT+2 -- Central Europe Summer (CEST)</option>
                        <option value="GMT+2 (EET)">GMT+2 -- Eastern Europe (EET)</option>
                        <option value="GMT+3 (MSK)">GMT+3 -- Moscow (MSK)</option>
                      </optgroup>
                      <optgroup label="Asia">
                        <option value="GMT+3 (AST)">GMT+3 -- Arabia (AST)</option>
                        <option value="GMT+4 (GST)">GMT+4 -- Gulf (GST)</option>
                        <option value="GMT+5 (PKT)">GMT+5 -- Pakistan (PKT)</option>
                        <option value="GMT+5:30 (IST)">GMT+5:30 -- India (IST)</option>
                        <option value="GMT+6 (BST)">GMT+6 -- Bangladesh (BST)</option>
                        <option value="GMT+7 (WIB)">GMT+7 -- Jakarta (WIB)</option>
                        <option value="GMT+8 (CST)">GMT+8 -- China/Singapore (CST)</option>
                        <option value="GMT+8 (PHT)">GMT+8 -- Philippines (PHT)</option>
                        <option value="GMT+9 (JST)">GMT+9 -- Japan/Korea (JST)</option>
                        <option value="GMT+5:30 (IST)">GMT+5:30 -- Sri Lanka</option>
                      </optgroup>
                      <optgroup label="Pacific">
                        <option value="GMT+10 (AEST)">GMT+10 -- Sydney (AEST)</option>
                        <option value="GMT+11 (AEDT)">GMT+11 -- Sydney Daylight (AEDT)</option>
                        <option value="GMT+12 (NZST)">GMT+12 -- New Zealand (NZST)</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Capacity (optional)</label>
                    <input type="number" min={1} value={formConfig.eventDetails.capacity ?? ''} onChange={e => updateConfig({ eventDetails: { ...formConfig.eventDetails!, capacity: e.target.value ? Number(e.target.value) : undefined } })} placeholder="Unlimited" className={inputCls} style={inputStyle} />
                  </div>
                </div>

                {/* Location / Meeting link -- full width below grid */}
                <div className="mt-2">
                  {(formConfig.eventDetails.eventType ?? 'in-person') === 'virtual' ? (
                    <>
                      {/* Connected platform quick-create buttons */}
                      {Object.keys(connectedPlatforms).length > 0 && (
                        <div className="mb-2">
                          <label className={labelCls} style={labelStyle}>Create with connected account</label>
                          <div className="flex items-center gap-2 mt-1">
                            {([
                              { id: 'google_meet', name: 'Google Meet', logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Meet.png' },
                              { id: 'zoom',        name: 'Zoom',         logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Zoom.png' },
                              { id: 'teams',       name: 'Teams',        logo: 'https://gmokwtuyxccnjwpmifug.supabase.co/storage/v1/object/public/form-assets/Logos/Teams.png' },
                            ] as const).filter(p => connectedPlatforms[p.id]).map(p => (
                              <button key={p.id} type="button"
                                title={`Generate ${p.name} link`}
                                onClick={() => handleCreateMeeting(p.id)}
                                disabled={!!creatingMeeting}
                                className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
                                style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                                {creatingMeeting === p.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.text }}/>
                                  : <img src={p.logo} alt={p.name} className="w-5 h-5 object-contain" />}
                              </button>
                            ))}
                          </div>
                          {meetingError && <p className="text-[11px] mt-1.5 text-red-500">{meetingError}</p>}
                          {formConfig.eventDetails.meetingLink && (
                            <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#10b981' }}>
                              <CheckCircle2 className="w-3 h-3"/> Link created -- edit below if needed
                            </p>
                          )}
                        </div>
                      )}
                      <label className={labelCls} style={labelStyle}>Meeting Link</label>
                      <input type="url" value={formConfig.eventDetails.meetingLink || ''} onChange={e => updateConfig({ eventDetails: { ...formConfig.eventDetails!, meetingLink: e.target.value } })} placeholder="https://meet.google.com/..." className={inputCls} style={inputStyle} />
                    </>
                  ) : (
                    <>
                      <label className={labelCls} style={labelStyle}>Address / Venue</label>
                      <input type="text" value={formConfig.eventDetails.location || ''} onChange={e => updateConfig({ eventDetails: { ...formConfig.eventDetails!, location: e.target.value } })} placeholder="123 Main St, City" className={inputCls} style={inputStyle} />
                    </>
                  )}
                </div>
              </EditorSection>
            )}

            {formConfig.eventDetails?.isEvent && (
              <EditorSection title="Visibility">
                <button
                  type="button"
                  onClick={() => updateConfig({ eventDetails: { ...formConfig.eventDetails!, isPrivate: !formConfig.eventDetails!.isPrivate } })}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200"
                  style={{
                    background: formConfig.eventDetails.isPrivate ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)',
                    borderColor: formConfig.eventDetails.isPrivate ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{formConfig.eventDetails.isPrivate ? '🔒' : '🌐'}</span>
                    <div className="text-left">
                      <p className="text-xs font-semibold" style={{ color: formConfig.eventDetails.isPrivate ? '#f87171' : '#34d399' }}>
                        {formConfig.eventDetails.isPrivate ? 'Private event' : 'Public event'}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: C.faint }}>
                        {formConfig.eventDetails.isPrivate ? 'Hidden from your profile page' : 'Visible on your public profile'}
                      </p>
                    </div>
                  </div>
                  <div
                    className="relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0"
                    style={{ background: formConfig.eventDetails.isPrivate ? '#ef4444' : '#10b981' }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
                      style={{ left: formConfig.eventDetails.isPrivate ? '1.25rem' : '0.125rem' }}
                    />
                  </div>
                </button>
              </EditorSection>
            )}

            {(formConfig.isCourse || formConfig.eventDetails?.isEvent) && (
              <EditorSection title="Assign to Cohorts" defaultOpen={true}>
                <div className="space-y-2">
                  {cohorts.length === 0 && (
                    <p className="text-xs py-2" style={{ color: C.faint }}>No cohorts yet. Create one in the dashboard.</p>
                  )}
                  {cohorts.map(c => {
                    const checked = selectedCohortIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                        style={{ background: checked ? `${accentColor}12` : C.input, border: `1px solid ${checked ? accentColor : C.inputBorder}` }}>
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: checked ? accentColor : 'transparent', border: `1.5px solid ${checked ? accentColor : C.faint}` }}>
                          {checked && <Check className="w-2.5 h-2.5" style={{ color: '#fff' }}/>}
                        </div>
                        <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleCohort(c.id)}/>
                        <span className="text-sm font-medium" style={{ color: C.text }}>{c.name}</span>
                      </label>
                    );
                  })}
                  <p className="text-[11px] pt-1" style={{ color: C.faint }}>
                    {selectedCohortIds.length === 0
                      ? 'No cohort selected -- course will be public.'
                      : `Visible to ${selectedCohortIds.length} cohort${selectedCohortIds.length > 1 ? 's' : ''}.`}
                  </p>
                  {selectedCohortIds.length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: C.inputBorder }}>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Deadline (days from assignment)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={1} max={365} placeholder="--"
                          value={formConfig.deadline_days ?? ''}
                          onChange={e => updateConfig({ deadline_days: e.target.value ? Number(e.target.value) : null })}
                          className="w-20 bg-transparent px-2 py-1.5 text-sm outline-none rounded-lg text-center"
                          style={{ border: `1px solid ${C.inputBorder}`, color: C.text, background: C.input }}
                        />
                        <span className="text-xs" style={{ color: C.faint }}>days · leave blank for no deadline</span>
                      </div>
                    </div>
                  )}
                </div>
              </EditorSection>
            )}

            <EditorSection title="Share URL" defaultOpen={false}>
              <div>
                <label className={labelCls} style={labelStyle}>Custom slug (optional)</label>
                <div className="flex items-center rounded-lg overflow-hidden" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                  <span className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: C.faint, borderRight: `1px solid ${C.inputBorder}` }}>/</span>
                  <input type="text" value={customSlug} onChange={e => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="my-form" className="w-full bg-transparent px-3 py-2 text-sm outline-none" style={{ color: C.text }} />
                </div>
              </div>
            </EditorSection>

            <EditorSection title="Cover Image" defaultOpen={false}>
              {formConfig.coverImage ? (
                <div className="relative w-full h-28 rounded-xl overflow-hidden group" style={{ border: `1px solid ${C.cardBorder}` }}>
                  <img src={formConfig.coverImage} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => updateConfig({ coverImage: '' })} className="flex items-center gap-1.5 text-red-400 text-xs font-medium bg-white/80 px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="relative block cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="w-full rounded-xl px-3 py-7 flex flex-col items-center justify-center gap-2 transition-colors hover:opacity-80" style={{ background: C.input, border: `1.5px dashed ${C.inputBorder}` }}>
                    <ImageIcon className="w-5 h-5" style={{ color: C.faint }} />
                    <span className="text-xs" style={{ color: C.faint }}>Click to upload · max 20MB</span>
                  </div>
                </label>
              )}
            </EditorSection>

            <EditorSection title="Appearance">
              <div>
                <label className={labelCls} style={labelStyle}>Mode</label>
                <div className="flex gap-1.5 p-1 rounded-lg" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                  <button onClick={() => updateConfig({ mode: 'light' })} className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5" style={{ background: formConfig.mode === 'light' ? C.segmentActive : 'transparent', color: formConfig.mode === 'light' ? C.segmentActiveText : C.faint, boxShadow: formConfig.mode === 'light' ? '0 1px 3px rgba(0,0,0,0.1)' : undefined }}>
                    <Sun className="w-3.5 h-3.5" /> Light
                  </button>
                  <button onClick={() => updateConfig({ mode: 'dark' })} className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5" style={{ background: formConfig.mode === 'dark' ? C.segmentActive : 'transparent', color: formConfig.mode === 'dark' ? C.segmentActiveText : C.faint, boxShadow: formConfig.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.1)' : undefined }}>
                    <Moon className="w-3.5 h-3.5" /> Dark
                  </button>
                  <button onClick={() => updateConfig({ mode: 'auto' })} className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all flex flex-col items-center justify-center" style={{ background: formConfig.mode === 'auto' ? C.segmentActive : 'transparent', color: formConfig.mode === 'auto' ? C.segmentActiveText : C.faint, boxShadow: formConfig.mode === 'auto' ? '0 1px 3px rgba(0,0,0,0.1)' : undefined }}>
                    <span>Auto</span>
                    <span className="text-[9px] opacity-60 leading-none">Matches device</span>
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Font</label>
                <button
                  onClick={() => setFontPickerOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text, fontFamily: getFontById(formConfig.font).cssFamily }}
                >
                  <span>{getFontById(formConfig.font).name}</span>
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }} />
                </button>
                {fontPickerOpen && (
                  <FontPickerModal
                    currentFont={formConfig.font}
                    onSelect={id => updateConfig({ font: id })}
                    onClose={() => setFontPickerOpen(false)}
                    dark={formConfig.mode !== 'light'}
                  />
                )}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Accent color</label>
                <div className="flex gap-3 flex-wrap pl-1 pt-1">
                  {([
                    { key: 'forest',  color: '#006128', label: 'Forest'  },
                    { key: 'lime',    color: '#ADEE66', label: 'Lime'    },
                    { key: 'emerald', color: '#10b981', label: 'Emerald' },
                    { key: 'rose',    color: '#f43f5e', label: 'Rose'    },
                    { key: 'amber',   color: '#f59e0b', label: 'Amber'   },
                  ] as const).map(({ key, color, label }) => {
                    const isSelected = formConfig.theme === key && !formConfig.customAccent;
                    return (
                      <button key={key} onClick={() => updateConfig({ theme: key, customAccent: undefined })} title={label} className="flex flex-col items-center gap-1.5 group">
                        <span
                          className={`w-7 h-7 rounded-full transition-transform group-hover:scale-110 ${isSelected ? 'scale-110' : ''}`}
                          style={{
                            background: color,
                            boxShadow: isSelected ? `0 0 0 2.5px ${C.page}, 0 0 0 4.5px ${color}` : undefined,
                          }}
                        />
                        <span className="text-[10px] transition-colors group-hover:opacity-60" style={{ color: C.faint }}>{label}</span>
                      </button>
                    );
                  })}

                  {/* Custom color picker */}
                  <div className="flex flex-col items-center gap-1.5 group">
                    <div
                      title="Custom color"
                      className={`relative w-7 h-7 rounded-full cursor-pointer overflow-hidden transition-transform group-hover:scale-110 border-2 ${formConfig.customAccent ? 'scale-110' : ''}`}
                      style={{
                        background: formConfig.customAccent ?? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                        boxShadow: formConfig.customAccent ? `0 0 0 2.5px ${C.page}, 0 0 0 4.5px ${formConfig.customAccent}` : undefined,
                        borderColor: formConfig.customAccent ? 'transparent' : C.inputBorder,
                      }}
                    >
                      <input
                        type="color"
                        value={formConfig.customAccent ?? accentColor}
                        onChange={e => updateConfig({ customAccent: e.target.value })}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}
                      />
                    </div>
                    <span className="text-[10px] transition-colors group-hover:opacity-60" style={{ color: C.faint }}>Custom</span>
                  </div>
                </div>
              </div>
            </EditorSection>

            {/* Fields / Questions */}
            <EditorSection title={formConfig.isCourse ? 'Questions' : 'Fields'}>
              {formConfig.isCourse ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl space-y-3" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label className={labelCls} style={{ ...labelStyle, marginBottom: 0 }}>AI Course Builder</label>
                        <p className="text-[10px] mt-1 leading-relaxed" style={{ color: C.faint }}>
                          Generate questions and learning outcomes from a topic, then refine each question with AI.
                        </p>
                      </div>
                      <div className="px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ background: `${accentColor}18`, color: accentColor }}>
                        AI
                      </div>
                    </div>

                    <input
                      type="text"
                      value={aiTopic}
                      onChange={e => setAiTopic(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="e.g. Intro to digital marketing for beginners"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls} style={labelStyle}>Question type</label>
                        <select
                          value={aiQuestionType}
                          onChange={e => setAiQuestionType(e.target.value as 'multiple_choice' | 'fill_blank' | 'arrange')}
                          className={`${inputCls} py-1.5`}
                          style={inputStyle}
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="fill_blank">Fill in the Blank</option>
                          <option value="arrange">Arrange / Order</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls} style={labelStyle}>Question count</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={aiQuestionCount}
                          onChange={e => setAiQuestionCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                          className={`${inputCls} py-1.5`}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={generateQuestions}
                          disabled={!!aiLoadingLabel}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: accentColor, color: C.ctaText }}
                        >
                          {aiLoadingLabel === 'Generating questions...' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Generate Questions
                        </button>
                      </div>
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={generateOutcomes}
                          disabled={!!aiLoadingLabel}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: C.pill, color: C.text, border: `1px solid ${C.inputBorder}` }}
                        >
                          {aiLoadingLabel === 'Generating learning outcomes...' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                          Generate Outcomes
                        </button>
                      </div>
                    </div>

                    {aiError && <p className="text-[11px]" style={{ color: '#ef4444' }}>{aiError}</p>}
                    {!aiError && aiSuccess && <p className="text-[11px]" style={{ color: '#10b981' }}>{aiSuccess}</p>}
                  </div>

                  {/* Show answers setting */}
                  <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                    <label className={labelCls} style={labelStyle}>Show correct answers</label>
                    <div className="flex gap-1.5 p-1 rounded-lg" style={{ background: C.pill, border: `1px solid ${C.inputBorder}` }}>
                      {([
                        { value: 'per_question', label: 'Per question' },
                        { value: 'after_quiz', label: 'After course' },
                        { value: 'none', label: 'Never' },
                      ] as const).map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateConfig({ showAnswers: value })}
                          className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
                          style={{ background: (formConfig.showAnswers ?? 'per_question') === value ? C.segmentActive : 'transparent', color: (formConfig.showAnswers ?? 'per_question') === value ? C.segmentActiveText : C.faint, boxShadow: (formConfig.showAnswers ?? 'per_question') === value ? '0 1px 3px rgba(0,0,0,0.08)' : undefined }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: C.faint }}>
                      {(formConfig.showAnswers ?? 'per_question') === 'per_question' && 'Students see correct/incorrect after each question.'}
                      {formConfig.showAnswers === 'after_quiz' && 'Students see all answers after submitting.'}
                      {formConfig.showAnswers === 'none' && 'Students only see their final score.'}
                    </p>
                  </div>

                  {/* Lesson timing */}
                  <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                    <label className={labelCls} style={labelStyle}>Lesson timing</label>
                    <div className="flex gap-1.5 p-1 rounded-lg" style={{ background: C.pill, border: `1px solid ${C.inputBorder}` }}>
                      {([
                        { value: 'before', label: 'Before question' },
                        { value: 'after', label: 'After answer' },
                      ] as const).map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateConfig({ lessonTiming: value })}
                          className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
                          style={{ background: (formConfig.lessonTiming ?? 'after') === value ? C.segmentActive : 'transparent', color: (formConfig.lessonTiming ?? 'after') === value ? C.segmentActiveText : C.faint, boxShadow: (formConfig.lessonTiming ?? 'after') === value ? '0 1px 3px rgba(0,0,0,0.08)' : undefined }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: C.faint }}>
                      {(formConfig.lessonTiming ?? 'after') === 'before'
                        ? 'Lesson opens automatically before each question. Students read first, then answer.'
                        : 'Lesson is offered after answering. "Why?" if wrong, "Review Lesson" if right.'}
                    </p>
                  </div>

                  {/* Pass mark */}
                  <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                    <div className="flex items-center justify-between">
                      <label className={`${labelCls} mb-0`} style={labelStyle}>Pass mark</label>
                      <span className="text-xs font-semibold" style={{ color: accentColor }}>{formConfig.passmark ?? 50}%</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[50, 60, 70, 80].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => updateConfig({ passmark: pct })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={(formConfig.passmark ?? 50) === pct ? { background: accentColor, color: 'white' } : { background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.muted }}
                        >
                          {pct}%
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Custom"
                        value={![50, 60, 70, 80].includes(formConfig.passmark ?? 50) ? (formConfig.passmark ?? '') : ''}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 100) updateConfig({ passmark: v });
                        }}
                        className={`${inputCls} w-20 py-1.5`}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                    <div className="flex items-center justify-between">
                      <label className={`${labelCls} mb-0`} style={labelStyle}>Time limit</label>
                      <span className="text-xs font-semibold" style={{ color: C.muted }}>
                        {formConfig.courseTimer ? `${formConfig.courseTimer} min` : 'None'}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[0, 5, 10, 15, 20, 30, 45, 60].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateConfig({ courseTimer: t || undefined })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={(formConfig.courseTimer ?? 0) === t ? { background: accentColor, color: 'white' } : { background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.muted }}
                        >
                          {t === 0 ? 'None' : `${t}m`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Max attempts */}
                  <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                    <div className="flex items-center justify-between">
                      <label className={`${labelCls} mb-0`} style={labelStyle}>Max attempts</label>
                      <span className="text-xs font-semibold" style={{ color: C.muted }}>
                        {formConfig.maxAttempts ? formConfig.maxAttempts : 'Unlimited'}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[0, 1, 2, 3, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updateConfig({ maxAttempts: n || undefined })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={(formConfig.maxAttempts ?? 0) === n ? { background: accentColor, color: 'white' } : { background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.muted }}
                        >
                          {n === 0 ? '∞' : n}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px]" style={{ color: C.faint }}>Tracked per email address via submission records.</p>
                  </div>

                  {formConfig.questions?.map((q, qIdx) => {
                    const qType: QuestionType = q.type ?? 'multiple_choice';

                    // -- Section divider card --
                    if (q.isSection) {
                      return (
                        <div key={q.id} className="rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${accentColor}40`, borderLeft: `3px solid ${accentColor}` }}>
                          <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: `1px solid ${C.divider}` }}>
                            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: accentColor }}>Section</span>
                            <button type="button" onClick={() => updateConfig({ questions: formConfig.questions?.filter(qq => qq.id !== q.id) })}
                              className="p-1 rounded transition-colors hover:bg-red-500/10">
                              <X className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                          <div className="px-3.5 py-3 space-y-2">
                            <input
                              value={q.sectionTitle || ''}
                              onChange={e => updateConfig({ questions: formConfig.questions?.map(qq => qq.id === q.id ? { ...qq, sectionTitle: e.target.value } : qq) })}
                              placeholder="Section title…"
                              className={`${inputCls} font-semibold`}
                              style={inputStyle}
                            />
                            <input
                              value={q.sectionDescription || ''}
                              onChange={e => updateConfig({ questions: formConfig.questions?.map(qq => qq.id === q.id ? { ...qq, sectionDescription: e.target.value } : qq) })}
                              placeholder="Optional description…"
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                    <div key={q.id} className="rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: `1px solid ${C.divider}` }}>
                        <span className="text-xs font-medium" style={{ color: C.faint }}>Q{qIdx + 1}</span>
                        <div className="flex items-center gap-1.5">
                          {/* Type selector */}
                          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                            {([
                              { v: 'multiple_choice', l: 'MC' },
                              { v: 'fill_blank', l: 'Fill' },
                              { v: 'arrange', l: 'Order' },
                              { v: 'image', l: 'Image' },
                              { v: 'code', l: 'Code' },
                            ] as const).map(({ v, l }) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => handleUpdateQuestion(q.id, {
                                  type: v,
                                  ...(v === 'fill_blank' ? { options: [] } : {}),
                                  ...(v === 'arrange' && qType !== 'arrange' ? { correctAnswer: q.options.join('|||') } : {}),
                                })}
                                className="px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all"
                                style={{ background: qType === v ? accentColor : 'transparent', color: qType === v ? C.ctaText : C.faint }}
                              >{l}</button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(q.id, {
                              lessonOnly: !q.lessonOnly,
                              // auto-open lesson panel when enabling lesson-only mode
                              ...(!q.lessonOnly && !q.lesson ? { lesson: { title: '', body: '', imageUrl: '', videoUrl: '' } } : {}),
                            })}
                            title="Lesson only (no question)"
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all"
                            style={q.lessonOnly ? { background: accentColor, color: C.ctaText } : { background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.faint }}
                          >
                            <BookOpen className="w-3 h-3" /> Lesson only
                          </button>
                          <button type="button" onClick={() => handleRemoveQuestion(q.id)} className="p-1 transition-colors hover:text-red-400" style={{ color: C.faint }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3.5 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {!q.lessonOnly && (<>
                          <button
                            type="button"
                            onClick={() => generateQuestionAsset(q, 'generate_distractors')}
                            disabled={!!aiLoadingLabel || !['multiple_choice', 'code'].includes(qType)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.text }}
                          >
                            {busyQuestionId === q.id && aiLoadingLabel === 'Generating distractors...' ? 'Generating...' : 'AI Distractors'}
                          </button>
                          </>)}
                          <button
                            type="button"
                            onClick={() => setLessonPromptModal({ q })}
                            disabled={!!aiLoadingLabel}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.text }}
                          >
                            {busyQuestionId === q.id && aiLoadingLabel === 'Generating lesson...' ? 'Generating…' : 'AI Lesson'}
                          </button>
                          {!q.lessonOnly && (<>
                          <button
                            type="button"
                            onClick={() => generateQuestionAsset(q, 'generate_hint')}
                            disabled={!!aiLoadingLabel}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.text }}
                          >
                            {busyQuestionId === q.id && aiLoadingLabel === 'Generating hint...' ? 'Generating...' : 'AI Hint'}
                          </button>
                          <button
                            type="button"
                            onClick={() => generateQuestionAsset(q, 'generate_explanation')}
                            disabled={!!aiLoadingLabel}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.text }}
                          >
                            {busyQuestionId === q.id && aiLoadingLabel === 'Generating explanation...' ? 'Generating...' : 'AI Explanation'}
                          </button>
                          </>)}
                        </div>
                        {!q.lessonOnly && (<>

                        {/* Question text */}
                        <div>
                          <label className={labelCls} style={labelStyle}>Question</label>
                          <input type="text" value={q.question} onChange={e => handleUpdateQuestion(q.id, { question: e.target.value })} className={inputCls} style={inputStyle}
                            placeholder={qType === 'fill_blank' ? 'e.g. The capital of France is ___' : 'Enter your question...'} />
                          {qType === 'fill_blank' && <p className="text-[10px] mt-1" style={{ color: C.faint }}>Tip: use ___ to mark where the blank is.</p>}
                        </div>

                        {/* Code snippet section */}
                        {qType === 'code' && (
                          <div className="space-y-2">
                            <label className={labelCls} style={labelStyle}>Code Snippet</label>
                            <select
                              value={q.codeLanguage || 'javascript'}
                              onChange={e => handleUpdateQuestion(q.id, { codeLanguage: e.target.value })}
                              className={`${inputCls} py-1.5`}
                              style={inputStyle}
                            >
                              {['javascript', 'python', 'typescript', 'java', 'c', 'cpp', 'go', 'rust', 'sql'].map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                              ))}
                            </select>
                            <textarea
                              value={q.codeSnippet || ''}
                              onChange={e => handleUpdateQuestion(q.id, { codeSnippet: e.target.value })}
                              className={`${inputCls} min-h-[120px] resize-y font-mono text-xs`}
                              style={inputStyle}
                              placeholder="Paste your code snippet here..."
                            />
                          </div>
                        )}

                        {/* Image options -- each option is an image */}
                        {qType === 'image' && (
                          <div className="space-y-2">
                            <label className={labelCls} style={labelStyle}>Image Options <span style={{ color: C.faint }}>(● = correct)</span></label>
                            <div className="grid grid-cols-2 gap-2">
                              {q.options.map((opt, optIdx) => {
                                const imgSrc = (q.optionImages || [])[optIdx] || '';
                                return (
                                  <div key={optIdx} className="relative rounded-lg overflow-hidden transition-colors" style={{ border: `2px solid ${q.correctAnswer === opt ? accentColor : C.inputBorder}` }}>
                                    {imgSrc ? (
                                      <div className="relative group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={imgSrc} alt="" className="w-full h-20 object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <button
                                            onClick={() => {
                                              const newImages = [...(q.optionImages || q.options.map(() => ''))];
                                              newImages[optIdx] = '';
                                              handleUpdateQuestion(q.id, { optionImages: newImages });
                                            }}
                                            className="text-red-400 text-[10px] font-medium flex items-center gap-1"
                                          >
                                            <Trash2 className="w-3 h-3" /> Remove
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <label className="block cursor-pointer">
                                        <input type="file" accept="image/*" className="hidden" onChange={e => handleQuestionImageUpload(q.id, e, optIdx)} />
                                        <div className="w-full h-20 flex items-center justify-center gap-1 text-[10px] transition-colors hover:opacity-60" style={{ color: C.faint }}>
                                          <ImageIcon className="w-3 h-3" /> Upload
                                        </div>
                                      </label>
                                    )}
                                    <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderTop: `1px solid ${C.divider}` }}>
                                      <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt}
                                        onChange={() => handleUpdateQuestion(q.id, { correctAnswer: opt })}
                                        className="w-3 h-3 flex-shrink-0" style={{ accentColor: accentColor }} />
                                      <span className="text-[10px]" style={{ color: C.faint }}>Option {optIdx + 1}</span>
                                      {q.options.length > 2 && (
                                        <button type="button" onClick={() => {
                                          const newOpts = q.options.filter((_, i) => i !== optIdx);
                                          const newImages = (q.optionImages || q.options.map(() => '')).filter((_, i) => i !== optIdx);
                                          const u: Partial<CourseQuestion> = { options: newOpts, optionImages: newImages };
                                          if (q.correctAnswer === opt) u.correctAnswer = newOpts[0] ?? '0';
                                          handleUpdateQuestion(q.id, u);
                                        }} className="ml-auto transition-colors hover:text-red-400" style={{ color: C.faint }}>
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <button type="button" onClick={() => {
                              const newIdx = String(q.options.length);
                              const newOpts = [...q.options, newIdx];
                              const newImages = [...(q.optionImages || q.options.map(() => '')), ''];
                              handleUpdateQuestion(q.id, { options: newOpts, optionImages: newImages });
                            }} className="text-xs transition-colors flex items-center gap-1 mt-1 hover:opacity-60" style={{ color: C.muted }}>
                              <Plus className="w-3 h-3" /> Add option
                            </button>
                          </div>
                        )}

                        {/* Multiple choice options (also used for code type) */}
                        {(qType === 'multiple_choice' || qType === 'code') && (
                          <div className="space-y-1.5">
                            <label className={labelCls} style={labelStyle}>Options <span style={{ color: C.faint }}>(● = correct)</span></label>
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt}
                                  onChange={() => handleUpdateQuestion(q.id, { correctAnswer: opt })}
                                  className="w-3.5 h-3.5 flex-shrink-0" style={{ accentColor: accentColor }} />
                                <input type="text" value={opt}
                                  onChange={e => {
                                    const newOpts = [...q.options]; newOpts[optIdx] = e.target.value;
                                    const u: Partial<CourseQuestion> = { options: newOpts };
                                    if (q.correctAnswer === opt) u.correctAnswer = e.target.value;
                                    handleUpdateQuestion(q.id, u);
                                  }}
                                  className={`${inputCls} py-1.5 flex-1`} style={inputStyle} />
                                {q.options.length > 2 && (
                                  <button type="button" onClick={() => {
                                    const newOpts = q.options.filter((_, i) => i !== optIdx);
                                    const u: Partial<CourseQuestion> = { options: newOpts };
                                    if (q.correctAnswer === opt) u.correctAnswer = newOpts[0] ?? '';
                                    handleUpdateQuestion(q.id, u);
                                  }} className="transition-colors flex-shrink-0 hover:text-red-400" style={{ color: C.faint }}>
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => {
                              const newOpts = [...q.options, `Option ${q.options.length + 1}`];
                              handleUpdateQuestion(q.id, { options: newOpts });
                            }} className="text-xs transition-colors flex items-center gap-1 mt-1 hover:opacity-60" style={{ color: C.muted }}>
                              <Plus className="w-3 h-3" /> Add option
                            </button>
                          </div>
                        )}

                        {/* Fill in the blank -- correct answer */}
                        {qType === 'fill_blank' && (
                          <div>
                            <label className={labelCls} style={labelStyle}>Correct answer</label>
                            <input type="text" value={q.correctAnswer}
                              onChange={e => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                              className={inputCls} style={inputStyle} placeholder="e.g. Paris" />
                            <p className="text-[10px] mt-1" style={{ color: C.faint }}>Separate multiple accepted answers with | (e.g. Paris|paris|PARIS)</p>
                          </div>
                        )}

                        {/* Arrange -- ordered items */}
                        {qType === 'arrange' && (
                          <div className="space-y-1.5">
                            <label className={labelCls} style={labelStyle}>Items <span style={{ color: C.faint }}>(top = first in correct order)</span></label>
                            {q.options.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono w-4 flex-shrink-0 text-right" style={{ color: C.faint }}>{itemIdx + 1}</span>
                                <input type="text" value={item}
                                  onChange={e => {
                                    const newOpts = [...q.options]; newOpts[itemIdx] = e.target.value;
                                    handleUpdateQuestion(q.id, { options: newOpts, correctAnswer: newOpts.join('|||') });
                                  }}
                                  className={`${inputCls} py-1.5 flex-1`} style={inputStyle} />
                                {q.options.length > 2 && (
                                  <button type="button" onClick={() => {
                                    const newOpts = q.options.filter((_, i) => i !== itemIdx);
                                    handleUpdateQuestion(q.id, { options: newOpts, correctAnswer: newOpts.join('|||') });
                                  }} className="transition-colors flex-shrink-0 hover:text-red-400" style={{ color: C.faint }}>
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => {
                              const newOpts = [...q.options, `Item ${q.options.length + 1}`];
                              handleUpdateQuestion(q.id, { options: newOpts, correctAnswer: newOpts.join('|||') });
                            }} className="text-xs transition-colors flex items-center gap-1 mt-1 hover:opacity-60" style={{ color: C.muted }}>
                              <Plus className="w-3 h-3" /> Add item
                            </button>
                          </div>
                        )}

                        {/* Hint input */}
                        <div>
                          <label className={labelCls} style={labelStyle}>Hint <span style={{ color: C.faint }}>(optional)</span></label>
                          <input
                            type="text"
                            value={q.hint || ''}
                            onChange={e => handleUpdateQuestion(q.id, { hint: e.target.value })}
                            className={inputCls}
                            style={inputStyle}
                            placeholder="Optional hint shown to students on request..."
                          />
                        </div>

                        <div>
                          <label className={labelCls} style={labelStyle}>Explanation <span style={{ color: C.faint }}>(shown after answering)</span></label>
                          <textarea
                            value={q.explanation || ''}
                            onChange={e => handleUpdateQuestion(q.id, { explanation: e.target.value })}
                            className={`${inputCls} min-h-[84px] resize-y`}
                            style={inputStyle}
                            placeholder="Explain why this answer is correct..."
                          />
                        </div>
                        </>)}

                        {/* Lesson section */}
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(q.id, {
                              lesson: q.lesson ? undefined : { title: '', body: '', imageUrl: '', videoUrl: '' }
                            })}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors hover:opacity-70"
                            style={{ color: C.muted }}
                          >
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5" />
                              Lesson <span style={{ color: C.faint }}>(optional)</span>
                            </span>
                            {q.lesson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {q.lesson && (
                            <div className="px-3 py-3 space-y-2" style={{ borderTop: `1px solid ${C.divider}` }}>
                              <input
                                type="text"
                                value={q.lesson.title || ''}
                                onChange={e => handleUpdateQuestion(q.id, { lesson: { ...q.lesson, title: e.target.value } })}
                                className={inputCls}
                                style={inputStyle}
                                placeholder="Lesson title (optional)..."
                              />
                              <RichTextEditor
                                value={q.lesson.body || ''}
                                onChange={html => handleUpdateQuestion(q.id, { lesson: { ...q.lesson, body: html } })}
                                placeholder="Explain the theory behind this question..."
                              />
                              {q.lesson.imageUrl ? (
                                <div className="relative group rounded-lg overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
                                  <img src={q.lesson.imageUrl} alt="" className="w-full h-28 object-cover" />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuestion(q.id, { lesson: { ...q.lesson, imageUrl: '' } })}
                                      className="text-red-400 text-[10px] font-medium flex items-center gap-1 bg-white/80 px-2 py-1 rounded-lg"
                                    >
                                      <Trash2 className="w-3 h-3" /> Remove
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label className="block cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async e => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      e.target.value = '';
                                      let url: string;
                                      try {
                                        url = await uploadToCloudinary(file, 'lesson-images');
                                      } catch {
                                        url = await new Promise<string>(res => { const r = new FileReader(); r.onload = ev => res(ev.target?.result as string); r.readAsDataURL(file); });
                                      }
                                      handleUpdateQuestion(q.id, { lesson: { ...q.lesson, imageUrl: url } });
                                    }}
                                  />
                                  <div className="w-full h-10 flex items-center justify-center gap-1.5 rounded-lg text-xs transition-colors hover:opacity-60" style={{ border: `1.5px dashed ${C.inputBorder}`, color: C.faint }}>
                                    <ImageIcon className="w-3.5 h-3.5" /> Upload image (optional)
                                  </div>
                                </label>
                              )}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={q.lesson.videoUrl || ''}
                                  onChange={e => handleUpdateQuestion(q.id, { lesson: { ...q.lesson, videoUrl: e.target.value } })}
                                  className={`${inputCls} flex-1`}
                                  style={inputStyle}
                                  placeholder="YouTube, Vimeo or Bunny URL..."
                                />
                                <button
                                  type="button"
                                  onClick={() => openBunnyPicker(q.id)}
                                  title="Pick from Bunny library"
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-70 flex-shrink-0"
                                  style={{ background: '#FF6B35', color: 'white' }}
                                >
                                  <Video className="w-3.5 h-3.5"/> Bunny
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                  {(!formConfig.questions || formConfig.questions.length === 0) && <p className="text-xs text-center py-3" style={{ color: C.faint }}>No questions yet.</p>}

                  {/* Add question row */}
                  <div className="flex items-center gap-2 pt-1">
                    <select value={newQuestionType} onChange={e => setNewQuestionType(e.target.value as QuestionType)} className={`${inputCls} py-1.5 flex-1`} style={inputStyle}>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="fill_blank">Fill in the Blank</option>
                      <option value="arrange">Arrange / Order</option>
                      <option value="image">Image Question</option>
                      <option value="code">Code Snippet</option>
                    </select>
                    <button type="button" onClick={handleAddQuestion} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all flex-shrink-0 hover:opacity-80" style={{ background: accentColor, color: C.ctaText }}>
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                    <button type="button" onClick={handleAddSection} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all flex-shrink-0 hover:opacity-80" style={{ background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.muted }}>
                      <Plus className="w-3.5 h-3.5" /> Section
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Field cards -- drag to reorder */}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <SortableContext items={formConfig.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {formConfig.fields.map((f, idx) => {
                          const isExpanded = expandedFields.has(f.id);
                          const toggleExpand = () => setExpandedFields(prev => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(f.id) : next.add(f.id);
                            return next;
                          });
                          return (
                            <SortableFieldCard
                              key={f.id}
                              f={f}
                              index={idx}
                              isExpanded={isExpanded}
                              toggleExpand={toggleExpand}
                              onRemove={() => handleRemoveField(f.id)}
                              onUpdate={updates => handleUpdateField(f.id, updates)}
                              accentColor={accentColor}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
                      {activeId ? (() => {
                        const field = formConfig.fields.find(f => f.id === activeId);
                        if (!field) return null;
                        return (
                          <div style={{ background: C.card, border: `1.5px solid ${C.lime}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px ${C.lime}22`, cursor: 'grabbing', transform: 'rotate(1.5deg) scale(1.02)', transformOrigin: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{field.label || 'Untitled field'}</span>
                            <span style={{ fontSize: 10, fontWeight: 500, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', background: C.pill, padding: '2px 7px', borderRadius: 5 }}>{field.type}</span>
                          </div>
                        );
                      })() : null}
                    </DragOverlay>
                  </DndContext>

                  {formConfig.fields.length === 0 && <p className="text-xs text-center py-3" style={{ color: C.faint }}>No fields yet.</p>}

                  {/* Add new field */}
                  <div className="pt-3 space-y-2.5 mt-2" style={{ borderTop: `1px solid ${C.divider}` }}>
                    <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: C.faint }}>Add Field</p>
                    {newFieldType !== 'description' && (
                      <input
                        type="text"
                        placeholder="Field label…"
                        value={newFieldLabel}
                        onChange={e => setNewFieldLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddField()}
                        className={inputCls}
                        style={inputStyle}
                      />
                    )}
                    <select value={newFieldType} onChange={e => { setNewFieldType(e.target.value as FieldType); }} className={inputCls} style={inputStyle}>
                      {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>

                    {/* Conditional extras */}
                    {newFieldType === 'select' && (
                      <input type="text" placeholder="Options: Yes, No, Maybe" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} className={inputCls} style={inputStyle} />
                    )}
                    {newFieldType === 'social' && (
                      <div>
                        <label className={labelCls} style={labelStyle}>Platforms to include</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {SOCIAL_PLATFORMS.map(p => (
                            <label key={p.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors" style={{ background: newSocialPlatforms.includes(p.id) ? `${accentColor}18` : C.input, border: `1px solid ${newSocialPlatforms.includes(p.id) ? accentColor : C.inputBorder}`, color: newSocialPlatforms.includes(p.id) ? accentColor : C.muted }}>
                              <input type="checkbox" checked={newSocialPlatforms.includes(p.id)} onChange={e => { if (e.target.checked) setNewSocialPlatforms(prev => [...prev, p.id]); else setNewSocialPlatforms(prev => prev.filter(id => id !== p.id)); }} className="hidden" />
                              <SocialIcon id={p.id} size={14} />
                              <span className="text-xs font-medium">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Required toggle -- not shown for description blocks */}
                    {newFieldType !== 'description' && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs" style={{ color: C.muted }}>Mark as required?</span>
                        <Toggle checked={newFieldRequired} onChange={() => setNewFieldRequired(!newFieldRequired)} accentColor={accentColor} />
                      </div>
                    )}

                    <button type="button" onClick={handleAddField} disabled={newFieldType !== 'description' && !newFieldLabel.trim()} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80" style={{ background: accentColor, color: C.ctaText }}>
                      <Plus className="w-4 h-4" /> {newFieldType === 'description' ? 'Add Description Block' : 'Add Field'}
                    </button>
                  </div>
                </div>
              )}
            </EditorSection>

            {formConfig.isCourse && (
            <EditorSection title="Points & Rewards" defaultOpen={false}>
              <div className="space-y-3">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={labelCls} style={{ ...labelStyle, marginBottom: 0 }}>Enable points system</p>
                    <p className="text-[10px] mt-0.5" style={{ color: C.faint }}>Gamify your course with XP, streaks & rewards</p>
                  </div>
                  <SwitchToggle
                    checked={formConfig.pointsSystem?.enabled ?? false}
                    onChange={v => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, enabled: v } })}
                    accentColor={accentColor}
                  />
                </div>

                {formConfig.pointsSystem?.enabled && (
                  <>
                    {/* Base points */}
                    <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                      <div className="flex items-center justify-between">
                        <label className={`${labelCls} mb-0`} style={labelStyle}>Base points per question</label>
                        <span className="text-xs font-semibold" style={{ color: accentColor }}>{formConfig.pointsSystem?.basePoints ?? 100} pts</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {[50, 100, 200, 500].map(n => (
                          <button key={n} type="button"
                            onClick={() => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, basePoints: n } })}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={(formConfig.pointsSystem?.basePoints ?? 100) === n ? { background: accentColor, color: 'white' } : { background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.muted }}
                          >{n}</button>
                        ))}
                      </div>
                    </div>

                    {/* Time bonus */}
                    <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                      <div className="flex items-center justify-between">
                        <label className={`${labelCls} mb-0`} style={labelStyle}>Time bonus</label>
                        <SwitchToggle
                          checked={formConfig.pointsSystem?.timeBonusEnabled ?? true}
                          onChange={v => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, timeBonusEnabled: v } })}
                          accentColor={accentColor}
                        />
                      </div>
                      {(formConfig.pointsSystem?.timeBonusEnabled ?? true) && (
                        <div className="space-y-2">
                          <div className="flex gap-2 items-center">
                            <label className={`${labelCls} mb-0 flex-1`} style={labelStyle}>Within (seconds)</label>
                            <input type="number" min="3" max="60"
                              value={formConfig.pointsSystem?.timeBonusSeconds ?? 10}
                              onChange={e => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, timeBonusSeconds: Number(e.target.value) } })}
                              className={`${inputCls} w-20 py-1.5`} style={inputStyle}
                            />
                          </div>
                          <div className="flex gap-2 items-center">
                            <label className={`${labelCls} mb-0 flex-1`} style={labelStyle}>Multiplier</label>
                            <select
                              value={formConfig.pointsSystem?.timeBonusMultiplier ?? 1.5}
                              onChange={e => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, timeBonusMultiplier: Number(e.target.value) } })}
                              className={`${inputCls} w-24 py-1.5`} style={inputStyle}
                            >
                              {[1.2, 1.5, 2.0, 3.0].map(m => <option key={m} value={m}>{m}x</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Streak bonus */}
                    <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                      <div className="flex items-center justify-between">
                        <label className={`${labelCls} mb-0`} style={labelStyle}>Hot streak bonus</label>
                        <SwitchToggle
                          checked={formConfig.pointsSystem?.streakEnabled ?? true}
                          onChange={v => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, streakEnabled: v } })}
                          accentColor={accentColor}
                        />
                      </div>
                      {(formConfig.pointsSystem?.streakEnabled ?? true) && (
                        <div className="space-y-2">
                          <div className="flex gap-2 items-center">
                            <label className={`${labelCls} mb-0 flex-1`} style={labelStyle}>Trigger after N correct</label>
                            <input type="number" min="2" max="10"
                              value={formConfig.pointsSystem?.streakCount ?? 3}
                              onChange={e => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, streakCount: Number(e.target.value) } })}
                              className={`${inputCls} w-20 py-1.5`} style={inputStyle}
                            />
                          </div>
                          <div className="flex gap-2 items-center">
                            <label className={`${labelCls} mb-0 flex-1`} style={labelStyle}>Bonus points</label>
                            <input type="number" min="10" max="500"
                              value={formConfig.pointsSystem?.streakBonus ?? 50}
                              onChange={e => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, streakBonus: Number(e.target.value) } })}
                              className={`${inputCls} w-20 py-1.5`} style={inputStyle}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hint penalty */}
                    <div className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                      <div className="flex items-center justify-between">
                        <label className={`${labelCls} mb-0`} style={labelStyle}>Hint cost (points)</label>
                        <span className="text-xs font-semibold text-rose-500">-{formConfig.pointsSystem?.hintPenalty ?? 20} pts</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {[10, 20, 50, 100].map(n => (
                          <button key={n} type="button"
                            onClick={() => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, hintPenalty: n } })}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={(formConfig.pointsSystem?.hintPenalty ?? 20) === n ? { background: accentColor, color: 'white' } : { background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.muted }}
                          >{n}</button>
                        ))}
                      </div>
                    </div>

                    {/* Milestones */}
                    <div className="space-y-2">
                      <label className={labelCls} style={labelStyle}>Reward milestones</label>
                      {(formConfig.pointsSystem?.milestones ?? []).map((m, i) => (
                        <div key={m.id} className="p-3 rounded-xl space-y-2" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold" style={{ color: accentColor }}>{m.points} pts</span>
                            <button type="button"
                              onClick={() => updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, milestones: (formConfig.pointsSystem?.milestones ?? []).filter((_, j) => j !== i) } })}
                              className="transition-colors hover:text-red-400" style={{ color: C.faint }}
                            ><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <input type="number" placeholder="Points threshold"
                            value={m.points}
                            onChange={e => {
                              const ms = [...(formConfig.pointsSystem?.milestones ?? [])];
                              ms[i] = { ...ms[i], points: Number(e.target.value) };
                              updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, milestones: ms } });
                            }}
                            className={`${inputCls} py-1.5`} style={inputStyle}
                          />
                          <input type="text" placeholder="Label (e.g. SQL Cheat Sheet)"
                            value={m.label}
                            onChange={e => {
                              const ms = [...(formConfig.pointsSystem?.milestones ?? [])];
                              ms[i] = { ...ms[i], label: e.target.value };
                              updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, milestones: ms } });
                            }}
                            className={`${inputCls} py-1.5`} style={inputStyle}
                          />
                          <input type="text" placeholder="Description (e.g. Downloadable cheat sheet)"
                            value={m.description}
                            onChange={e => {
                              const ms = [...(formConfig.pointsSystem?.milestones ?? [])];
                              ms[i] = { ...ms[i], description: e.target.value };
                              updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, milestones: ms } });
                            }}
                            className={`${inputCls} py-1.5`} style={inputStyle}
                          />
                          <input type="url" placeholder="Reward URL (optional)"
                            value={m.rewardUrl ?? ''}
                            onChange={e => {
                              const ms = [...(formConfig.pointsSystem?.milestones ?? [])];
                              ms[i] = { ...ms[i], rewardUrl: e.target.value };
                              updateConfig({ pointsSystem: { ...defaultPoints, ...formConfig.pointsSystem, milestones: ms } });
                            }}
                            className={`${inputCls} py-1.5`} style={inputStyle}
                          />
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => updateConfig({
                          pointsSystem: {
                            ...defaultPoints, ...formConfig.pointsSystem,
                            milestones: [...(formConfig.pointsSystem?.milestones ?? []), { id: Date.now().toString(), points: 500, label: '', description: '', rewardUrl: '' }]
                          }
                        })}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-colors hover:opacity-70"
                        style={{ border: `1.5px dashed ${C.inputBorder}`, color: C.muted }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add milestone
                      </button>
                    </div>
                  </>
                )}
              </div>
            </EditorSection>
            )}

            <EditorSection title="After Submission" defaultOpen={false}>
              <div className="space-y-3">
                {/* Type selector */}
                <div>
                  <label className={labelCls} style={labelStyle}>What happens after submission</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { value: 'default', label: 'Thank you' },
                      { value: 'redirect', label: 'Redirect URL' },
                      { value: 'button', label: 'CTA Button' },
                      { value: 'events', label: 'Show Events' },
                      { value: 'notice', label: 'Notice' },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateConfig({ postSubmission: { ...formConfig.postSubmission, type: value } as any })}
                        className="py-2 rounded-lg text-xs font-medium transition-all"
                        style={(formConfig.postSubmission?.type ?? 'default') === value ? { background: accentColor, color: 'white' } : { background: C.input, border: `1px solid ${C.inputBorder}`, color: C.muted }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Redirect URL */}
                {(formConfig.postSubmission?.type === 'redirect') && (
                  <div>
                    <label className={labelCls} style={labelStyle}>Redirect URL</label>
                    <input
                      type="url"
                      value={formConfig.postSubmission?.redirectUrl || ''}
                      onChange={e => updateConfig({ postSubmission: { ...formConfig.postSubmission, type: 'redirect', redirectUrl: e.target.value } })}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="https://yourwebsite.com/thank-you"
                    />
                    <p className="text-[10px] mt-1" style={{ color: C.faint }}>Users will be automatically redirected after submitting.</p>
                  </div>
                )}

                {/* CTA Button */}
                {(formConfig.postSubmission?.type === 'button') && (
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls} style={labelStyle}>Button label</label>
                      <input
                        type="text"
                        value={formConfig.postSubmission?.buttonLabel || ''}
                        onChange={e => updateConfig({ postSubmission: { ...formConfig.postSubmission, type: 'button', buttonLabel: e.target.value } })}
                        className={inputCls}
                        style={inputStyle}
                        placeholder="e.g. Join our community"
                      />
                    </div>
                    <div>
                      <label className={labelCls} style={labelStyle}>Button URL</label>
                      <input
                        type="url"
                        value={formConfig.postSubmission?.buttonUrl || ''}
                        onChange={e => updateConfig({ postSubmission: { ...formConfig.postSubmission, type: 'button', buttonUrl: e.target.value } })}
                        className={inputCls}
                        style={inputStyle}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}

                {/* Show Programs */}
                {(formConfig.postSubmission?.type === 'events') && (
                  <div className="space-y-2">
                    <label className={labelCls} style={labelStyle}>Select courses/events to show</label>
                    {availableForms.length === 0 ? (
                      <p className="text-[11px] py-2" style={{ color: C.faint }}>No other courses or events found.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {availableForms.map(f => {
                          const selected = (formConfig.postSubmission?.relatedEventIds || []).includes(f.id);
                          return (
                            <label key={f.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:opacity-80" style={{ background: selected ? `${accentColor}18` : C.input, border: `1px solid ${selected ? accentColor : C.inputBorder}` }}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  const current = formConfig.postSubmission?.relatedEventIds || [];
                                  const next = selected ? current.filter(id => id !== f.id) : [...current, f.id];
                                  updateConfig({ postSubmission: { ...formConfig.postSubmission, type: 'events', relatedEventIds: next } });
                                }}
                                className="w-3.5 h-3.5 rounded"
                                style={{ accentColor: accentColor }}
                              />
                              <span className="text-xs truncate flex-1" style={{ color: C.text }}>{(f as any).config?.title || f.title || f.slug}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: (f as any)._type === 'course' ? '#3b82f620' : '#8b5cf620', color: (f as any)._type === 'course' ? '#3b82f6' : '#8b5cf6' }}>
                                {(f as any)._type === 'course' ? 'Course' : 'Event'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Notice */}
                {(formConfig.postSubmission?.type === 'notice') && (
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls} style={labelStyle}>Notice title</label>
                      <input
                        type="text"
                        value={formConfig.postSubmission?.noticeTitle || ''}
                        onChange={e => updateConfig({ postSubmission: { ...formConfig.postSubmission, type: 'notice', noticeTitle: e.target.value } })}
                        className={inputCls}
                        style={inputStyle}
                        placeholder="What's next?"
                      />
                    </div>
                    <div>
                      <label className={labelCls} style={labelStyle}>Notice message</label>
                      <textarea
                        value={formConfig.postSubmission?.noticeBody || ''}
                        onChange={e => updateConfig({ postSubmission: { ...formConfig.postSubmission, type: 'notice', noticeBody: e.target.value } })}
                        className={`${inputCls} min-h-[80px] resize-y`}
                        style={inputStyle}
                        placeholder="e.g. We'll review your submission and get back to you within 48 hours."
                      />
                    </div>
                  </div>
                )}
              </div>
            </EditorSection>

          </div>
        </aside>

        {/* -- Right Preview Panel -- */}
        <div className="hidden md:block flex-1 overflow-y-auto" style={{ background: C.page }}>
          <div className="px-8 py-4" style={{ borderBottom: `1px solid ${C.cardBorder}`, background: C.nav }}>
            <form onSubmit={handleGenerate} className="flex items-center gap-3 max-w-2xl mx-auto">
              <input
                type="text"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Refine your form… e.g. add a company field"
                className="flex-1 rounded-lg px-4 py-2 text-sm outline-none transition-colors placeholder:text-[#bbb]"
                style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }}
                disabled={isGenerating}
              />
              <button type="submit" disabled={isGenerating || !prompt.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80" style={{ background: C.cta, color: C.ctaText }}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? 'Generating…' : 'Regenerate'}
              </button>
            </form>
          </div>

          {/* Share bar -- appears after publishing */}
          <AnimatePresence>
            {savedFormId && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="px-8 py-3"
                style={{ borderBottom: `1px solid ${C.cardBorder}`, background: `${accentColor}14` }}
              >
                <div className="max-w-2xl mx-auto flex items-center gap-3 flex-wrap">
                  {/* Published indicator + URL */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0" style={{ color: accentColor }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
                      Published
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: C.faint }}>·</span>
                    <code className="text-xs truncate" style={{ color: C.muted }}>
                      {typeof window !== 'undefined' ? window.location.origin : ''}/{customSlug || savedFormId}
                    </code>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Copy link */}
                    <button
                      type="button"
                      onClick={() => handleShare()}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
                      style={{ background: accentColor, color: C.ctaText }}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>

                    {/* Social share buttons */}
                    {[
                      {
                        id: 'twitter', label: 'X',
                        href: () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${formConfig.title}\n${formConfig.description.replace(/<[^>]*>/g, '')}`)}&url=${encodeURIComponent(`${window.location.origin}/${customSlug || savedFormId}`)}`,
                      },
                      {
                        id: 'linkedin', label: 'LinkedIn',
                        href: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/${customSlug || savedFormId}`)}`,
                      },
                      {
                        id: 'facebook', label: 'Facebook',
                        href: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/${customSlug || savedFormId}`)}`,
                      },
                      {
                        id: 'whatsapp', label: 'WhatsApp',
                        href: () => `https://wa.me/?text=${encodeURIComponent(`${formConfig.title}\n${formConfig.description.replace(/<[^>]*>/g, '')}\n\n${window.location.origin}/${customSlug || savedFormId}`)}`,
                      },
                    ].map(({ id, label, href }) => (
                      <a
                        key={id}
                        href={href()}
                        target="_blank"
                        rel="noreferrer"
                        title={`Share on ${label}`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                        style={{ background: C.pill, border: `1px solid ${C.cardBorder}` }}
                      >
                        {id === 'whatsapp' ? (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        ) : (
                          <SocialIcon id={id} size={14} />
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className={savedFormId ? '' : 'px-8 py-12'}>
            {savedFormId ? (
              /* Live iframe after publish -- always accurate */
              <iframe
                key={previewKey}
                src={`/${customSlug || savedFormId}`}
                title="Live preview"
                style={{ display: 'block', width: '100%', height: 'calc(100vh - 120px)', border: 'none' }}
              />
            ) : formConfig.eventDetails?.isEvent ? (
              /* Event placeholder -- full preview available in the editor after publishing */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 32px', textAlign: 'center', opacity: 0.5 }}>
                <CalendarDays style={{ width: 36, height: 36, color: C.muted }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Event preview</p>
                <p style={{ fontSize: 12, color: C.faint, margin: 0, maxWidth: 260, lineHeight: 1.6 }}>
                  Publish your event to open the full live preview in the editor, including speakers, design, and mode.
                </p>
              </div>
            ) : (
              /* FormPreview for regular forms before publishing */
              <AnimatePresence mode="wait">
                <FormPreview
                  key={formConfig.title}
                  config={formConfig}
                  isSubmitting={isSubmitting}
                  onSubmit={handleSubmitForm}
                  isSuccess={isSuccess}
                  onReset={() => setIsSuccess(false)}
                  isSharedView={false}
                />
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
      <GeneratingOverlay visible={isGenerating || !!aiLoadingLabel} label={aiLoadingLabel || (isGenerating ? 'Generating your form' : undefined)} failed={aiFailed} />
      <AnimatePresence>
        {descriptionModalOpen && formConfig?.isCourse && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={() => setDescriptionModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-lg rounded-3xl p-5 sm:p-6"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>Generate Course Description</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: C.faint }}>
                    Pick the tone, length, and any extra direction you want the AI to follow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDescriptionModalOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.faint }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} style={labelStyle}>Style</label>
                    <select
                      value={aiDescriptionStyle}
                      onChange={e => setAiDescriptionStyle(e.target.value as 'professional' | 'casual' | 'friendly')}
                      className={`${inputCls} py-1.5`}
                      style={inputStyle}
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Length</label>
                    <select
                      value={aiDescriptionLength}
                      onChange={e => setAiDescriptionLength(e.target.value as 'short' | 'medium' | 'long')}
                      className={`${inputCls} py-1.5`}
                      style={inputStyle}
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Extra instructions</label>
                  <textarea
                    value={aiDescriptionPrompt}
                    onChange={e => setAiDescriptionPrompt(e.target.value)}
                    className={`${inputCls} min-h-[96px] resize-y`}
                    style={inputStyle}
                    placeholder="Optional: mention the audience, outcomes to emphasize, or the exact vibe you want."
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDescriptionModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={generateCourseDescription}
                    disabled={!!aiLoadingLabel}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                    style={{ background: accentColor, color: C.ctaText }}
                  >
                    {aiLoadingLabel === 'Generating course description...' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Description
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {eventAssistantOpen && formConfig?.eventDetails?.isEvent && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={() => setEventAssistantOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-xl rounded-3xl p-5 sm:p-6"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>AI Event Assistant</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: C.faint }}>
                    Describe the event and AI will fill the setup, suggest registration fields, and draft a confirmation notice.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEventAssistantOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.faint }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Event brief</label>
                  <textarea
                    value={eventAssistantPrompt}
                    onChange={e => setEventAssistantPrompt(e.target.value)}
                    className={`${inputCls} min-h-[140px] resize-y`}
                    style={inputStyle}
                    placeholder="Example: Create a virtual workshop for beginner creators on how to pitch brands next Thursday at 6pm WAT. Keep it friendly, collect name, email, niche, and Instagram handle, and write a strong confirmation message."
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEventAssistantOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={generateEventSetup}
                    disabled={!!aiLoadingLabel}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                    style={{ background: accentColor, color: C.ctaText }}
                  >
                    {aiLoadingLabel === 'Generating event setup...' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Event Setup
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- Toast notification -- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 max-w-sm w-[calc(100%-2rem)] rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-xl"
            style={{
              background: C.card,
              border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.25)' : toast.type === 'success' ? 'rgba(16,185,129,0.25)' : C.cardBorder}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          >
            <div className="w-2 self-stretch rounded-full flex-shrink-0 mt-0.5"
              style={{ background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6' }}
            />
            <p className="text-sm leading-snug flex-1" style={{ color: C.text }}>{toast.message}</p>
            <button onClick={() => setToast(null)} className="flex-shrink-0 mt-0.5 hover:opacity-60 transition-opacity" style={{ color: C.faint }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Lesson Prompt Modal */}
      <AnimatePresence>
        {lessonPromptModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setLessonPromptModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>Generate AI Lesson</p>
                  <p className="text-xs mt-0.5" style={{ color: C.faint }}>
                    {lessonPromptModal.q.lessonOnly
                      ? 'Describe what this lesson should teach.'
                      : 'Add custom instructions, or leave blank to generate from the question.'}
                  </p>
                </div>
                <button type="button" onClick={() => setLessonPromptModal(null)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                {!lessonPromptModal.q.lessonOnly && lessonPromptModal.q.question && (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{ background: C.input, border: `1px solid ${C.inputBorder}`, color: C.muted }}>
                    <span className="font-semibold" style={{ color: C.faint }}>Question: </span>{lessonPromptModal.q.question}
                  </div>
                )}
                <div>
                  <label className={labelCls} style={labelStyle}>
                    {lessonPromptModal.q.lessonOnly ? 'Topic / Instructions' : 'Custom Instructions'} <span style={{ color: C.faint, fontWeight: 400, textTransform: 'none' }}>{lessonPromptModal.q.lessonOnly ? '' : '(optional)'}</span>
                  </label>
                  <textarea
                    autoFocus
                    rows={5}
                    value={lessonPrompts[lessonPromptModal.q.id] ?? ''}
                    onChange={e => setLessonPrompts(prev => ({ ...prev, [lessonPromptModal!.q.id]: e.target.value }))}
                    placeholder={lessonPromptModal.q.lessonOnly
                      ? 'e.g. Explain the water cycle for secondary school students, include real-world examples…'
                      : 'e.g. Focus on common misconceptions, use analogies, keep it beginner-friendly…'}
                    className={`${inputCls} resize-none`}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
                <button type="button" onClick={() => setLessonPromptModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: C.pill, border: `1px solid ${C.inputBorder}`, color: C.muted }}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!!aiLoadingLabel}
                  onClick={() => {
                    const q = lessonPromptModal.q;
                    setLessonPromptModal(null);
                    generateQuestionAsset(q, 'generate_lesson');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: accentColor, color: C.ctaText }}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate Lesson
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bunny Video Picker Modal */}
      <AnimatePresence>
        {bunnyPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setBunnyPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
              style={{ background: C.card, border: `1px solid ${C.cardBorder}`, maxHeight: '82vh' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#FF6B35' }}>
                    <Video className="w-3.5 h-3.5 text-white"/>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: C.text }}>Pick from Bunny Library</span>
                </div>
                <button onClick={() => setBunnyPickerOpen(false)} style={{ color: C.faint }}><X className="w-4 h-4"/></button>
              </div>

              {/* Search */}
              <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl" style={{ background: C.input, border: `1px solid ${C.inputBorder}` }}>
                    <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.faint }}/>
                    <input
                      type="text"
                      value={bunnySearch}
                      onChange={e => setBunnySearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && openBunnyPicker(bunnyPickerQId!, bunnySearch, bunnyCollection)}
                      placeholder="Search videos..."
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: C.text }}
                    />
                  </div>
                  <button
                    onClick={() => openBunnyPicker(bunnyPickerQId!, bunnySearch, bunnyCollection)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: '#FF6B35', color: 'white' }}
                  >Search</button>
                </div>
              </div>

              {/* Body: collections sidebar + video grid */}
              <div className="flex flex-1 overflow-hidden">
                {/* Collections sidebar */}
                {bunnyCollections.length > 0 && (
                  <div className="w-44 flex-shrink-0 overflow-y-auto py-2" style={{ borderRight: `1px solid ${C.cardBorder}` }}>
                    <button
                      onClick={() => { setBunnyCollection(''); openBunnyPicker(bunnyPickerQId!, bunnySearch, ''); }}
                      className="w-full text-left px-4 py-2 text-xs font-medium transition-colors"
                      style={{ background: bunnyCollection === '' ? `${C.green}18` : 'transparent', color: bunnyCollection === '' ? C.green : C.muted }}
                    >
                      All videos
                    </button>
                    {bunnyCollections.map(col => (
                      <button
                        key={col.guid}
                        onClick={() => { setBunnyCollection(col.guid); openBunnyPicker(bunnyPickerQId!, bunnySearch, col.guid); }}
                        className="w-full text-left px-4 py-2 text-xs transition-colors"
                        style={{ background: bunnyCollection === col.guid ? `${C.green}18` : 'transparent', color: bunnyCollection === col.guid ? C.green : C.muted }}
                      >
                        <span className="block font-medium truncate">{col.name}</span>
                        <span className="text-[10px]" style={{ color: C.faint }}>{col.videoCount} videos</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Video grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {bunnyLoading && (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.faint }}/>
                    </div>
                  )}
                  {bunnyError && !bunnyLoading && (
                    <div className="text-center py-10 text-sm" style={{ color: '#ef4444' }}>{bunnyError}</div>
                  )}
                  {!bunnyLoading && !bunnyError && bunnyVideos.length === 0 && (
                    <div className="text-center py-10 text-sm" style={{ color: C.faint }}>No videos found.</div>
                  )}
                  {!bunnyLoading && !bunnyError && bunnyVideos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {bunnyVideos.map(v => (
                        <button
                          key={v.guid}
                          onClick={() => selectBunnyVideo(v.embedUrl)}
                          className="text-left rounded-xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg group"
                          style={{ border: `1px solid ${C.cardBorder}`, background: C.input }}
                        >
                          <div className="relative aspect-video bg-black overflow-hidden">
                            {v.thumbnail
                              ? <img src={v.thumbnail} alt={v.title}
                                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex'; }}
                                />
                              : null}
                            <div className="w-full h-full items-center justify-center" style={{ display: v.thumbnail ? 'none' : 'flex' }}>
                              <Video className="w-6 h-6 opacity-30" style={{ color: C.faint }}/>
                            </div>
                            {v.status !== 4 && (
                              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                                <span className="text-xs text-white font-medium">Processing...</span>
                              </div>
                            )}
                            {v.duration > 0 && (
                              <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(0,0,0,0.75)', color: 'white' }}>
                                {Math.floor(v.duration / 60)}:{String(v.duration % 60).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          <div className="px-2.5 py-2">
                            <p className="text-xs font-medium line-clamp-2 leading-snug" style={{ color: C.text }}>{v.title}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
