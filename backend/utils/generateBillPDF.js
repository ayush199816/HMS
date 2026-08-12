const PDFDocument = require('pdfkit');

/**
 * Generate a generic PDF for non-admission bills (pathology, radiology, appointments, other)
 * @param {Object} bill - Bill document (populated fields allowed)
 * @param {Object|null} related - Related reference document (appointment, booking, etc.)
 * @param {Object} hospital - Hospital document
 * @param {Object} patient - Patient document
 * @param {Object} createdBy - User who created the bill
 * @returns {Buffer} PDF buffer
 */
async function generateBillPDF(bill, related, hospital, patient, createdBy) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text(hospital?.name || 'Hospital', { align: 'center' });
      if (hospital?.address) doc.fontSize(10).font('Helvetica').text(hospital.address, { align: 'center' });
      if (hospital?.phone) doc.fontSize(10).text(`Contact: ${hospital.phone}`, { align: 'center' });
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Patient details
      doc.fontSize(12).font('Helvetica-Bold').text('Patient Details');
      doc.fontSize(11).font('Helvetica').text(`Name: ${patient?.name || 'N/A'}`);
      const pid = patient?.opdNumber ? `OPD ID: ${patient.opdNumber}` : (patient?.emergencyNumber ? `Emergency ID: ${patient.emergencyNumber}` : `Patient ID: ${patient?._id?.toString()?.slice(-8) || 'N/A'}`);
      doc.text(pid);
      if (patient?.phone) doc.text(`Contact: ${patient.phone}`);
      doc.moveDown(0.5);

      // Bill header
      const title = bill.type ? `${bill.type.toUpperCase()} BILL` : 'BILL';
      doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.fontSize(10).text(`Bill No: ${bill.billNumber || 'N/A'}`, { align: 'center' });
      doc.moveDown(0.5);

      // Related info (if any)
      if (related) {
        doc.fontSize(11).font('Helvetica-Bold').text('Reference Details');
        if (related.bookingId) doc.fontSize(11).font('Helvetica').text(`Booking ID: ${related.bookingId}`);
        if (related.appointmentDate) doc.fontSize(11).font('Helvetica').text(`Appointment Date: ${new Date(related.appointmentDate).toLocaleString()}`);
        if (related.doctorId && related.doctorId.name) doc.fontSize(11).text(`Doctor: ${related.doctorId.name}`);
        doc.moveDown(0.5);
      }

      // Bill items
      doc.fontSize(12).font('Helvetica-Bold').text('Bill Items');
      const items = bill.items || [];
      if (items.length === 0) {
        doc.fontSize(11).font('Helvetica').text('No itemized entries');
      } else {
        items.forEach(item => {
          const name = item.name || item.description || 'Item';
          const qty = item.quantity || 1;
          const amount = (item.total !== undefined) ? item.total : (item.amount || 0);
          doc.fontSize(11).font('Helvetica').text(`${name}  x${qty}  -  ₹${amount.toFixed(2)}`);
        });
      }

      doc.moveDown(0.5);

      // Totals and payment
      const subtotal = items.reduce((s, it) => s + ((it.total !== undefined) ? it.total : (it.amount || 0)), 0);
      const discount = bill.discount || 0;
      const tax = bill.tax || 0;
      const total = bill.amount || bill.totalAmount || subtotal - discount + tax;

      doc.fontSize(11).font('Helvetica-Bold').text('Summary');
      doc.fontSize(11).font('Helvetica').text(`Sub Total: ₹${subtotal.toFixed(2)}`);
      doc.text(`Discount: ₹${discount.toFixed(2)}`);
      doc.text(`Tax: ₹${tax.toFixed(2)}`);
      doc.text(`Total Amount: ₹${total.toFixed(2)}`);
      doc.text(`Payment Status: ${bill.status ? bill.status.toUpperCase() : 'N/A'}`);
      doc.moveDown(0.5);

      // Payment sources (if any)
      if (bill.paymentSources && bill.paymentSources.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('Payment Sources');
        bill.paymentSources.forEach(ps => {
          doc.fontSize(11).font('Helvetica').text(`${ps.sourceType || 'source'} - ₹${(ps.amount || 0).toFixed(2)} ${ps.paymentDate ? `on ${new Date(ps.paymentDate).toLocaleDateString()}` : ''}`);
        });
        doc.moveDown(0.5);
      }

      // Footer - created by
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica').text(`Created by: ${createdBy?.name || 'System'}`);
      doc.text(`Date: ${new Date(bill.billDate || Date.now()).toLocaleDateString()}`);

      doc.moveDown(1);
      doc.fontSize(9).font('Helvetica-Oblique').text('This is a computer generated bill.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateBillPDF };