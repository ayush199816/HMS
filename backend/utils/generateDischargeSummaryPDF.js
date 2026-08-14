const PDFDocument = require('pdfkit');

function drawSection(doc, title, items) {
  if (!items || items.length === 0) return;
  doc.moveDown(0.5);
  doc.fontSize(13).font('Helvetica-Bold').text(title);
  doc.moveDown(0.2);
  doc.fontSize(11).font('Helvetica');
  items.forEach(item => {
    if (item && item.trim()) {
      doc.text('• ' + item, 60, undefined, { width: 470 });
      doc.moveDown(0.2);
    }
  });
}

function drawMedications(doc, title, medications) {
  if (!medications || medications.length === 0) return;
  doc.moveDown(0.5);
  doc.fontSize(13).font('Helvetica-Bold').text(title);
  doc.moveDown(0.2);
  doc.fontSize(11).font('Helvetica');
  medications.forEach((med, index) => {
    if (!med || !med.name || !med.name.trim()) return;
    doc.text(`${index + 1}. ${med.name.trim()}`, 60, undefined, { width: 470 });
    if (med.duration && med.duration.trim()) {
      doc.text(`   Duration: ${med.duration.trim()}`, 70, undefined, { width: 460 });
    }
    if (med.howToTake && med.howToTake.trim()) {
      doc.text(`   How to take: ${med.howToTake.trim()}`, 70, undefined, { width: 460 });
    }
    doc.moveDown(0.2);
  });
}

function drawConclusion(doc, title, conclusion) {
  if (!conclusion || !conclusion.trim()) return;
  doc.moveDown(0.5);
  doc.fontSize(13).font('Helvetica-Bold').text(title);
  doc.moveDown(0.2);
  doc.fontSize(11).font('Helvetica').text(conclusion, 60, undefined, { width: 470 });
}

const generateDischargeSummaryPDF = (admission, hospital, patient) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text(hospital?.name || 'Hospital', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(hospital?.address || '', { align: 'center' });
      if (hospital?.phone) {
        doc.fontSize(11).text(`Contact: ${hospital.phone}`, { align: 'center' });
      }
      doc.moveDown(1);

      // Title
      doc.fontSize(16).font('Helvetica-Bold').text('DISCHARGE SUMMARY', { align: 'center' });
      doc.moveDown(0.5);

      // Patient details
      const p = patient || {};
      const visitId = p.opdNumber || p.emergencyNumber || 'N/A';
      const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-') : 'N/A';

      doc.fontSize(11).font('Helvetica');
      doc.text(`Patient Name: ${p.name || 'N/A'}`);
      doc.text(`Age: ${p.age || 'N/A'}    Gender: ${p.gender || 'N/A'}`);
      doc.text(`OPD / Emergency ID: ${visitId}`);
      doc.text(`Admission ID: ${admission?.admissionId || 'N/A'}`);
      doc.text(`Admission Date: ${formatDate(admission?.admissionDate)}`);
      doc.text(`Discharge Date: ${formatDate(admission?.dischargeDate)}`);
      doc.moveDown(0.5);

      // Summary sections
      const summary = admission?.dischargeSummary || {};
      drawSection(doc, '1. Problem Statements', summary.problemStatements);
      drawSection(doc, '2. Tests Done and Findings', summary.testsAndFindings);
      drawSection(doc, '3. Procedure Post Admission', summary.procedures);
      drawMedications(doc, '4. Medications to be Taken', summary.medications);
      drawSection(doc, '5. Next Follow Up Dates', summary.followUpDates);
      drawConclusion(doc, '6. Final Conclusion', summary.conclusion);

      // Doctor sign area
      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text('Attending Doctor');
      doc.fontSize(11).font('Helvetica').text(admission?.doctorIds?.[0]?.name || 'N/A');
      doc.moveDown(0.3);
      doc.text('Sign: ____________________________');

      // Creator info
      const creator = admission?.dischargeSummary?.createdBy;
      if (creator?.name) {
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').text(`Prepared by: ${creator.name}`, { align: 'center' });
      }

      // Footer
      doc.moveDown(1);
      doc.fontSize(9).font('Helvetica-Oblique').text('This is a computer-generated discharge summary.', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateDischargeSummaryPDF;
