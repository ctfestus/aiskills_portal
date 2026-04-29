import { NextResponse } from 'next/server';
import { cloudinary } from '@/lib/cloudinary-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await (cloudinary.search as any)
      .expression('folder:tools-icons')
      .with_field('tags')
      .max_results(200)
      .execute();

    console.log('[tool-assets] total:', result.total_count, 'resources:', result.resources?.length);

    const map: Record<string, string> = {};
    for (const asset of result.resources ?? []) {
      const raw = (asset.public_id as string)
        .replace(/^tools-icons\//, '')
        .replace(/^.*\//, ''); // strip any nested path

      const url = (asset.secure_url as string).replace('/upload/', '/upload/f_auto,q_auto,w_64/');

      const lower     = raw.toLowerCase();
      const noHyphens = lower.replace(/-/g, ' ');
      const noSpaces  = lower.replace(/ /g, '-');
      const noUnder   = lower.replace(/_/g, ' ');

      map[lower]     = url;
      map[noHyphens] = url;
      map[noSpaces]  = url;
      map[noUnder]   = url;
    }

    return NextResponse.json(map);
  } catch (err) {
    console.error('[tool-assets]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
