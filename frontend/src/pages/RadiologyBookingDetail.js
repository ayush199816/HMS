import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTimeIST } from '../utils/dateUtils';
import { ArrowLeft, Upload, FileText, Download, AlertCircle } from 'lucide-react';

const RadiologyBookingDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { api } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedTest, setSelectedTest] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportImages, setReportImages] = useState([]);
  const [reportObservation, setReportObservation] = useState('');
  const [reportFindings, setReportFindings] = useState('');
  const [reportImpression, setReportImpression] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/radiology-bookings/${id}`);
      setBooking(response.data.booking);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch booking details');
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setReportImages([...reportImages, ...files]);
  };

  const removeImage = (index) => {
    setReportImages(reportImages.filter((_, i) => i !== index));
  };

  const handleReportSubmit = async () => {
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('observation', reportObservation);
      formData.append('findings', reportFindings);
      formData.append('impression', reportImpression);
      
      reportImages.forEach((image) => {
        formData.append('images', image);
      });

      const testId = selectedTest.testId._id || selectedTest.testId;
      await api.post(
        `/radiology-bookings/${id}/reports/${testId}/detailed`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      alert('Report submitted successfully!');
      setShowReportForm(false);
      setReportImages([]);
      setReportObservation('');
      setReportFindings('');
      setReportImpression('');
      setSelectedTest(null);
      fetchBooking();
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportDownload = async (testId) => {
    try {
      const actualTestId = testId._id || testId;
      const response = await api.get(`/radiology-bookings/${id}/reports/${actualTestId}/download`, {
        responseType: 'blob'
      });

      // Check if response is a PDF
      if (response.headers['content-type'] === 'application/pdf') {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'radiology_report.pdf';
        link.click();
      } else if (response.data.type === 'image' || response.data.type === 'url') {
        const link = document.createElement('a');
        link.href = response.data.url;
        link.download = response.data.fileName;
        link.click();
      } else if (response.data.type === 'text') {
        const blob = new Blob([response.data.content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = response.data.fileName;
        link.click();
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: '#6b7280' }}>Loading booking details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', marginBottom: '16px' }}>
          <AlertCircle style={{ width: '20px', height: '20px' }} />
          {error}
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ color: '#6b7280', marginBottom: '16px' }}>Booking not found</div>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>
              Radiology Booking {booking.bookingId || booking._id.slice(-8)}
            </h1>
            <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
              {formatDateTimeIST(booking.bookingDate)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: booking.status === 'completed' ? '#d1fae5' : booking.status === 'cancelled' ? '#fee2e2' : '#dbeafe',
            color: booking.status === 'completed' ? '#065f46' : booking.status === 'cancelled' ? '#991b1b' : '#1e40af'
          }}>
            {booking.status}
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: booking.paymentStatus === 'paid' ? '#d1fae5' : '#fef3c7',
            color: booking.paymentStatus === 'paid' ? '#065f46' : '#92400e'
          }}>
            {booking.paymentStatus}
          </span>
        </div>
      </div>

      {/* Patient Info */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Patient Information</h2>
        <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827', marginBottom: '8px' }}>
          {booking.patientId?.name}
        </div>
        {booking.patientId?.opdNumber && (
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            {booking.patientId.opdNumber}
          </div>
        )}
        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
          {booking.patientId?.phone}
        </div>
        {booking.patientId?.email && (
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            {booking.patientId.email}
          </div>
        )}
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          Age: {booking.patientId?.age}
        </div>
      </div>

      {/* Tests and Reports */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Tests & Reports</h2>
        
        {!booking.tests || booking.tests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
            No tests found for this booking
          </div>
        ) : (
          booking.tests.map((test, index) => {
            const report = booking.reports?.[index];
            const actualTestId = test.testId?._id || test.testId;
            return (
              <div key={actualTestId || index} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '0 0 4px 0' }}>
                      {test.testName}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {test.category} • {test.bodyPart} • ₹{test.price}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {report?.status === 'completed' && (
                      <button
                        onClick={() => handleReportDownload(actualTestId)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#10b981', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                      >
                        <Download style={{ width: '14px', height: '14px' }} />
                        Download
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedTest(test);
                        setShowReportForm(true);
                        setReportImages([]);
                        setReportObservation('');
                        setReportFindings('');
                        setReportImpression('');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                    >
                      <FileText style={{ width: '14px', height: '14px' }} />
                      {report?.status === 'completed' ? 'Update Report' : 'Create Report'}
                    </button>
                  </div>
                </div>
                
                {report?.status === 'completed' && (
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '6px', padding: '12px', marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Report Status: <span style={{ color: '#059669', fontWeight: '500' }}>Completed</span></div>
                    {report.observation && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Observation:</div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>{report.observation}</div>
                      </div>
                    )}
                    {report.findings && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Findings:</div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>{report.findings}</div>
                      </div>
                    )}
                    {report.impression && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Impression:</div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>{report.impression}</div>
                      </div>
                    )}
                    {report.images && report.images.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Attached Images:</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {report.images.map((img, imgIndex) => (
                            <img
                              key={imgIndex}
                              src={img.url}
                              alt={`Scan ${imgIndex + 1}`}
                              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Report Form Modal */}
      {showReportForm && selectedTest && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Create Report - {selectedTest.testName}
              </h2>
              <button
                onClick={() => setShowReportForm(false)}
                style={{ color: '#9ca3af', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Upload Scan Images</label>
                  <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="imageUpload"
                    />
                    <label
                      htmlFor="imageUpload"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                      <Upload style={{ width: '32px', height: '32px', color: '#6b7280' }} />
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>Click to upload images</span>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>PNG, JPG up to 10MB</span>
                    </label>
                  </div>
                  {reportImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px', marginTop: '12px' }}>
                      {reportImages.map((image, index) => (
                        <div key={index} style={{ position: 'relative' }}>
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Preview ${index + 1}`}
                            style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                          />
                          <button
                            onClick={() => removeImage(index)}
                            style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Observation</label>
                  <textarea
                    value={reportObservation}
                    onChange={(e) => setReportObservation(e.target.value)}
                    rows={3}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', resize: 'vertical' }}
                    placeholder="Enter observation details..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Findings</label>
                  <textarea
                    value={reportFindings}
                    onChange={(e) => setReportFindings(e.target.value)}
                    rows={3}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', resize: 'vertical' }}
                    placeholder="Enter findings..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Impression</label>
                  <textarea
                    value={reportImpression}
                    onChange={(e) => setReportImpression(e.target.value)}
                    rows={3}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', resize: 'vertical' }}
                    placeholder="Enter impression..."
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px', borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setShowReportForm(false)}
                disabled={submitting}
                style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', color: '#374151', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReportSubmit}
                disabled={submitting || reportImages.length === 0}
                style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500', opacity: (submitting || reportImages.length === 0) ? 0.5 : 1 }}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RadiologyBookingDetail;
