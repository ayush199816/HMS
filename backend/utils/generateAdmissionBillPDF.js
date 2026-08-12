const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF bill for admission
 * @param {Object} bill - Bill document with populated fields
 * @param {Object} admission - Admission document
 * @param {Object} hospital - Hospital document
 * @param {Object} patient - Patient document
 * @param {Object} createdBy - User who created the bill
 * @returns {Buffer} PDF buffer
 */
async function generateAdmissionBillPDF(bill, admission, hospital, patient, createdBy) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const isAdvanceBill = bill.isAdvanceBill || bill.type === 'admission_advance';

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
      const billTitle = isAdvanceBill ? 'ADVANCE PAYMENT RECEIPT' : 'FULL & FINAL BILL';
      doc.fontSize(16).font('Helvetica-Bold').text(billTitle, { align: 'center' });
      doc.fontSize(10).text(`Bill No: ${bill.billNumber}`, { align: 'center' });
      doc.fontSize(10).text(`Admission ID: ${admission.admissionId}`, { align: 'center' });
      
      doc.moveDown(0.5);

      // Table 1: ADMISSION DETAILS
      doc.fontSize(12).font('Helvetica-Bold').text('1. ADMISSION DETAILS:');
      
      const admissionDate = new Date(admission.admissionDate);
      const formattedAdmissionDate = admissionDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
      
      const dischargeDate = admission.dischargeDate ? new Date(admission.dischargeDate) : new Date();
      const formattedDischargeDate = dischargeDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
      
      const daysAdmitted = Math.ceil((dischargeDate - admissionDate) / (1000 * 60 * 60 * 24)) || 1;
      
      drawTableBox(doc, [
        { label: 'Admission Date:', value: formattedAdmissionDate },
        { label: 'Discharge Date:', value: isAdvanceBill ? 'N/A (Admitted)' : formattedDischargeDate },
        { label: 'Days Admitted:', value: isAdvanceBill ? 'N/A' : daysAdmitted.toString() },
        { label: 'Bed Number:', value: admission.bedId?.bedNumber || admission.bedNumber || 'N/A' },
        { label: 'Ward Type:', value: (admission.bedId?.wardType || admission.bedType || 'N/A').replace('_', ' ') },
        { label: 'Status:', value: admission.status.toUpperCase() }
      ]);

      doc.moveDown(0.5);

      // For advance bills, show payment details
      if (isAdvanceBill) {
        doc.fontSize(12).font('Helvetica-Bold').text('2. PAYMENT DETAILS:');
        
        const paymentDate = bill.billDate ? new Date(bill.billDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).replace(/\//g, '-') : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        
        const advanceSource = bill.paymentSources?.find(s => s.sourceType === 'advance');
        const advancePaymentMethod = advanceSource?.paymentMethod || 'cash';
        const advanceReference = advanceSource?.referenceNumber || '';
        
        const advancePaymentItems = [
          { label: 'Advance Amount:', value: `₹${bill.advanceAmount.toFixed(2)}` },
          { label: 'Payment Method:', value: advancePaymentMethod.toUpperCase() }
        ];
        
        if (advancePaymentMethod !== 'cash') {
          advancePaymentItems.push({ label: 'Reference/UTR:', value: advanceReference || 'N/A' });
        }
        
        advancePaymentItems.push(
          { label: 'Payment Status:', value: bill.status.toUpperCase() },
          { label: 'Payment Date:', value: paymentDate }
        );
        
        drawTableBox(doc, advancePaymentItems);
        
        doc.moveDown(0.5);
      } else {
        // For full & final bills, show doctors
        doc.fontSize(12).font('Helvetica-Bold').text('2. DOCTORS:');
        
        const doctorItems = [];
        
        // Primary doctors
        if (admission.doctorIds && admission.doctorIds.length > 0) {
          admission.doctorIds.forEach(doc => {
            doctorItems.push({ label: 'Primary Doctor:', value: doc.name || 'N/A' });
          });
        }
        
        // Assistant doctors
        if (admission.assistantDoctorIds && admission.assistantDoctorIds.length > 0) {
          admission.assistantDoctorIds.forEach(doc => {
            doctorItems.push({ label: 'Assistant Doctor:', value: doc.name || 'N/A' });
          });
        }
        
        if (doctorItems.length === 0) {
          doctorItems.push({ label: 'Doctors:', value: 'N/A' });
        }
        
        drawTableBox(doc, doctorItems);

        doc.moveDown(0.5);

        // Table 3: BILL ITEMS
        doc.fontSize(12).font('Helvetica-Bold').text('3. BILL ITEMS:');
        
        const billItems = bill.items?.map(item => {
          const qty = item.quantity || 1;
          const base = (item.price || 0) * qty;
          const gstPercent = base > 0 ? Math.round(((item.total - base) / base) * 100) : 0;
          return {
            label: item.name,
            value: `Qty: ${qty}, GST: ${gstPercent}% - ₹${(item.total || 0).toFixed(2)}`
          };
        }) || [];
        
        drawTableBox(doc, billItems);

        doc.moveDown(0.5);

        // Table 4: PREVIOUS ADVANCE PAYMENTS
        if (bill.previousBills && bill.previousBills.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').text('4. PREVIOUS ADVANCE PAYMENTS:');
          
          const advanceItems = bill.previousBills
            .filter(b => b.type === 'admission_advance' || (b.advanceAmount > 0))
            .map(b => ({
              label: `${b.billNumber} (${new Date(b.billDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')})`,
              value: `₹${(b.advanceAmount || 0).toFixed(2)}`
            }));
          
          const totalAdvance = bill.previousBills.reduce((sum, b) => sum + (b.advanceAmount || 0), 0);
          advanceItems.push({ label: 'TOTAL ADVANCE COLLECTED:', value: `₹${totalAdvance.toFixed(2)}` });
          
          drawTableBox(doc, advanceItems);
          doc.moveDown(0.5);
        }
      }

      // BILLING DETAILS - Only for full & final bills
      if (!isAdvanceBill) {
        doc.fontSize(12).font('Helvetica-Bold').text('5. BILLING DETAILS:');
        
        const paymentDate = bill.billDate ? new Date(bill.billDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).replace(/\//g, '-') : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        
        const billingItems = [];
        
        // Calculate subtotal from bill items
        const subtotal = bill.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
        billingItems.push({ label: 'Sub Total:', value: `₹${subtotal.toFixed(2)}` });
        
        billingItems.push({ label: 'Discount:', value: `₹${(bill.discount || 0).toFixed(2)}` });
        
        // For full & final bills, show advance and compute total as Sub Total - Discount - Advance
        const advance = bill.advanceAmount || 0;
        if (advance > 0) {
          billingItems.push({ label: 'Advance:', value: `₹${advance.toFixed(2)}` });
        }
        const totalAmount = Math.max(0, subtotal - (bill.discount || 0) - advance);
        billingItems.push({ label: 'Total Amount:', value: `₹${totalAmount.toFixed(2)}` });
        billingItems.push({ label: 'Payment Status:', value: bill.status === 'refund_due' ? 'REFUND DUE' : bill.status.toUpperCase() });
        
        const patientPayment = bill.paymentSources?.find(s => s.sourceType === 'patient');
        if (patientPayment) {
          billingItems.push({ label: 'Payment Method:', value: (patientPayment.paymentMethod || 'cash').toUpperCase() });
          if (patientPayment.paymentMethod && patientPayment.paymentMethod !== 'cash' && patientPayment.referenceNumber) {
            billingItems.push({ label: 'Reference/UTR:', value: patientPayment.referenceNumber });
          }
        }
        
        billingItems.push({ label: 'Bill Date:', value: paymentDate });
        
        drawTableBox(doc, billingItems);

        // Close table with line
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y)
           .lineTo(545, doc.y)
           .stroke();

        doc.moveDown(0.5);
      }

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

module.exports = { generateAdmissionBillPDF };
