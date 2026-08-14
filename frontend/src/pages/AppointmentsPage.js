import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Calendar, DollarSign, User, AlertCircle, Download, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST, formatTimeIST, toISTDateTimeLocal, appendISTOffset } from '../utils/dateUtils';
import axios from 'axios';

const AppointmentsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { api, user } = useAuth();
  
  // State
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return istDate.toISOString().split('T')[0];
  });
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showAppointmentPayment, setShowAppointmentPayment] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [nurses, setNurses] = useState([]);
  
  // Form states
  const [appointmentFormData, setAppointmentFormData] = useState({
    patientId: searchParams.get('patient') || '',
    doctorId: '',
    appointmentDate: toISTDateTimeLocal(),
    appointmentType: 'consultation',
    symptoms: '',
    notes: '',
    consultationFee: 500,
    assistantDoctorIds: [],
    assignedNurseIds: []
  });
  
  const [appointmentBillData, setAppointmentBillData] = useState({
    amount: '',
    description: '',
    paymentMethod: 'cash',
    utrNumber: ''
  });

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/appointments?date=${selectedDate}`);
      setAppointments(response.data.appointments);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }, [api, selectedDate]);

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      const response = await api.get('/staff/doctors/available', {
        params: { hospitalId: user.hospitalId }
      });
      setDoctors(response.data.doctors);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  }, [api, user?.hospitalId]);

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    try {
      const response = await api.get(`/patients/hospital/${user.hospitalId}`);
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  }, [api, user?.hospitalId]);

  // Fetch nurses
  const fetchNurses = useCallback(async () => {
    try {
      const response = await api.get('/staff/nurses/available', {
        params: { hospitalId: user.hospitalId }
      });
      setNurses(response.data.nurses || []);
    } catch (error) {
      console.error('Error fetching nurses:', error);
    }
  }, [api, user?.hospitalId]);

  useEffect(() => {
    if (user?.hospitalId) {
      fetchAppointments();
      fetchDoctors();
      fetchPatients();
      fetchNurses();
    }
  }, [fetchAppointments, fetchDoctors, fetchPatients, fetchNurses, user?.hospitalId]);

  // Filter appointments
  const filteredAppointments = appointments.filter(appointment => {
    const searchLower = searchTerm.toLowerCase();
    
    // Search by patient name
    if (appointment.patientId?.name?.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search by patient phone number
    if (appointment.patientId?.phone?.includes(searchTerm)) {
      return true;
    }
    
    // Search by patient registered number (OPD/Emergency number)
    if (appointment.patientId?.opdNumber?.toLowerCase().includes(searchLower)) {
      return true;
    }
    if (appointment.patientId?.emergencyNumber?.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search by patient ID
    if (appointment.patientId?._id?.toString().toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search by doctor name
    if (appointment.doctorId?.name?.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search by appointment type
    if (appointment.appointmentType?.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search by status
    if (appointment.status?.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search by queue number
    if (appointment.queueNumber?.toString().includes(searchTerm)) {
      return true;
    }
    
    return false;
  });

  // Handlers
  const handleAppointmentInputChange = async (e) => {
    const { name, value } = e.target;
    const updatedData = { ...appointmentFormData, [name]: value };
    
    setAppointmentFormData(updatedData);
    
    // Auto-calculate fee when doctor or appointment type changes
    if (name === 'doctorId' || name === 'appointmentType') {
      if (updatedData.doctorId && updatedData.appointmentType) {
        try {
          const response = await api.post('/fees/calculate', {
            appointmentType: updatedData.appointmentType,
            doctorId: updatedData.doctorId
          });
          
          setAppointmentFormData(prev => ({
            ...prev,
            consultationFee: response.data.calculatedFee
          }));
        } catch (error) {
          console.error('Error calculating fee:', error);
        }
      }
    }
  };

  const handleAppointmentPayment = (appointment) => {
    // First ask for payment method
    const paymentMethod = prompt('Select payment method:\n1. Cash\n2. UPI\n3. Card\n4. Online\n\nEnter number (1-4):');
    
    let selectedMethod = 'cash';
    let paymentDetails = '';
    
    switch(paymentMethod) {
      case '1':
        selectedMethod = 'cash';
        break;
      case '2':
        selectedMethod = 'upi';
        paymentDetails = prompt('Enter UTR number for UPI payment:');
        if (!paymentDetails) {
          alert('UTR number is required for UPI payment');
          return;
        }
        break;
      case '3':
        selectedMethod = 'card';
        paymentDetails = prompt('Enter card transaction number:');
        if (!paymentDetails) {
          alert('Card transaction number is required');
          return;
        }
        break;
      case '4':
        selectedMethod = 'online';
        paymentDetails = prompt('Enter online transaction reference number:');
        if (!paymentDetails) {
          alert('Transaction reference is required for online payment');
          return;
        }
        break;
      default:
        alert('Invalid payment method selected');
        return;
    }
    
    setSelectedAppointment(appointment);
    setAppointmentBillData({
      amount: appointment.consultationFee || 500,
      description: `Consultation fee - ${appointment.appointmentType}`,
      paymentMethod: selectedMethod,
      utrNumber: paymentDetails
    });
    setShowAppointmentPayment(true);
  };

  const handleAppointmentSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/appointments', {
        ...appointmentFormData,
        appointmentDate: appendISTOffset(appointmentFormData.appointmentDate),
        assistantDoctorIds: JSON.stringify(appointmentFormData.assistantDoctorIds),
        assignedNurseIds: JSON.stringify(appointmentFormData.assignedNurseIds),
        hospitalId: user.hospitalId,
        createdBy: user.id
      });

      setAppointmentFormData({
        patientId: '',
        doctorId: '',
        appointmentDate: toISTDateTimeLocal(),
        appointmentType: 'consultation',
        symptoms: '',
        notes: '',
        consultationFee: 500,
        assistantDoctorIds: [],
        assignedNurseIds: []
      });
      setShowAppointmentForm(false);
      fetchAppointments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create appointment');
    }
  };

  const handleAppointmentBillSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      console.log('Frontend: Starting appointment payment processing...');
      
      // Create bill for the patient
      console.log('Frontend: Creating bill for patient:', selectedAppointment.patientId._id);
      const response = await api.post(`/billing/patient/${selectedAppointment.patientId._id}`, {
        ...appointmentBillData,
        referenceNumber: appointmentBillData.utrNumber
      });
      const bill = response.data.bill;
      console.log('Frontend: Bill created successfully:', bill.billNumber);
      
      // Process payment - mark bill as paid
      if (appointmentBillData.paymentMethod === 'cash') {
        // For cash payments, mark as paid immediately
        console.log('Frontend: Processing cash payment...');
        await api.post(`/billing/bill/${bill._id}/pay`, {
          utrNumber: 'CASH_PAYMENT',
          paymentMethod: 'cash'
        });
      } else if (appointmentBillData.utrNumber) {
        // For digital payments, use the provided UTR/transaction number
        console.log('Frontend: Processing digital payment...');
        await api.post(`/billing/bill/${bill._id}/pay`, {
          utrNumber: appointmentBillData.utrNumber,
          paymentMethod: appointmentBillData.paymentMethod
        });
      }
      console.log('Frontend: Payment processed successfully');

      // Update appointment with payment status
      const appointmentUpdateData = {
        paymentStatus: 'paid',
        paymentMethod: appointmentBillData.paymentMethod,
        paymentAmount: appointmentBillData.amount
      };
      
      console.log('Frontend: Updating appointment payment status...');
      await api.patch(`/appointments/${selectedAppointment._id}/status`, appointmentUpdateData);
      console.log('Frontend: Appointment payment status updated successfully');

      // Generate and print PDF bill
      await handleDownloadAndPrintBill(selectedAppointment);

      // Refresh appointments
      fetchAppointments();

      setShowAppointmentPayment(false);
      setSelectedAppointment(null);
      setAppointmentBillData({
        amount: '',
        description: '',
        paymentMethod: 'cash',
        utrNumber: ''
      });
      
      console.log('Frontend: Payment processing completed successfully');
    } catch (error) {
      console.error('Frontend: Payment processing error:', error);
      console.error('Frontend: Error response:', error.response?.data);
      setError(error.response?.data?.message || 'Failed to process payment');
    }
  };

  const handleDownloadBill = async (appointment) => {
    try {
      console.log('Frontend: Downloading PDF bill for appointment:', appointment._id);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      
      // Call the new PDF endpoint with direct axios to handle blob properly
      const response = await axios.get(`${baseURL}/appointments/${appointment._id}/bill-pdf?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });
      
      // Create a blob from the PDF data
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link and trigger download
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers['content-disposition'];
      const filenameMatch = disposition && disposition.match(/filename="?([^";]+)"?/);
      a.download = filenameMatch ? filenameMatch[1] : `appointment-bill-${appointment._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('Frontend: PDF bill downloaded successfully');
      alert('Bill downloaded successfully!');
    } catch (error) {
      console.error('Frontend: Error downloading PDF bill:', error);
      console.error('Frontend: Error details:', error.response?.data);
      alert(`Failed to download bill: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDownloadAndPrintBill = async (appointment) => {
    try {
      console.log('Frontend: Downloading and printing PDF bill for appointment:', appointment._id);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      
      // Call the PDF endpoint with direct axios to handle blob properly
      const response = await axios.get(`${baseURL}/appointments/${appointment._id}/bill-pdf?t=${Date.now()}`, {
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
        const disposition = response.headers['content-disposition'];
        const filenameMatch = disposition && disposition.match(/filename="?([^";]+)"?/);
        a.download = filenameMatch ? filenameMatch[1] : `appointment-bill-${appointment._id}.pdf`;
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

  const handleDownloadPrescription = async (appointment) => {
    try {
      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

      const response = await axios.get(`${baseURL}/appointments/${appointment._id}/prescription-pdf?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers['content-disposition'];
      const filenameMatch = disposition && disposition.match(/filename="?([^";]+)"?/);
      a.download = filenameMatch ? filenameMatch[1] : `prescription-${appointment._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Frontend: Error downloading prescription PDF:', error);
      alert(`Failed to download prescription: ${error.response?.data?.message || error.message}`);
    }
  };

  // Appointment form component
  if (showAppointmentForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Book New Appointment</h2>
            <p className="card-description">
              Schedule an appointment for a patient
            </p>
          </div>

          {error && (
            <div className="alert alert-danger flex items-center mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handleAppointmentSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Select Patient *</label>
                <select
                  name="patientId"
                  value={appointmentFormData.patientId}
                  onChange={handleAppointmentInputChange}
                  className="form-input"
                  required
                >
                  <option value="">Choose a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient._id} value={patient._id}>
                      {patient.name} - {patient.opdNumber || patient.emergencyNumber || 'No ID'} ({patient.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Doctor *</label>
                <select
                  name="doctorId"
                  value={appointmentFormData.doctorId}
                  onChange={handleAppointmentInputChange}
                  className="form-input"
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.name} - {doctor.specialities?.join(', ') || 'General'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Date & Time *</label>
                <input
                  type="datetime-local"
                  name="appointmentDate"
                  value={appointmentFormData.appointmentDate}
                  onChange={handleAppointmentInputChange}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Appointment Type *</label>
                <select
                  name="appointmentType"
                  value={appointmentFormData.appointmentType}
                  onChange={handleAppointmentInputChange}
                  className="form-input"
                  required
                >
                  <option value="consultation">Consultation</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="emergency">Emergency</option>
                  <option value="surgery">Surgery</option>
                  <option value="test">Test</option>
                </select>
              </div>
            </div>

            {/* Assistant Doctors */}
            <div>
              <label className="form-label">Assistant Doctors (Optional)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {doctors.map(doctor => (
                  <label
                    key={doctor._id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      appointmentFormData.assistantDoctorIds.includes(doctor._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={appointmentFormData.assistantDoctorIds.includes(doctor._id)}
                      onChange={() => {
                        setAppointmentFormData(prev => ({
                          ...prev,
                          assistantDoctorIds: prev.assistantDoctorIds.includes(doctor._id)
                            ? prev.assistantDoctorIds.filter(id => id !== doctor._id)
                            : [...prev.assistantDoctorIds, doctor._id]
                        }));
                      }}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Dr. {doctor.name}</p>
                      <p className="text-xs text-gray-500">{doctor.specialities?.join(', ') || 'Doctor'}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Assigned Nurses */}
            <div>
              <label className="form-label">Assigned Nurses (Optional)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {nurses.map(nurse => (
                  <label
                    key={nurse._id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      appointmentFormData.assignedNurseIds.includes(nurse._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={appointmentFormData.assignedNurseIds.includes(nurse._id)}
                      onChange={() => {
                        setAppointmentFormData(prev => ({
                          ...prev,
                          assignedNurseIds: prev.assignedNurseIds.includes(nurse._id)
                            ? prev.assignedNurseIds.filter(id => id !== nurse._id)
                            : [...prev.assignedNurseIds, nurse._id]
                        }));
                      }}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{nurse.name}</p>
                      <p className="text-xs text-gray-500">Nurse</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Consultation Fee</label>
              <input
                type="number"
                name="consultationFee"
                value={appointmentFormData.consultationFee}
                onChange={handleAppointmentInputChange}
                className="form-input"
                step="0.01"
                min="0"
                readOnly
              />
            </div>
            <div>
              <label className="form-label">Symptoms / Reason for Visit *</label>
              <textarea
                name="symptoms"
                value={appointmentFormData.symptoms}
                onChange={handleAppointmentInputChange}
                className="form-input"
                rows="3"
                required
              />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                value={appointmentFormData.notes}
                onChange={handleAppointmentInputChange}
                className="form-input"
                rows="2"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowAppointmentForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Book Appointment
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Appointment payment form component
  if (showAppointmentPayment && selectedAppointment) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Process Appointment Payment</h2>
            <p className="card-description">
              Create bill and process payment for {selectedAppointment.patientId?.name}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger flex items-center mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {/* Appointment Summary */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Patient</div>
                <div className="font-medium">{selectedAppointment.patientId?.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Doctor</div>
                <div className="font-medium">Dr. {selectedAppointment.doctorId?.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Date</div>
                <div className="font-medium">{formatDateIST(selectedAppointment.appointmentDate)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Type</div>
                <div className="font-medium">{selectedAppointment.appointmentType}</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-2">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium">₹{appointmentBillData.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium capitalize">{appointmentBillData.paymentMethod}</span>
                </div>
                {appointmentBillData.utrNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaction Ref:</span>
                    <span className="font-medium">{appointmentBillData.utrNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Description:</span>
                  <span className="font-medium">{appointmentBillData.description}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">Ready to Process</h3>
              <p className="text-sm text-blue-600">
                Click "Generate Bill" to create the bill and automatically print it. 
                The payment will be recorded and the bill will be marked as paid.
              </p>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowAppointmentPayment(false);
                  setSelectedAppointment(null);
                  setAppointmentBillData({
                    amount: '',
                    description: '',
                    paymentMethod: 'cash',
                    utrNumber: ''
                  });
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDownloadPrescription(selectedAppointment)}
                className="btn-secondary"
              >
                Download Prescription
              </button>
              <button
                onClick={handleAppointmentBillSubmit}
                className="btn-primary"
              >
                Generate Bill & Print
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 text-sm">Manage patient appointments and schedules</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAppointmentForm(true)}
            className="btn-primary flex items-center text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Book Appointment
          </button>
          <button
            onClick={() => navigate('/receptionist/dashboard')}
            className="btn-secondary text-sm"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 p-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-input text-sm"
            />
          </div>
          <div className="text-sm text-gray-500 whitespace-nowrap">
            {filteredAppointments.length} appointments
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-danger flex items-center mb-6">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Appointments Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="table-header-cell text-xs font-semibold">Queue</th>
                <th className="table-header-cell text-xs font-semibold">Patient</th>
                <th className="table-header-cell text-xs font-semibold">Doctor</th>
                <th className="table-header-cell text-xs font-semibold">Date & Time</th>
                <th className="table-header-cell text-xs font-semibold">Type</th>
                <th className="table-header-cell text-xs font-semibold">Status</th>
                <th className="table-header-cell text-xs font-semibold">Payment</th>
                <th className="table-header-cell text-xs font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {loading ? (
                <tr>
                  <td colSpan="8" className="table-body-cell text-center py-8">
                    <div className="spinner mx-auto"></div>
                  </td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-body-cell text-center py-8">
                    <div className="text-gray-500 text-sm">
                      {searchTerm ? 'No appointments found matching your search.' : 'No appointments found.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appointment) => (
                  <tr key={appointment._id} className="hover:bg-gray-50">
                    <td className="table-body-cell">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 font-bold text-xs">
                            {appointment.queueNumber || '-'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <div className="flex items-center">
                        <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center mr-2">
                          <User className="h-3 w-3 text-primary-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{appointment.patientId?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{appointment.patientId?.phone || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">Dr. {appointment.doctorId?.name || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <div className="text-xs">
                        <div className="text-gray-900">
                          {formatDateIST(appointment.appointmentDate)}
                        </div>
                        <div className="text-gray-500">
                          {formatTimeIST(appointment.appointmentDate)}
                        </div>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <span className={`badge badge-${appointment.appointmentType === 'consultation' ? 'info' : appointment.appointmentType === 'emergency' ? 'danger' : appointment.appointmentType === 'surgery' ? 'warning' : 'gray'} text-xs`}>
                        {appointment.appointmentType?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="table-body-cell">
                      <span className={`badge badge-${appointment.status === 'scheduled' ? 'info' : appointment.status === 'in_progress' ? 'warning' : appointment.status === 'completed' ? 'success' : appointment.status === 'cancelled' ? 'danger' : 'gray'} text-xs`}>
                        {appointment.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="table-body-cell">
                      {appointment.paymentStatus === 'paid' ? (
                        <span className="badge badge-success text-xs">PAID</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="badge badge-warning text-xs">PENDING</span>
                          <span className="text-xs text-gray-500">₹{appointment.consultationFee || 500}</span>
                        </div>
                      )}
                    </td>
                    <td className="table-body-cell">
                      <div className="flex items-center justify-center gap-2">
                        {appointment.paymentStatus !== 'paid' && (
                          <button
                            onClick={() => handleAppointmentPayment(appointment)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Process Payment"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                        )}
                        {appointment.paymentStatus === 'paid' && (
                          <>
                            <button
                              onClick={() => handleDownloadBill(appointment)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Download Bill"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadPrescription(appointment)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Download Prescription"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AppointmentsPage;
