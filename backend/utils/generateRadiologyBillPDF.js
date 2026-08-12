const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF bill for radiology test booking
 * @param {Object} booking - RadiologyTestBooking document with populated fields
 * @param {Object} hospital - Hospital document
 * @param {Object} patient - Patient document
 * @param {Object} doctor - Doctor document
 * @param {Object} bill - Bill document (optional)
 * @param {Object} createdBy - User who created the bill
 * @returns {Buffer} PDF buffer
 */
async function generateRadiologyBillPDF(booking, hospital, patient, doctor, bill, createdBy) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header Section - Hospital Information
      doc.fontSize(20).font('Helvetica-Bold').text(hospital.name, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(hospital.address, { align: 'center' });
      doc.fontSize(11).text(`Contact: ${hospital.phone}`, { align: 'center' });
      doc.fontSize(11).text(`Registration No: ${hospital.registrationNumber}`, { align: 'center' });
      
      doc.moveDown(1);
      
      // Horizontal line
      doc.moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();
      
      doc.moveDown(1);

      // Left side - Patient Information
      const patientY = doc.y;
      doc.fontSize(12).font('Helvetica-Bold').text('PATIENT INFORMATION', 50, patientY);
      doc.fontSize(11).font('Helvetica').text(`Name: ${patient.name}`, 50, patientY + 20);
      
      // Determine patient ID based on type
      let patientId = '';
      if (patient.opdNumber) {
        patientId = `OPD ID: ${patient.opdNumber}`;
      } else if (patient.emergencyNumber) {
        patientId = `Emergency ID: ${patient.emergencyNumber}`;
      } else {
        patientId = `IPD ID: ${patient._id.toString().slice(-8)}`;
      }
      
      doc.text(patientId, 50, patientY + 35);
      doc.text(`Contact: ${patient.phone}`, 50, patientY + 50);

      // Bill Title
      doc.moveDown(1);
      doc.fontSize(16).font('Helvetica-Bold').text('RADIOLOGY TEST BILL', { align: 'center' });
      doc.fontSize(10).text(`Bill No: ${bill ? bill.billNumber : 'N/A'}`, { align: 'center' });
      doc.fontSize(10).text(`Booking ID: ${booking.bookingId || 'N/A'}`, { align: 'center' });
      
      doc.moveDown(0.5);

      // Table 1: DOCTOR INFORMATION
      doc.fontSize(12).font('Helvetica-Bold').text('1. DOCTOR INFORMATION:');
      drawTableBox(doc, [
        { label: 'Doctor:', value: doctor ? `Dr. ${doctor.name}` : 'N/A' }
      ]);

      doc.moveDown(0.5);

      // Table 2: BOOKING DETAILS
      doc.fontSize(12).font('Helvetica-Bold').text('2. BOOKING DETAILS:');
      
      const bookingDate = new Date(booking.bookingDate);
      const formattedDate = bookingDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
      
      drawTableBox(doc, [
        { label: 'Booking Date:', value: formattedDate },
        { label: 'Preferred Date:', value: booking.preferredDate ? new Date(booking.preferredDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'N/A' },
        { label: 'Preferred Time:', value: booking.preferredTime || 'N/A' },
        { label: 'Urgency:', value: booking.urgency || 'Normal' },
        { label: 'Status:', value: booking.status.toUpperCase() }
      ]);

      doc.moveDown(0.5);

      // Table 3: TEST DETAILS
      doc.fontSize(12).font('Helvetica-Bold').text('3. TEST DETAILS:');
      
      const testItems = booking.tests.map(test => ({
        label: `${test.testName} (${test.bodyPart || 'General'})`,
        value: `₹${test.price}`
      }));
      
      drawTableBox(doc, testItems);

      doc.moveDown(0.5);

      // Table 4: BILLING DETAILS
      doc.fontSize(12).font('Helvetica-Bold').text('4. BILLING DETAILS:');
      
      const paymentDate = bill?.paymentDetails?.paymentDate 
        ? new Date(bill.paymentDetails.paymentDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).replace(/\//g, '-')
        : formattedDate;
      
      const paymentStatus = booking.paymentStatus ? booking.paymentStatus.toUpperCase() : (bill ? bill.status.toUpperCase() : 'PENDING');
      const paymentMethod = booking.paymentMethod ? booking.paymentMethod.toUpperCase() : (bill?.paymentDetails?.paymentMethod ? bill.paymentDetails.paymentMethod.toUpperCase() : 'N/A');
      
      drawTableBox(doc, [
        { label: 'Total Amount:', value: `₹${booking.totalAmount}` },
        { label: 'Final Amount:', value: `₹${booking.finalAmount}` },
        { label: 'Payment Status:', value: paymentStatus },
        { label: 'Payment Method:', value: paymentMethod },
        { label: 'Payment Date:', value: paymentDate }
      ]);

      // Close table with line
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();

      doc.moveDown(0.5);

      // Right side - Designated Authority
      const authorityY = doc.y;
      doc.fontSize(12).font('Helvetica-Bold').text('Designated Authority', 350, authorityY, { align: 'right' });
      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica').text('Sign: ________________', { align: 'right' });

      // Bottom - Created by
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica').text(`Bill created by: ${createdBy ? createdBy.name : 'System'}`, 50, doc.y);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}`, 50, doc.y + 15);

      // Footer
      doc.moveDown(1);
      doc.fontSize(9).font('Helvetica-Oblique').text('This is a computer-generated bill and does not require a physical signature.', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper function to draw a table box with label-value pairs
 */
function drawTableBox(doc, items) {
  const boxX = 50;
  const boxWidth = 495;
  const lineHeight = 25;
  const startX = boxX + 10;
  const labelOffset = 8;
  
  // Store current Y position
  const startY = doc.y;
  const boxHeight = items.length * lineHeight;
  
  // Draw box border
  doc.rect(boxX, startY, boxWidth, boxHeight).stroke();
  
  // Draw items with proper spacing
  items.forEach((item, index) => {
    const rowY = startY + (index * lineHeight);
    const textY = rowY + labelOffset;
    
    // Draw horizontal line between rows (except after last row)
    if (index < items.length - 1) {
      doc.moveTo(boxX, rowY + lineHeight)
         .lineTo(boxX + boxWidth, rowY + lineHeight)
         .stroke();
    }
    
    doc.fontSize(11).font('Helvetica-Bold').text(item.label, startX, textY);
    doc.fontSize(11).font('Helvetica').text(item.value, startX + 120, textY);
  });
  
  // Move cursor to exactly below the box
  doc.y = startY + boxHeight + 10;
}

module.exports = { generateRadiologyBillPDF };
