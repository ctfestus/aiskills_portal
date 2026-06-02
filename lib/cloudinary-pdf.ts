/**
 * Helpers for rendering Cloudinary-hosted PDFs as page images.
 *
 * Cloudinary stores PDFs as multi-page "image" assets, so an individual page
 * can be delivered as a JPG via the `pg_<n>` transformation. We use this to
 * build a LinkedIn-style page carousel out of plain <img> slides -- no
 * client-side PDF engine required.
 */

/**
 * Build the delivery URL for a single page of a Cloudinary PDF, as a JPG.
 * Rasterises at higher density (`dn_300`) so the page stays sharp instead of
 * being upscaled from Cloudinary's ~150dpi default. Builds a single clean
 * transform (stripping any stored `f_auto,q_auto`) to avoid quality loss.
 */
export function pdfPageImageUrl(pdfUrl: string, page: number, width = 2000): string {
  const marker = '/upload/';
  const i = pdfUrl.indexOf(marker);
  if (i === -1) return pdfUrl;
  const head = pdfUrl.slice(0, i + marker.length);
  let tail = pdfUrl.slice(i + marker.length);
  // Drop a leading transformation segment (e.g. "f_auto,q_auto/") if present.
  const slash = tail.indexOf('/');
  const firstSeg = slash === -1 ? '' : tail.slice(0, slash);
  if (firstSeg && (firstSeg.includes(',') || /^(f|q|w|h|c|pg|fl|dpr|e|g|x|y|dn)_/.test(firstSeg))) {
    tail = tail.slice(slash + 1);
  }
  return `${head}pg_${page},dn_300,w_${width},c_limit,f_auto,q_auto/${tail}`.replace(/\.pdf(\?|#|$)/i, '.jpg$1');
}

/**
 * Build a URL that downloads the ORIGINAL PDF (all pages), not a rasterised
 * image. Strips any leading transformation (e.g. `f_auto,q_auto`, which would
 * flatten the PDF to a single image) and forces a file download via
 * `fl_attachment`.
 */
export function pdfDownloadUrl(pdfUrl: string): string {
  const marker = '/upload/';
  const i = pdfUrl.indexOf(marker);
  if (i === -1) return pdfUrl;
  const head = pdfUrl.slice(0, i + marker.length);
  let tail = pdfUrl.slice(i + marker.length);
  const slash = tail.indexOf('/');
  const firstSeg = slash === -1 ? '' : tail.slice(0, slash);
  // Drop a leading transformation segment so the untouched PDF is delivered.
  if (firstSeg && (firstSeg.includes(',') || /^(f|q|w|h|c|pg|fl|dpr|e|g|x|y)_/.test(firstSeg))) {
    tail = tail.slice(slash + 1);
  }
  return head + 'fl_attachment/' + tail;
}

/** True when the file looks like a PDF, by MIME type or extension. */
export const isPdfFile = (name?: string, type?: string): boolean =>
  type === 'application/pdf' || (!!name && /\.pdf$/i.test(name));
