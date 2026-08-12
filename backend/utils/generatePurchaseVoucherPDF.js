const PDFDocument = require('pdfkit');

function generatePurchaseVoucherPDF(purchase) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      if (purchase.hospitalId?.name) {
        doc.fontSize(14).font('Helvetica-Bold').text(purchase.hospitalId.name.toUpperCase(), 50, 40, { align: 'center' });
      }
      doc.fontSize(18).font('Helvetica-Bold').text('PAYMENT VOUCHER', 50, 65, { align: 'center' });
      doc.moveDown(1);

      // Purchase info
      doc.fontSize(12).font('Helvetica-Bold').text('Purchase Details');
      doc.fontSize(11).font('Helvetica');
      doc.text(`Voucher No: ${purchase.billNumber}`);
      doc.text(`Vendor: ${purchase.vendorName}`);
      doc.text(`Contact: ${purchase.vendorContact || 'N/A'}`);
      doc.text(`Purchase Date: ${new Date(purchase.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}`);
      doc.moveDown(1);

      // Particulars
      doc.fontSize(12).font('Helvetica-Bold').text('Particulars');
      doc.fontSize(10).font('Helvetica-Bold');
      const col1 = 50;
      const col2 = 220;
      const col3 = 340;
      const col4 = 430;
      const col5 = 510;
      doc.text('Description', col1, doc.y);
      doc.text('Category', col2, doc.y);
      doc.text('Qty', col3, doc.y);
      doc.text('Rate', col4, doc.y);
      doc.text('Amount', col5, doc.y);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      doc.fontSize(10).font('Helvetica');
      purchase.particulars.forEach(item => {
        doc.text(item.description, col1, doc.y, { width: 150 });
        doc.text(item.category + (item.subCategory ? ` / ${item.subCategory}` : ''), col2, doc.y, { width: 110 });
        doc.text(String(item.quantity), col3, doc.y);
        doc.text(`₹${(item.rate || 0).toFixed(2)}`, col4, doc.y);
        doc.text(`₹${(item.amount || 0).toFixed(2)}`, col5, doc.y);
        doc.moveDown(0.6);
      });

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // Payment summary
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`Total Amount:      ₹${purchase.totalAmount.toFixed(2)}`, 350, doc.y, { align: 'right' });
      doc.text(`Total Paid:        ₹${purchase.totalPaid.toFixed(2)}`, 350, doc.y + 15, { align: 'right' });
      doc.text(`Balance:           ₹${purchase.balanceAmount.toFixed(2)}`, 350, doc.y + 15, { align: 'right' });
      doc.moveDown(1);

      // Payment history
      if (purchase.paymentSources && purchase.paymentSources.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Payment History');
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Date', 50, doc.y);
        doc.text('Method', 150, doc.y);
        doc.text('Reference', 260, doc.y);
        doc.text('Amount', 460, doc.y);
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);

        doc.fontSize(10).font('Helvetica');
        purchase.paymentSources.forEach(payment => {
          doc.text(new Date(payment.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'), 50, doc.y);
          doc.text((payment.paymentMethod || 'cash').toUpperCase(), 150, doc.y);
          doc.text(payment.referenceNumber || 'N/A', 260, doc.y);
          doc.text(`₹${(payment.amount || 0).toFixed(2)}`, 460, doc.y);
          doc.moveDown(0.6);
        });
      }

      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}`);
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').text('Authorized Signatory', 50, doc.y);
      doc.text('Sign: ________________', 50, doc.y + 25);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePurchaseVoucherPDF };
