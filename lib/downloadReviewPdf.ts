export async function downloadReviewPdf(el: HTMLElement, filename: string): Promise<void> {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF }   = await import('jspdf');

    const canvas  = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, logging: false });
    let imgData: string;
    try {
      imgData = canvas.toDataURL('image/png');
    } catch {
      throw new Error('PDF export failed: the review contains cross-origin images that cannot be captured. Try downloading from a different browser.');
    }

    // A4 dimensions in px at 96 dpi
    const pageW    = 794;
    const pageH    = 1123;
    const margin   = 36;
    const contentW = pageW - margin * 2;
    const ratio    = contentW / (canvas.width / 2);
    const scaledH  = (canvas.height / 2) * ratio;
    const contentH = pageH - margin * 2;

    const pdf = new jsPDF({ unit: 'px', format: [pageW, pageH] });

    let yOffset = 0;
    let page    = 0;

    while (yOffset < scaledH) {
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, margin - yOffset, contentW, scaledH);
      yOffset += contentH;
      page++;
    }

    pdf.save(filename);
  } catch (err: any) {
    throw new Error(err?.message ?? 'PDF export failed. Please try again.');
  }
}
