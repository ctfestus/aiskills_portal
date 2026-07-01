import { loadCertReport } from '@/lib/cert-report';
import CertReportClient from './CertReportClient';

// Server component: the shareable performance report is fetched and rendered on the server (like the
// certificate page), so it appears in the initial HTML for links people open from LinkedIn etc.

function Notice({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-sm">
        <h1 className="text-xl font-bold text-gray-800 mb-2">{heading}</h1>
        <p className="text-gray-500 text-sm">{body}</p>
      </div>
    </div>
  );
}

export default async function CertReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCertReport(id);

  if (result.status === 'revoked') {
    return <Notice heading="Report unavailable" body="This certificate has been revoked by the issuer." />;
  }
  if (result.status === 'notfound') {
    return <Notice heading="Report not found" body="This report does not exist." />;
  }

  return <CertReportClient data={result.data} />;
}
