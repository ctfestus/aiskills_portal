"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CertificatePageClient from "./CertificatePageClient";
import { CertificateSettings, DEFAULT_CERT_SETTINGS } from "@/components/CertificateTemplate";
import { Loader2 } from "lucide-react";

export default function CertificatePage() {
  const { id } = useParams();
  const [state, setState] = useState<"loading" | "revoked" | "notfound" | "ready">("loading");
  const [certData, setCertData] = useState<{
    certId: string;
    studentName: string;
    courseName: string;
    issueDate: string;
    settings: CertificateSettings;
    issuedAt: string;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/certificate/${id}`);

      if (res.status === 404) { setState("notfound"); return; }

      const data = await res.json();

      if (!res.ok)       { setState("notfound"); return; }
      if (data.revoked)  { setState("revoked");  return; }

      setCertData({
        certId:      data.certId,
        studentName: data.studentName,
        courseName:  data.courseName,
        issueDate:   data.issueDate,
        settings:    data.settings ?? DEFAULT_CERT_SETTINGS,
        issuedAt:    data.issuedAt,
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
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Certificate Revoked</h1>
          <p className="text-gray-500 text-sm">This certificate has been revoked by the issuer.</p>
        </div>
      </div>
    );
  }

  if (state === "notfound" || !certData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Certificate Not Found</h1>
          <p className="text-gray-500 text-sm">This certificate ID does not exist.</p>
        </div>
      </div>
    );
  }

  return <CertificatePageClient {...certData} />;
}
