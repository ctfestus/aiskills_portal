import { redirect } from 'next/navigation';

export default async function OpenCertRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/credential/${id}`);
}
