"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface BadgeData {
  studentName:      string;
  studentAvatarUrl: string | null;
  studentUsername:  string | null;
  badgeName:        string;
  badgeDescription: string;
  badgeImageUrl:    string | null;
  badgeIcon:        string;
  badgeColor:       string;
  awardedAt:        string;
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16}>
      <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function BadgePage() {
  const { id } = useParams() as { id: string };
  const [state, setState] = useState<"loading" | "notfound" | "ready">("loading");
  const [data, setData]   = useState<BadgeData | null>(null);

  useEffect(() => {
    fetch(`/api/b/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setState("ready"); })
      .catch(() => setState("notfound"));
  }, [id]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (state === "notfound" || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center p-8 max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Badge Not Found</h1>
          <p className="text-gray-500 text-sm">This badge does not exist or has not been earned.</p>
        </div>
      </div>
    );
  }

  const awardedDate  = new Date(data.awardedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const awardedYear  = new Date(data.awardedAt).getFullYear();
  const awardedMonth = new Date(data.awardedAt).getMonth() + 1;
  const pageUrl      = typeof window !== 'undefined' ? window.location.href : '';

  const initials = data.studentName
    .split(' ')
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');

  const liUrl = pageUrl
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(data.badgeName)}&issueYear=${awardedYear}&issueMonth=${awardedMonth}&certUrl=${encodeURIComponent(pageUrl)}&certId=${encodeURIComponent(id)}`
    : '#';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-12 sm:py-20">

        {/* Badge */}
        <div className="flex flex-col items-center text-center">
          <div
            className="w-48 h-48 rounded-3xl flex items-center justify-center mb-6"
            style={{ background: `${data.badgeColor}18`, boxShadow: `0 8px 40px ${data.badgeColor}30` }}
          >
            {data.badgeImageUrl
              ? <img src={data.badgeImageUrl} alt={data.badgeName} className="w-40 h-40 object-contain drop-shadow-lg" />
              : <span className="text-8xl leading-none">{data.badgeIcon}</span>
            }
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{data.badgeName}</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-xs leading-relaxed">{data.badgeDescription}</p>
          <p className="mt-3 text-xs text-gray-400">Awarded on {awardedDate}</p>
        </div>

        <div className="my-8 border-t border-gray-100" />

        {/* Student row */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-blue-600 flex items-center justify-center">
            {data.studentAvatarUrl
              ? <img src={data.studentAvatarUrl} alt={data.studentName} className="w-full h-full object-cover" />
              : <span className="text-white font-bold text-sm">{initials}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 leading-tight truncate">{data.studentName}</p>
            {data.studentUsername && (
              <a href={`/s/${data.studentUsername}`} className="text-xs text-blue-600 hover:underline">View Profile</a>
            )}
          </div>
          <a
            href={liUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <LinkedInIcon />
            Add to LinkedIn
          </a>
        </div>

      </div>
    </div>
  );
}
