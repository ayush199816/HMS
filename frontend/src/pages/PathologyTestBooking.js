import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, AlertCircle, ArrowLeft, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST, toISTDateTimeLocal, appendISTOffset } from '../utils/dateUtils';
import axios from 'axios';

const PathologyTestBooking = () => {
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
    bookingDate: toISTDateTimeLocal(),
    notes: '',
    urgent: false
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    description: '',
    paymentMethod: 'cash',
    utrNumber: ''
  });

  // Fetch tests
  const fetchTests = useCallback(async () => {
    try {
      const response = await api.get('/pathology/tests', { params: { limit: 100000 } });
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
      const response = await api.get('/pathology-bookings');
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
      setSelectedTests(prev => {
        const exists = prev.find(t => t._id === testId);
        if (exists) {
          return prev.filter(t => t._id !== testId);
        } else {
          return [...prev, test];
        }
      });
    }
  };

  // Calculate total cost
  const calculateTotalCost = () => {
    return selectedTests.reduce((total, test) => total + (test.pricing?.sellingPrice || 0), 0);
  };

  // Handle booking submission
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    try {
      const bookingData = {
        patientId: bookingFormData.patientId,
        doctorId: bookingFormData.doctorId,
        tests: selectedTests.map(test => ({
          testId: test._id,
          testName: test.name,
          testCode: test.code,
          category: test.category,
          price: test.pricing?.sellingPrice || 0
        })),
        preferredDate: appendISTOffset(bookingFormData.bookingDate),
        preferredTime: bookingFormData.bookingDate.split('T')[1],
        urgency: bookingFormData.urgent ? 'urgent' : 'routine',
        homeCollection: false,
        notes: bookingFormData.notes,
        discount: 0,
        paymentMethod: 'cash'
      };

      console.log('Sending booking data:', bookingData);
      const response = await api.post('/pathology-bookings', bookingData);
      console.log('Booking response:', response.data);
      
      // Set selected booking and show payment form
      setSelectedBooking(response.data.booking);
      
      // Pre-fill payment data
      const totalAmount = calculateTotalCost();
      const testNames = selectedTests.map(test => test.name).join(', ');
      setPaymentData({
        amount: totalAmount.toString(),
        description: `Pathology Tests: ${testNames}`,
        paymentMethod: 'cash',
        utrNumber: ''
      });
      
      // Show payment form
      setShowPaymentForm(true);
      setShowBookingForm(false);
      
      // Reset booking form
      setBookingFormData({
        patientId: '',
        doctorId: '',
        tests: [],
        bookingDate: toISTDateTimeLocal(),
        notes: '',
        urgent: false
      });
      setSelectedTests([]);
      
    } catch (error) {
      console.error('Error booking test:', error);
      alert('Failed to book test. Please try again.');
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      
      if (!selectedBooking) {
        setError('No booking selected');
        return;
      }

      // Update booking payment status
      await api.put(`/pathology-bookings/${selectedBooking._id}/payment`, {
        paymentStatus: 'paid',
        paymentMethod: paymentData.paymentMethod
      });

      // Generate and print PDF bill
      await handleDownloadAndPrintBill(selectedBooking);

      // Reset payment form
      setPaymentData({
        amount: '',
        description: '',
        paymentMethod: 'cash',
        utrNumber: ''
      });

      setShowPaymentForm(false);
      setSelectedBooking(null);
      
      // Refresh bookings
      fetchBookings();
      
      alert('Pathology test booked and payment processed successfully!');
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('Failed to process payment. Please try again.');
    }
  };

  // Download and print PDF bill
  const handleDownloadAndPrintBill = async (booking) => {
    try {
      console.log('Frontend: Downloading and printing PDF bill for pathology booking:', booking._id);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      
      // Call the PDF endpoint with direct axios to handle blob properly
      const response = await axios.get(`${baseURL}/pathology-bookings/${booking._id}/bill-pdf`, {
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
        a.download = `pathology-bill-${booking._id}.pdf`;
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

  // Handle sample collection
  const handleSampleCollection = async (bookingId) => {
    try {
      const response = await api.put(`/pathology-bookings/${bookingId}/sample-collection`, {
        isCollected: true,
        collectedDate: new Date().toISOString(),
        collectionNotes: 'Sample collected'
      });
      
      console.log('Sample collected successfully:', response.data);
      fetchBookings();
      alert('Sample marked as collected successfully!');
    } catch (error) {
      console.error('Error collecting sample:', error);
      alert('Failed to mark sample as collected. Please try again.');
    }
  };

  // Handle report upload
  const handleReportUpload = async (bookingId, testId, file) => {
    try {
      const formData = new FormData();
      formData.append('report', file);
      formData.append('normalValues', 'Normal ranges as per test standards');
      formData.append('patientValues', 'Patient test results');
      formData.append('remarks', 'Report generated and uploaded');
      
      const response = await api.post(`/pathology-bookings/${bookingId}/reports/${testId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Report uploaded successfully:', response.data);
      fetchBookings();
      alert('Report uploaded successfully!');
    } catch (error) {
      console.error('Error uploading report:', error);
      alert('Failed to upload report. Please try again.');
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter(booking =>
    booking.patientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.patientId?.phone?.includes(searchTerm) ||
    booking.patientId?.age?.toString().includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <button
            onClick={() => navigate('/appointments')}
            className="btn btn-secondary mb-4 inline-flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Appointments
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Pathology Test Booking</h1>
          <p className="text-gray-600 mt-2">Book pathology tests for patients</p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowBookingForm(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Book Test
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="p-6">
          <div className="relative max-w-md">
            <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by patient name, phone, or registered number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full"
            />
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Bookings</h2>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pathology test bookings found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr key={booking._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{booking.patientId?.name}</div>
                          <div className="text-sm text-gray-500">{booking.patientId?.phone}</div>
                          <div className="text-sm text-gray-500">Age: {booking.patientId?.age}, Gender: {booking.patientId?.gender}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {booking.tests?.map((test, index) => (
                            <div key={index} className="mb-1">
                              <span className="font-medium">{test.testName}</span>
                              <span className="text-gray-500 ml-2">({test.testCode})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateIST(booking.bookingDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{booking.totalAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            booking.status === 'booked' ? 'bg-blue-100 text-blue-800' :
                            booking.status === 'sample_collected' ? 'bg-yellow-100 text-yellow-800' :
                            booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status?.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-2">
                          {booking.status === 'booked' && (
                            <button
                              onClick={() => handleSampleCollection(booking._id)}
                              className="btn btn-sm btn-warning"
                              title="Mark Sample as Collected"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Collect Sample
                            </button>
                          )}
                          {booking.status === 'sample_collected' && (
                            <div className="flex items-center space-x-1">
                              {booking.tests?.map((test, index) => (
                                <div key={test.testId} className="flex items-center space-x-1">
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        handleReportUpload(booking._id, test.testId, file);
                                      }
                                    }}
                                    className="hidden"
                                    id={`report-upload-${booking._id}-${test.testId}`}
                                  />
                                  <label
                                    htmlFor={`report-upload-${booking._id}-${test.testId}`}
                                    className="btn btn-sm btn-info cursor-pointer"
                                    title={`Upload Report for ${test.testName}`}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    {test.testName}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                          {booking.status === 'completed' && (
                            <span className="text-green-600 text-sm font-medium">
                              Reports Available
                            </span>
                          )}
                          <button
                            onClick={() => handleDownloadAndPrintBill(booking)}
                            className="btn btn-sm btn-primary"
                            title="Print Bill"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Print Bill
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                Book Pathology Test
              </h3>
              <button
                onClick={() => setShowBookingForm(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Select Patient *
                </label>
                <select
                  required
                  value={bookingFormData.patientId}
                  onChange={(e) => setBookingFormData({...bookingFormData, patientId: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select Patient</option>
                  {patients.map(patient => (
                    <option key={patient._id} value={patient._id}>
                      {patient.name} - {patient.phone} (Age: {patient.age})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Select Doctor *
                </label>
                <select
                  required
                  value={bookingFormData.doctorId}
                  onChange={(e) => setBookingFormData({...bookingFormData, doctorId: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.name} - {doctor.specialization || 'General Practice'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Select Tests *
                </label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' }}>
                  {tests.map(test => (
                    <label key={test._id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedTests.some(t => t._id === test._id)}
                        onChange={() => handleTestSelection(test._id)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '14px' }}>
                        {test.name} ({test.code}) - ₹{test.pricing?.sellingPrice || 0}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedTests.length > 0 && (
                <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500', color: '#111827' }}>Total Amount:</span>
                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                      ₹{calculateTotalCost()}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Booking Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={bookingFormData.bookingDate}
                  onChange={(e) => setBookingFormData({...bookingFormData, bookingDate: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Notes
                </label>
                <textarea
                  value={bookingFormData.notes}
                  onChange={(e) => setBookingFormData({...bookingFormData, notes: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '80px'
                  }}
                  placeholder="Additional notes or instructions..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowBookingForm(false)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedTests.length === 0}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: selectedTests.length > 0 ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    cursor: selectedTests.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '14px'
                  }}
                >
                  Book Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                Process Payment - Pathology Tests
              </h3>
              <button
                onClick={() => {
                  setShowPaymentForm(false);
                  setSelectedBooking(null);
                  setPaymentData({
                    amount: '',
                    description: '',
                    paymentMethod: 'cash',
                    utrNumber: ''
                  });
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <AlertCircle style={{ width: '20px', height: '20px', color: '#dc2626', marginRight: '8px' }} />
                <span style={{ color: '#dc2626' }}>{error}</span>
              </div>
            )}

            {/* Booking Summary */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '6px',
              marginBottom: '16px'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '8px' }}>
                Booking Summary
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Patient</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>{selectedBooking.patientId?.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Doctor</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>Dr. {selectedBooking.doctorId?.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Tests</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {selectedBooking.tests?.map(test => test.testName).join(', ')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Date</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {formatDateIST(selectedBooking.bookingDate)}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Amount *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Description *
                </label>
                <textarea
                  required
                  value={paymentData.description}
                  onChange={(e) => setPaymentData({...paymentData, description: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '60px'
                  }}
                  placeholder="Payment description..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Payment Method *
                </label>
                <select
                  required
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="online">Online</option>
                </select>
              </div>

              {paymentData.paymentMethod !== 'cash' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Transaction Reference Number *
                  </label>
                  <input
                    type="text"
                    required={paymentData.paymentMethod !== 'cash'}
                    value={paymentData.utrNumber}
                    onChange={(e) => setPaymentData({...paymentData, utrNumber: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="Enter UTR/Transaction number"
                  />
                </div>
              )}

              <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#92400e', marginBottom: '8px' }}>
                  Ready to Process
                </h4>
                <p style={{ fontSize: '12px', color: '#92400e' }}>
                  Click "Generate Bill & Print" to create the bill and automatically print it. 
                  The payment will be recorded and the bill will be marked as paid.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentForm(false);
                    setSelectedBooking(null);
                    setPaymentData({
                      amount: '',
                      description: '',
                      paymentMethod: 'cash',
                      utrNumber: ''
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Generate Bill & Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PathologyTestBooking;
