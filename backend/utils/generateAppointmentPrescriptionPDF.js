const PDFDocument = require('pdfkit');

const leftCol = 50;
const labelValueOffset = 120;

/**
 * Generate a blank prescription paper for an appointment
 * @param {Object} appointment - Appointment document with populated fields
 * @param {Object} hospital - Hospital document
 * @param {Object} patient - Patient document
 * @param {Object} doctor - Doctor document
 * @returns {Buffer} PDF buffer
 */
async function generateAppointmentPrescriptionPDF(appointment, hospital, patient, doctor) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header space for pre-printed hospital header
      doc.y += 80;

      // Small side-by-side boxes
      const boxY = doc.y;
      const boxPadding = 6;
      const leftBoxX = 50;
      const leftBoxW = 240;
      const rightBoxX = leftBoxX + leftBoxW + 20;
      const rightBoxW = 230;
      const valueOffset = 105;

      const apptDate = new Date(appointment.appointmentDate).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\//g, '-');

      const visitId = patient.opdNumber
        ? `OPD ID: ${patient.opdNumber}`
        : patient.emergencyNumber
        ? `Emergency ID: ${patient.emergencyNumber}`
        : '';

      const details = [
        { label: 'Name:', value: patient.name || '' },
        { label: 'OPDID/Emergency ID:', value: visitId.replace(/^(OPD ID|Emergency ID): /, '') },
        { label: 'Age:', value: patient.age ? patient.age.toString() : '' },
        { label: 'Gender:', value: patient.gender || '' },
        { label: 'Doctor visiting:', value: doctor?.name ? `Dr. ${doctor.name}` : '' },
        { label: 'Date:', value: apptDate },
        { label: 'Queue No:', value: appointment.queueNumber ? appointment.queueNumber.toString() : '' }
      ];

      // Draw left text first
      let currentY = boxY + boxPadding;
      const valueX = leftBoxX + boxPadding + valueOffset;
      const valueWidth = leftBoxW - boxPadding - valueOffset - 6;

      details.forEach((item) => {
        doc.fontSize(8).font('Helvetica-Bold').text(item.label, leftBoxX + boxPadding, currentY, { width: 95 });
        doc.font('Helvetica').text(item.value, valueX, currentY, { width: valueWidth, lineBreak: true });
        currentY = Math.max(doc.y + 4, currentY + 14);
      });
      const leftBottom = doc.y + boxPadding;

      // Draw right text
      currentY = boxY + boxPadding;
      const vitalValueX = rightBoxX + boxPadding + 70;

      const vitals = [
        { label: 'BP:', value: '' },
        { label: 'Heart Rate:', value: '' },
        { label: 'Weight:', value: '' },
        { label: 'SpO2:', value: '' }
      ];

      vitals.forEach((item) => {
        doc.fontSize(8).font('Helvetica-Bold').text(item.label, rightBoxX + boxPadding, currentY, { width: 65 });
        doc.font('Helvetica').text('_________', vitalValueX, currentY);
        currentY = Math.max(doc.y + 4, currentY + 14);
      });
      const rightBottom = doc.y + boxPadding;

      // Draw boxes around the text so they are only as big as the content
      doc.rect(leftBoxX, boxY, leftBoxW, leftBottom - boxY).stroke();
      doc.rect(rightBoxX, boxY, rightBoxW, rightBottom - boxY).stroke();

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateAppointmentPrescriptionPDF };
