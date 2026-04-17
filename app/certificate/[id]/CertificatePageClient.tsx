"use client";

import { useRef, useState, useEffect } from "react";
import CertificateTemplate, { CertificateSettings } from "@/components/CertificateTemplate";
import { Download, Loader2, Check, Link as LinkIcon } from "lucide-react";

const CERT_W = 1860;
const CERT_H = 1200;

interface Props {
  certId:          string;
  studentName:     string;
  courseName:      string;
  issueDate:       string;
  settings:        CertificateSettings;
  issuedAt:        string;
  certType:        'course' | 'virtual_experience' | 'learning_path';
  pathItems?:      { id: string; title: string; coverImage: string | null }[];
  pathCoverImage?: string | null;
}

const CERT_TYPE_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  course:             { label: 'Course',            bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  virtual_experience: { label: 'Virtual Experience', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  learning_path:      { label: 'Learning Path',     bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
};

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22}>
      <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}


export default function CertificatePageClient({ certId, studentName, courseName, issueDate, settings, issuedAt, certType, pathItems, pathCoverImage }: Props) {
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Responsive scale -- recalculate on resize
  const [scale, setScale] = useState(0.38);
  useEffect(() => {
    const calc = () => {
      const availW = Math.min(window.innerWidth - 32, 720); // 16px padding each side, cap at 720
      setScale(availW / CERT_W);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const previewW = Math.round(CERT_W * scale);
  const previewH = Math.round(CERT_H * scale);

  const issueYear  = new Date(issuedAt).getFullYear();
  const issueMonth = new Date(issuedAt).getMonth() + 1;
  const certUrl    = typeof window !== "undefined" ? window.location.href : "";

  const handleDownload = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF }   = await import("jspdf");
      await document.fonts.ready;
      const canvas  = await html2canvas(certRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`certificate-${courseName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch {
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(certUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const linkedInUrl = certUrl
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(courseName)}&organizationName=${encodeURIComponent(settings.institutionName)}&issueYear=${issueYear}&issueMonth=${issueMonth}&certId=${encodeURIComponent(certId)}&certUrl=${encodeURIComponent(certUrl)}`
    : "#";


  return (
    <div className="min-h-screen bg-gray-50 pb-28 sm:pb-10">

      {/* -- Header -- */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Certificate of Completion</h1>
              {CERT_TYPE_BADGE[certType] ? (
                <span className="mt-1 inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: CERT_TYPE_BADGE[certType].bg,
                    color: CERT_TYPE_BADGE[certType].color,
                    border: `1px solid ${CERT_TYPE_BADGE[certType].border}`,
                  }}>
                  {CERT_TYPE_BADGE[certType].label}
                </span>
              ) : null}
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{courseName}</p>
            </div>
            {/* Desktop: download button in header */}
            <button onClick={handleDownload} disabled={downloading}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors flex-shrink-0">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Generating..." : "Download PDF"}
            </button>
          </div>

          {/* Share row -- visible on all screens */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-gray-400 font-medium">Share:</span>
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" title="Add to LinkedIn"
              className="hover:opacity-75 transition-opacity">
              <LinkedInIcon />
            </a>
            <button onClick={copyLink} title={copied ? "Copied!" : "Copy link"}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* -- Certificate preview -- */}
      <div className="flex flex-col items-center py-6 sm:py-10 px-4">
        {/* Verified badge + type badge */}
        <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200">
            ✓ Verified · ID: {certId.slice(0, 8).toUpperCase()}
          </span>
          {CERT_TYPE_BADGE[certType] ? (
            <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                background: CERT_TYPE_BADGE[certType].bg,
                color: CERT_TYPE_BADGE[certType].color,
                border: `1px solid ${CERT_TYPE_BADGE[certType].border}`,
              }}>
              {CERT_TYPE_BADGE[certType].label}
            </span>
          ) : null}
        </div>

        {/* Scaled certificate -- fills screen width on mobile */}
        <div style={{
          width: `${previewW}px`,
          height: `${previewH}px`,
          position: "relative",
          overflow: "hidden",
          borderRadius: "10px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.16)",
          flexShrink: 0,
        }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${CERT_W}px`, height: `${CERT_H}px` }}>
            <CertificateTemplate
              certId={certId}
              studentName={studentName}
              courseName={courseName}
              issueDate={issueDate}
              settings={settings}
            />
          </div>
        </div>

        {/* Meta */}
        <p className="mt-4 text-xs text-gray-400 text-center">
          Issued on {issueDate} · {settings.institutionName}
        </p>

        {/* Student name callout on mobile */}
        <div className="mt-4 sm:hidden text-center">
          <p className="text-sm font-bold text-gray-800">{studentName}</p>
          <p className="text-xs text-gray-500 mt-0.5">successfully completed</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">{courseName}</p>
        </div>

        {/* Learning path cover image + courses list */}
        {certType === 'learning_path' && (pathCoverImage || (pathItems && pathItems.length > 0)) && (
          <div className="mt-8 w-full" style={{ maxWidth: `${previewW}px` }}>
            {pathCoverImage && (
              <div className="mb-5 rounded-xl overflow-hidden" style={{ height: 160, boxShadow: '0 2px 12px rgba(0,0,0,0.10)' }}>
                <img src={pathCoverImage} alt={courseName} className="w-full h-full object-cover" />
              </div>
            )}
            {pathItems && pathItems.length > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Courses in this learning path</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pathItems.map((item, i) => (
                    <div key={item.id ?? i} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 overflow-hidden"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <div className="w-16 h-16 flex-shrink-0 overflow-hidden"
                        style={{ background: item.coverImage ? undefined : '#ede9fe' }}>
                        {item.coverImage
                          ? <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/>
                              </svg>
                            </div>}
                      </div>
                      <p className="text-sm font-medium text-gray-800 pr-3 leading-snug line-clamp-2">{item.title}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* -- Mobile sticky bottom bar -- */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {downloading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
            : <><Download className="w-4 h-4" /> Download Certificate</>
          }
        </button>
      </div>

      {/* -- Hidden full-size for PDF capture -- */}
      <div aria-hidden style={{ position: "fixed", top: 0, left: "-10000px", zIndex: -1 }}>
        <CertificateTemplate
          ref={certRef}
          certId={certId}
          studentName={studentName}
          courseName={courseName}
          issueDate={issueDate}
          settings={settings}
        />
      </div>
    </div>
  );
}
