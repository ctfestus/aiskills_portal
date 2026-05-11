"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import OpenCertPageClient from "../../open-cert/[id]/OpenCertPageClient";
import { CertificateSettings, DEFAULT_CERT_SETTINGS } from "@/components/CertificateTemplate";
import { Loader2 } from "lucide-react";

export default function CredentialPage() {
  const { id } = useParams();
  const [state, setState] = useState<"loading" | "revoked" | "notfound" | "ready">("loading");
  type IssueMode = 'certificate_only' | 'badge_only' | 'both';
  const [certData, setCertData] = useState<{
    certId:        string;
    recipientName: string;
    programName:   string;
    issuedDate:    string;
    issuedAt:      string;
    settings:      CertificateSettings;
    description:   string | null;
    skills:        string[];
    badgeImageUrl: string | null;
    issueMode:     IssueMode;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const res  = await fetch(`/api/open-cert/${id}`);
      if (res.status === 404) { setState("notfound"); return; }
      const data = await res.json();
      if (!res.ok)      { setState("notfound"); return; }
      if (data.revoked) { setState("revoked");  return; }
      setCertData({
        certId:        data.certId,
        recipientName: data.recipientName,
        programName:   data.programName,
        issuedDate:    data.issuedDate,
        issuedAt:      data.issuedAt,
        settings:      data.settings ?? DEFAULT_CERT_SETTINGS,
        description:   data.description ?? null,
        skills:        data.skills      ?? [],
        badgeImageUrl: data.badgeImageUrl ?? null,
        issueMode:     data.issueMode   ?? 'certificate_only',
      });
      setState("ready");
    };
    load();
  }, [id]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (state === "revoked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-sm">
          <div className="text-5xl mb-4">Revoked</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Credential Revoked</h1>
          <p className="text-gray-500 text-sm">This credential has been revoked by the issuer.</p>
        </div>
      </div>
    );
  }

  if (state === "notfound" || !certData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-sm">
          <div className="text-5xl mb-4">Not found</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Credential Not Found</h1>
          <p className="text-gray-500 text-sm">This credential ID does not exist.</p>
        </div>
      </div>
    );
  }

  return <OpenCertPageClient {...certData} />;
}
