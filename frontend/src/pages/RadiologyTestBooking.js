import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, AlertCircle, ArrowLeft, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST, toISTDateTimeLocal, appendISTOffset } from '../utils/dateUtils';
import axios from 'axios';

const RadiologyTestBooking = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  
  // State
  const [tests, setTests] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  // Form states
  const [bookingFormData, setBookingFormData] = useState({
    patientId: '',
    doctorId: '',
    tests: [],
    preferredDate: toISTDateTimeLocal(),
    preferredTime: '09:00',
    notes: '',
    urgency: 'routine'
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    description: '',
    paymentMethod: 'cash',
    transactionId: ''
  });

  // Fetch tests
  const fetchTests = useCallback(async () => {
    try {
      const response = await api.get('/radiology/tests');
      setTests(response.data.tests);
    } catch (error) {
      console.error('Error fetching tests:', error);
    }
  }, [api]);

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    try {
      console.log('Fetching patients...');
      const response = await api.get(`/patients/hospital/${user.hospitalId}`);
      console.log('Patients response:', response.data);
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Failed to fetch patients');
    }
  }, [api, user.hospitalId]);

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      console.log('Fetching doctors...');
      const response = await api.get(`/staff/hospital/${user.hospitalId}?role=doctor`);
      console.log('Doctors response:', response.data);
      setDoctors(response.data.staff || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setError('Failed to fetch doctors');
    }
  }, [api, user.hospitalId]);

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/radiology-bookings');
      setBookings(response.data.bookings);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (user?.hospitalId) {
      fetchTests();
      fetchPatients();
      fetchDoctors();
      fetchBookings();
    }
  }, [fetchTests, fetchPatients, fetchDoctors, fetchBookings, user.hospitalId]);

  // Handle test selection
  const handleTestSelection = (testId) => {
    const test = tests.find(t => t._id === testId);
    if (test) {
      setSelectedTests([...selectedTests, test]);
    }
  };

  // Remove test from selection
  const handleRemoveTest = (testId) => {
    setSelectedTests(selectedTests.filter(t => t._id !== testId));
  };

  // Calculate total amount
  const calculateTotal = () => {
    return selectedTests.reduce((sum, test) => sum + (test.pricing?.sellingPrice || 0), 0);
  };

  // Create booking
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    try {
      const totalAmount = calculateTotal();
      const bookingData = {
        patientId: bookingFormData.patientId,
        doctorId: bookingFormData.doctorId,
        tests: selectedTests.map(t => ({
          testId: t._id,
          testCode: t.code,
          testName: t.name,
          sellingPrice: t.pricing.sellingPrice
        })),
        preferredDate: appendISTOffset(bookingFormData.preferredDate),
        preferredTime: bookingFormData.preferredTime,
        urgency: bookingFormData.urgency,
        notes: bookingFormData.notes,
        totalAmount: totalAmount,
        totalCost: totalAmount,
        finalAmount: totalAmount
      };

      await api.post('/radiology-bookings', bookingData);
      alert('Booking created successfully!');
      setShowBookingForm(false);
      setSelectedTests([]);
      setBookingFormData({
        patientId: '',
        doctorId: '',
        tests: [],
        preferredDate: toISTDateTimeLocal(),
        preferredTime: '09:00',
        notes: '',
        urgency: 'routine'
      });
      fetchBookings();
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking. Please try again.');
    }
  };

  // Handle payment
  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/radiology-bookings/${selectedBooking._id}/payment`, {
        paymentStatus: 'paid',
        paymentMethod: paymentData.paymentMethod,
        transactionId: paymentData.transactionId
      });

      // Generate and print PDF bill
      await handleDownloadAndPrintBill(selectedBooking);

      alert('Payment recorded successfully!');
      setShowPaymentForm(false);
      setPaymentData({
        amount: '',
        description: '',
        paymentMethod: 'cash',
        transactionId: ''
      });
      setSelectedBooking(null);
      fetchBookings();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment. Please try again.');
    }
  };

  // Download and print PDF bill
  const handleDownloadAndPrintBill = async (booking) => {
    try {
      console.log('Frontend: Downloading and printing PDF bill for radiology booking:', booking._id);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      
      // Call the PDF endpoint with direct axios to handle blob properly
      const response = await axios.get(`${baseURL}/radiology-bookings/${booking._id}/bill-pdf`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });
      
      // Create a blob from the PDF data
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Open PDF in new window and trigger print
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        // Fallback: download if popup is blocked
        const a = document.createElement('a');
        a.href = url;
        a.download = `radiology-bill-${booking._id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        alert('Popup was blocked. Bill downloaded instead.');
      }
      
      // Clean up URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
      
      console.log('Frontend: PDF bill generated and print triggered successfully');
    } catch (error) {
      console.error('Frontend: Error generating/printing PDF bill:', error);
      console.error('Frontend: Error details:', error.response?.data);
      alert(`Failed to generate/print bill: ${error.response?.data?.message || error.message}`);
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    return (
      booking.patient?.name?.toLowerCase().includes(searchLower) ||
      booking.patient?.phone?.includes(searchLower) ||
      booking.bookingId?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            color: '#374151',
            cursor: 'pointer',
            marginBottom: '16px',
            fontSize: '14px'
          }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          Back
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
          Radiology Test Booking
        </h1>
        <p style={{ color: '#6b7280' }}>Create and manage radiology scan appointments</p>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#991b1b'
        }}>
          <AlertCircle style={{ width: '20px', height: '20px' }} />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setShowBookingForm(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px'
          }}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          New Booking
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', width: '20px', height: '20px' }} />
          <input
            type="text"
            placeholder="Search by patient name, phone, or booking ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>New Radiology Booking</h2>
              <button
                onClick={() => setShowBookingForm(false)}
                style={{ color: '#9ca3af', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <form onSubmit={handleCreateBooking}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Patient *</label>
                    <select
                      required
                      value={bookingFormData.patientId}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, patientId: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    >
                      <option value="">Select Patient</option>
                      {patients.map(patient => (
                        <option key={patient._id} value={patient._id}>
                          {patient.name} - {patient.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Doctor</label>
                    <select
                      value={bookingFormData.doctorId}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, doctorId: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    >
                      <option value="">Select Doctor (Optional)</option>
                      {doctors.map(doctor => (
                        <option key={doctor._id} value={doctor._id}>
                          {doctor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Preferred Date *</label>
                      <input
                        type="date"
                        required
                        value={bookingFormData.preferredDate ? bookingFormData.preferredDate.slice(0, 10) : ''}
                        onChange={(e) => setBookingFormData({ ...bookingFormData, preferredDate: e.target.value })}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Preferred Time *</label>
                      <input
                        type="time"
                        required
                        value={bookingFormData.preferredTime}
                        onChange={(e) => setBookingFormData({ ...bookingFormData, preferredTime: e.target.value })}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Urgency *</label>
                    <select
                      required
                      value={bookingFormData.urgency}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, urgency: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    >
                      <option value="routine">Routine</option>
                      <option value="urgent">Urgent</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Select Tests *</label>
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                      {tests.map(test => (
                        <div key={test._id} style={{ display: 'flex', alignItems: 'center', padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                          <input
                            type="checkbox"
                            id={`test-${test._id}`}
                            checked={selectedTests.some(t => t._id === test._id)}
                            onChange={() => {
                              if (selectedTests.some(t => t._id === test._id)) {
                                handleRemoveTest(test._id);
                              } else {
                                handleTestSelection(test._id);
                              }
                            }}
                            style={{ marginRight: '12px' }}
                          />
                          <label htmlFor={`test-${test._id}`} style={{ flex: 1, fontSize: '14px', color: '#374151' }}>
                            <div>
                              <div style={{ fontWeight: '500' }}>{test.name}</div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>{test.code} - ₹{test.pricing.sellingPrice}</div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTests.length > 0 && (
                    <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '8px' }}>Selected Tests:</div>
                      {selectedTests.map(test => (
                        <div key={test._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                          <span style={{ fontSize: '14px' }}>{test.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '500' }}>₹{test.pricing.sellingPrice}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTest(test._id)}
                              style={{ color: '#dc2626', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                        <span>Total:</span>
                        <span>₹{calculateTotal()}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Notes</label>
                    <textarea
                      value={bookingFormData.notes}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, notes: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', resize: 'none' }}
                      rows="3"
                      placeholder="Any additional notes..."
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      id="urgent"
                      checked={bookingFormData.urgent}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, urgent: e.target.checked })}
                      style={{ marginRight: '8px' }}
                    />
                    <label htmlFor="urgent" style={{ fontSize: '14px', color: '#374151' }}>Mark as Urgent</label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setShowBookingForm(false)}
                      style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', color: '#374151', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={selectedTests.length === 0}
                      style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500', opacity: selectedTests.length === 0 ? 0.5 : 1 }}
                    >
                      Create Booking
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
          Recent Bookings ({filteredBookings.length})
        </h2>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>Loading...</div>
        ) : filteredBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
            No bookings found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Booking ID</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Patient</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Tests</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Payment</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map(booking => (
                  <tr key={booking._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'monospace' }}>{booking.bookingId || booking._id.slice(-8)}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <div
                        onClick={() => navigate(`/radiology/booking/${booking._id}`)}
                        style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {booking.patient?.name} ({booking.patientId?._id?.slice(-6) || booking.patientId?.slice(-6)})
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{booking.patient?.phone}</div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {booking.tests.map(t => t.testName).join(', ')}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {formatDateIST(booking.bookingDate)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', fontWeight: '500' }}>₹{booking.totalAmount}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 10px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: booking.status === 'completed' ? '#d1fae5' : booking.status === 'cancelled' ? '#fee2e2' : '#dbeafe',
                        color: booking.status === 'completed' ? '#065f46' : booking.status === 'cancelled' ? '#991b1b' : '#1e40af'
                      }}>
                        {booking.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {booking.paymentStatus === 'paid' ? (
                        <span style={{ color: '#059669', fontWeight: '500', fontSize: '14px' }}>Paid</span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setPaymentData({
                              amount: booking.totalAmount,
                              description: `Radiology booking ${booking.bookingId || booking._id.slice(-8)}`,
                              paymentMethod: 'cash',
                              utrNumber: ''
                            });
                            setShowPaymentForm(true);
                          }}
                          style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => handleDownloadAndPrintBill(booking)}
                        style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Download style={{ width: '14px', height: '14px' }} />
                        Print Bill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>Record Payment</h2>
              <button
                onClick={() => setShowPaymentForm(false)}
                style={{ color: '#9ca3af', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <form onSubmit={handlePayment}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Amount *</label>
                    <input
                      type="number"
                      required
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Description</label>
                    <input
                      type="text"
                      value={paymentData.description}
                      onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Payment Method *</label>
                    <select
                      required
                      value={paymentData.paymentMethod}
                      onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>

                  {(paymentData.paymentMethod === 'upi' || paymentData.paymentMethod === 'bank_transfer' || paymentData.paymentMethod === 'card') && (
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Transaction ID *</label>
                      <input
                        type="text"
                        required
                        value={paymentData.transactionId}
                        onChange={(e) => setPaymentData({ ...paymentData, transactionId: e.target.value })}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setShowPaymentForm(false)}
                      style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', color: '#374151', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500' }}
                    >
                      Record Payment
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RadiologyTestBooking;
