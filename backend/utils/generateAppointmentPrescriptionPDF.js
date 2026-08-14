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

      // Header Section - Hospital Information (pre-printed)
      doc.fontSize(20).font('Helvetica-Bold').text(hospital.name || 'Hospital', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(hospital.address || '', { align: 'center' });
      doc.text(`Contact: ${hospital.phone || ''}`, { align: 'center' });
      doc.text(`Registration No: ${hospital.registrationNumber || ''}`, { align: 'center' });

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

      // Patient details and blank photo/box area
      const startY = doc.y + 20;
      const rowHeight = 22;
      const boxSize = 100;

      // Small blank box on the right
      doc.rect(400, startY, boxSize, boxSize).stroke();

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
        { label: 'Doctor visiting:', value: doctor?.name ? `Dr. ${doctor.name}` : '' }
      ];

      details.forEach((item, index) => {
        const rowY = startY + (index * rowHeight);
        doc.fontSize(11).font('Helvetica-Bold').text(item.label, leftCol, rowY);
        doc.font('Helvetica').text(item.value, leftCol + labelValueOffset, rowY);
      });

      // Vitals section below the details and blank box
      let vitalsY = startY + (details.length * rowHeight) + 30;
      const boxBottom = startY + boxSize + 20;
      if (vitalsY < boxBottom) vitalsY = boxBottom;

      doc.moveTo(50, vitalsY).lineTo(545, vitalsY).stroke();
      vitalsY += 15;

      doc.fontSize(12).font('Helvetica-Bold').text('Vitals', leftCol, vitalsY);
      vitalsY += 25;

      const vitals = [
        { label: 'BP:' },
        { label: 'Heart Rate:' },
        { label: 'Weight:' },
        { label: 'SpO2:' }
      ];

      vitals.forEach((item) => {
        doc.fontSize(11).font('Helvetica-Bold').text(item.label, leftCol, vitalsY);
        doc.font('Helvetica').text('_________________', leftCol + labelValueOffset, vitalsY);
        vitalsY += 25;
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateAppointmentPrescriptionPDF };
