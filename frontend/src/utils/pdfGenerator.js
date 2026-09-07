import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency } from './currencyFormatter';

export function generateInvoicePDF(invoice, customer, seller) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const currencyObj = seller?.currency || { symbol: '₹', code: 'INR' };

  // Color palette
  const primaryColor = [99, 102, 241]; // Indigo

  // Document Title & Branding
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('HISAAB360', 15, 18);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.text('Smart Wholesale Credit Invoice & Payment Receipt', 15, 25);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`INVOICE: #${invoice.id}`, 195, 18, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Status: ${invoice.status.toUpperCase()}`, 195, 25, { align: 'right' });

  // Seller Details (Left Column)
  doc.setTextColor(55, 65, 81);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FROM (SELLER):', 15, 55);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(seller?.name || 'Seller', 15, 61);
  doc.text(`Seller ID: ${seller?.id || 'SLR360'}`, 15, 66);
  if (seller?.email) doc.text(`Email: ${seller.email}`, 15, 71);
  doc.text(`Currency: ${currencyObj.name || currencyObj.code}`, 15, seller?.email ? 76 : 71);

  // Customer Details (Right Column)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('BILL TO (CUSTOMER):', 120, 55);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(customer?.name || 'Customer', 120, 61);
  doc.text(`Customer ID: ${customer?.id || 'CUST'}`, 120, 66);
  if (customer?.phone) doc.text(`Phone: ${customer.phone}`, 120, 71);
  if (customer?.email) doc.text(`Email: ${customer.email}`, 120, 76);

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.line(15, 82, 195, 82);

  // Invoice Dates & Metadata
  doc.setFont('Helvetica', 'bold');
  doc.text('Purchase Date:', 15, 90);
  doc.setFont('Helvetica', 'normal');
  doc.text(invoice.purchaseDate || 'N/A', 45, 90);

  doc.setFont('Helvetica', 'bold');
  doc.text('Due Date:', 120, 90);
  doc.setFont('Helvetica', 'normal');
  doc.text(invoice.dueDate || 'N/A', 145, 90);

  // Invoice Table
  const tableData = [
    [
      invoice.description || 'Credit Purchase',
      formatCurrency(invoice.amount, currencyObj),
      `${invoice.penaltyRate || 0}% / week`,
      formatCurrency(invoice.penaltyAccrued || 0, currencyObj),
      formatCurrency(invoice.amount + (invoice.penaltyAccrued || 0), currencyObj)
    ]
  ];

  doc.autoTable({
    startY: 96,
    head: [['Description', 'Base Amount', 'Penalty Rate', 'Accrued Penalty', 'Total Balance']],
    body: tableData,
    headStyles: { fillColor: primaryColor },
    theme: 'grid',
    margin: { left: 15, right: 15 },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 27, halign: 'right' }
    }
  });

  const finalY = doc.previousAutoTable.finalY + 15;

  // Payments History & Evidence Log
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PAYMENTS RECEIVED & AUDIT EVIDENCE:', 15, finalY);

  let py = finalY + 6;
  const totalPaid = (invoice.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);

  if (!invoice.paymentHistory || invoice.paymentHistory.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('No payment records logged.', 15, py);
    py += 8;
  } else {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    invoice.paymentHistory.forEach((payment, idx) => {
      const formattedDate = new Date(payment.date).toLocaleDateString();
      let proofLabel = payment.evidenceUrl ? '[Receipt Proof Verified ✓]' : '';
      let chequeLabel = payment.chequeNumber ? ` (Cheque #${payment.chequeNumber}${payment.bankName ? ' - ' + payment.bankName : ''})` : '';

      doc.text(`${idx + 1}. Date: ${formattedDate} | Method: ${payment.method}${chequeLabel} | Paid: ${formatCurrency(payment.amount, currencyObj)} ${proofLabel}`, 15, py);
      py += 6;
    });
  }

  // Summary Card (Right Side)
  const summaryX = 120;
  doc.setFillColor(249, 250, 251);
  doc.rect(summaryX, finalY - 5, 75, 45, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(summaryX, finalY - 5, 75, 45, 'S');

  doc.setTextColor(75, 85, 99);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Subtotal:', summaryX + 5, finalY + 2);
  doc.text(formatCurrency(invoice.amount, currencyObj), 190, finalY + 2, { align: 'right' });

  doc.text('Penalties:', summaryX + 5, finalY + 8);
  doc.setTextColor(244, 63, 94); // Crimson red
  doc.text(`+${formatCurrency(invoice.penaltyAccrued || 0, currencyObj)}`, 190, finalY + 8, { align: 'right' });

  doc.setTextColor(75, 85, 99);
  doc.text('Total Paid:', summaryX + 5, finalY + 14);
  doc.text(`-${formatCurrency(totalPaid, currencyObj)}`, 190, finalY + 14, { align: 'right' });

  doc.line(summaryX + 5, finalY + 20, 190, finalY + 20);

  doc.setTextColor(55, 65, 81);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Outstanding:', summaryX + 5, finalY + 28);
  const outstanding = Math.max(0, invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(outstanding, currencyObj), 190, finalY + 28, { align: 'right' });

  // Footer notes
  doc.setTextColor(156, 163, 175);
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Thank you for your business. All payments log auditable receipt proof evidence.', 15, 280);
  doc.text('Generated automatically by Hisaab360 Credit Collections Platform.', 15, 284);

  // Save the PDF
  doc.save(`Invoice-${invoice.id}.pdf`);
}

/**
 * Generates a consolidated Customer Statement PDF showing all invoices,
 * running totals, penalty status, and net outstanding balance.
 */
export function generateStatementPDF(customer, seller, invoices = []) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const currencyObj = seller?.currency || { symbol: '₹', code: 'INR' };
  const primaryColor = [99, 102, 241]; // Indigo
  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('HISAAB360', 15, 18);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.text('Consolidated Wholesale Statement of Account & Ledger', 15, 26);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ACCOUNT STATEMENT', 195, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Date Generated: ${todayStr}`, 195, 26, { align: 'right' });
  doc.text(`Customer ID: ${customer?.id || 'N/A'}`, 195, 32, { align: 'right' });

  // Seller Details (Left Column)
  doc.setTextColor(55, 65, 81);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ISSUING SELLER / SUPPLIER:', 15, 52);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(seller?.name || 'Seller Enterprise', 15, 58);
  doc.text(`Seller ID: ${seller?.id || 'SLR360'}`, 15, 63);
  if (seller?.email) doc.text(`Email: ${seller.email}`, 15, 68);
  doc.text(`Currency: ${currencyObj.name || currencyObj.code} (${currencyObj.symbol})`, 15, seller?.email ? 73 : 68);

  // Customer Details (Right Column)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CUSTOMER ACCOUNT DETAILS:', 115, 52);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(customer?.name || 'Customer', 115, 58);
  doc.text(`Account / Customer ID: ${customer?.id || 'N/A'}`, 115, 63);
  if (customer?.phone) doc.text(`Phone: ${customer.phone}`, 115, 68);
  if (customer?.email) doc.text(`Email: ${customer.email}`, 115, 73);

  // Divider line
  doc.setDrawColor(229, 231, 235);
  doc.line(15, 78, 195, 78);

  // Calculate Running Totals
  let totalBilled = 0;
  let totalPaid = 0;
  let totalPenalties = 0;

  invoices.forEach(inv => {
    const invPaid = (inv.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
    totalBilled += (inv.amount || 0);
    totalPaid += invPaid;
    totalPenalties += (inv.penaltyAccrued || 0);
  });

  const totalOutstanding = Math.max(0, Math.round((totalBilled + totalPenalties - totalPaid) * 100) / 100);

  // Summary KPI Cards (Horizontal 3-card layout)
  const cardY = 83;
  const cardW = 56;
  const cardH = 20;

  // Card 1: Total Billed
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(15, cardY, cardW, cardH, 2, 2, 'F');
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.text('TOTAL BILLED', 19, cardY + 6);
  doc.setTextColor(17, 24, 39);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(formatCurrency(totalBilled, currencyObj), 19, cardY + 14);

  // Card 2: Total Paid
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(77, cardY, cardW, cardH, 2, 2, 'F');
  doc.setTextColor(5, 150, 105);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TOTAL PAID TO DATE', 81, cardY + 6);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(formatCurrency(totalPaid, currencyObj), 81, cardY + 14);

  // Card 3: Net Outstanding
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(139, cardY, cardW, cardH, 2, 2, 'F');
  doc.setTextColor(225, 29, 72);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('NET OUTSTANDING', 143, cardY + 6);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(formatCurrency(totalOutstanding, currencyObj), 143, cardY + 14);

  // Invoices Table Data
  const tableRows = invoices.map(inv => {
    const invPaid = (inv.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, Math.round((inv.amount + (inv.penaltyAccrued || 0) - invPaid) * 100) / 100);
    return [
      inv.id,
      inv.purchaseDate || '-',
      inv.dueDate || '-',
      formatCurrency(inv.amount, currencyObj),
      inv.penaltyAccrued > 0 ? `+${formatCurrency(inv.penaltyAccrued, currencyObj)}` : '-',
      formatCurrency(invPaid, currencyObj),
      formatCurrency(outstanding, currencyObj),
      (inv.status || 'pending').toUpperCase()
    ];
  });

  doc.autoTable({
    startY: cardY + cardH + 7,
    head: [['Invoice ID', 'Purchase', 'Due Date', 'Billed', 'Penalty', 'Paid', 'Balance', 'Status']],
    body: tableRows,
    foot: [
      [
        'TOTALS',
        '',
        '',
        formatCurrency(totalBilled, currencyObj),
        formatCurrency(totalPenalties, currencyObj),
        formatCurrency(totalPaid, currencyObj),
        formatCurrency(totalOutstanding, currencyObj),
        ''
      ]
    ],
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 15, halign: 'center' }
    },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  // Footer notes on last page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(156, 163, 175);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(
      `Statement of Account — ${customer?.name || 'Customer'} (ID: ${customer?.id || 'N/A'}) — Page ${i} of ${pageCount}`,
      15,
      287
    );
    doc.text(
      'Hisaab360 Wholesale Credit & Collections Management Platform',
      195,
      287,
      { align: 'right' }
    );
  }

  // Save the Statement PDF
  const safeCustName = (customer?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Statement_${safeCustName}_${customer?.id || 'All'}.pdf`);
}
