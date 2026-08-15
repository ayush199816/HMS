import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  ArrowLeft,
  AlertCircle,
  Search,
  Download,
  FileText,
  Activity,
  Eye,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTimeIST, formatDateIST } from '../utils/dateUtils';

const PatientDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api, user } = useAuth();
  
  // State
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState({});
    const [pathologyTests, setPathologyTests] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [pathologyBookings, setPathologyBookings] = useState([]);
  const [radiologyBookings, setRadiologyBookings] = useState([]);
  const [bills, setBills] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showPathologyForm, setShowPathologyForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Form state
  const [appointmentFormData, setAppointmentFormData] = useState({
    patientId: id,
    doctorId: '',
    appointmentDate: new Date().toISOString().slice(0, 16),
    appointmentType: 'consultation',
    symptoms: '',
    notes: '',
    consultationFee: 500
  });

  const [pathologyFormData, setPathologyFormData] = useState({
    patientId: id,
    doctorId: '',
    tests: [],
    preferredDate: new Date().toISOString().slice(0, 10),
    preferredTime: '09:00',
    urgency: 'routine',
    homeCollection: false,
    collectionAddress: '',
    notes: '',
    discount: 0,
    paymentMethod: 'cash'
  });

  // Fetch patient details
  const fetchPatientDetails = useCallback(async () => {
    try {
      console.log('Frontend: Fetching patient details for ID:', id);
      const response = await api.get(`/patients/${id}`);
      console.log('Frontend: Patient details response:', response.data);
      setPatient(response.data.patient);
    } catch (error) {
      console.error('Frontend: Error fetching patient details:', error);
      console.error('Frontend: Error response:', error.response?.data);
      setError(error.response?.data?.message || 'Failed to fetch patient details');
    }
  }, [api, id]);

  // Fetch patient appointments
  const fetchPatientAppointments = useCallback(async () => {
    try {
      const response = await api.get(`/appointments?patientId=${id}`);
      const appointments = response.data.appointments || [];
      setAppointments(appointments);
      
      // Fetch medical records for each appointment
      const recordsPromises = appointments.map(async (appointment) => {
        try {
          const [prescriptionsRes, pathologyRes, xrayRes, ctRes, ultrasoundRes, mriRes, ecgRes, surgeryRes] = await Promise.all([
            api.get(`/medical-records/patient/${id}/prescriptions`),
            api.get(`/medical-records/patient/${id}/pathology`),
            api.get(`/medical-records/patient/${id}/xray`),
            api.get(`/medical-records/patient/${id}/ct`),
            api.get(`/medical-records/patient/${id}/ultrasound`),
            api.get(`/medical-records/patient/${id}/mri`),
            api.get(`/medical-records/patient/${id}/ecg`),
            api.get(`/medical-records/patient/${id}/surgery`)
          ]);
          
          return {
            appointmentId: appointment._id,
            prescriptions: prescriptionsRes.data.prescriptions || [],
            pathology: pathologyRes.data.medicalRecords || [],
            xray: xrayRes.data.medicalRecords || [],
            ct: ctRes.data.medicalRecords || [],
            ultrasound: ultrasoundRes.data.medicalRecords || [],
            mri: mriRes.data.medicalRecords || [],
            ecg: ecgRes.data.medicalRecords || [],
            surgery: surgeryRes.data.medicalRecords || []
          };
        } catch (error) {
          console.error('Error fetching medical records for appointment:', appointment._id, error);
          return {
            appointmentId: appointment._id,
            prescriptions: [],
            pathology: [],
            xray: [],
            ct: [],
            ultrasound: [],
            mri: [],
            ecg: [],
            surgery: []
          };
        }
      });
      
      const records = await Promise.all(recordsPromises);
      const recordsMap = {};
      records.forEach(record => {
        recordsMap[record.appointmentId] = record;
      });
      setMedicalRecords(recordsMap);
      
    } catch (error) {
      setWarnings(prev => [...prev, error.response?.data?.message || 'Failed to fetch appointments']);
    }
  }, [api, id]);

  // Handle file download
  const handleDownload = async (type, id, fileName) => {
    try {
      const response = await api.get(`/medical-records/download/${type}/${id}`);

      if (response.data.downloadUrl) {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.download = fileName || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (response.data.type === 'text') {
        // Download text file
        const blob = new Blob([response.data.content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = response.data.fileName || fileName || 'download.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      const response = await api.get('/staff/doctors/available', {
        params: { hospitalId: user.hospitalId }
      });
      setDoctors(response.data.doctors || []);
    } catch (error) {
      setWarnings(prev => [...prev, error.response?.data?.message || 'Failed to fetch doctors']);
    }
  }, [api, user?.hospitalId]);

  // Get report status badge color
  const getReportStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'ready': return 'info';
      default: return 'gray';
    }
  };

  // Fetch pathology tests
  const fetchPathologyTests = useCallback(async () => {
    try {
      const response = await api.get('/pathology/tests', {
        params: { hospitalId: user.hospitalId, limit: 100 }
      });
      setPathologyTests(response.data.tests || []);
    } catch (error) {
      setWarnings(prev => [...prev, error.response?.data?.message || 'Failed to fetch pathology tests']);
    }
  }, [api, user?.hospitalId]);

  // Fetch pathology bookings
  const fetchPathologyBookings = useCallback(async () => {
    try {
      const response = await api.get(`/pathology-bookings/patient/${id}`);
      setPathologyBookings(response.data.bookings || []);
    } catch (error) {
      setWarnings(prev => [...prev, error.response?.data?.message || 'Failed to fetch pathology bookings']);
    }
  }, [api, id]);

  // Fetch radiology bookings
  const fetchRadiologyBookings = useCallback(async () => {
    try {
      const response = await api.get(`/radiology-bookings/patient/${id}`);
      setRadiologyBookings(response.data.bookings || []);
    } catch (error) {
      setWarnings(prev => [...prev, error.response?.data?.message || 'Failed to fetch radiology bookings']);
    }
  }, [api, id]);

  // Fetch patient bills
  const fetchPatientBills = useCallback(async () => {
    try {
      const response = await api.get(`/billing/patient/${id}/history`);
      setBills(response.data.paymentHistory || []);
    } catch (error) {
      setWarnings(prev => [...prev, error.response?.data?.message || 'Failed to fetch bills']);
    }
  }, [api, id]);

  const fetchPatientAdmissions = useCallback(async () => {
    try {
      const response = await api.get(`/admissions?patientId=${id}`);
      setAdmissions(response.data.admissions || []);
    } catch (error) {
      setWarnings(prev => [...prev, error.response?.data?.message || 'Failed to fetch admissions']);
    }
  }, [api, id]);

  useEffect(() => {
    if (id && user?.hospitalId) {
      setLoading(true);
      setError('');
      setWarnings([]);
      Promise.all([
        fetchPatientDetails(),
        fetchPatientAppointments(),
        fetchDoctors(),
        fetchPathologyTests(),
        fetchPathologyBookings(),
        fetchRadiologyBookings(),
        fetchPatientBills(),
        fetchPatientAdmissions()
      ]).finally(() => setLoading(false));
    }
  }, [id, fetchPatientDetails, fetchPatientAppointments, fetchDoctors, fetchPathologyTests, fetchPathologyBookings, fetchRadiologyBookings, fetchPatientBills, fetchPatientAdmissions, user?.hospitalId]);

  // Handle URL parameters for automatic pathology modal opening
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pathologyParam = urlParams.get('pathology');
    const tabParam = urlParams.get('tab');
    
    if (pathologyParam === 'true' && tabParam === 'medical-records') {
      console.log('URL parameters detected, opening pathology modal');
      setShowPathologyForm(true);
    }
  }, []);

  // Filter appointments
  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = searchTerm === '' || 
      appointment.doctorId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.appointmentType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.symptoms?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Handle appointment form submission
  const handleAppointmentSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/appointments', {
        ...appointmentFormData,
        hospitalId: user.hospitalId,
        createdBy: user.id
      });

      setAppointmentFormData({
        patientId: id,
        doctorId: '',
        appointmentDate: new Date().toISOString().slice(0, 16),
        appointmentType: 'consultation',
        symptoms: '',
        notes: '',
        consultationFee: 500
      });
      setShowAppointmentForm(false);
      fetchPatientAppointments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create appointment');
    }
  };

  // Handle pathology test booking submission
  const handlePathologySubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/pathology-bookings', {
        ...pathologyFormData,
        hospitalId: user.hospitalId,
        createdBy: user.id
      });

      setPathologyFormData({
        patientId: id,
        doctorId: '',
        tests: [],
        preferredDate: new Date().toISOString().slice(0, 10),
        preferredTime: '09:00',
        urgency: 'routine',
        homeCollection: false,
        collectionAddress: '',
        notes: '',
        discount: 0,
        paymentMethod: 'cash'
      });
      setShowPathologyForm(false);
      fetchPathologyBookings();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create pathology booking');
    }
  };

  // Toggle pathology modal
  const togglePathologyModal = () => {
    console.log('Toggling pathology modal, current state:', showPathologyForm);
    const newState = !showPathologyForm;
    console.log('Setting pathology modal to:', newState);
    setShowPathologyForm(newState);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAppointmentFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle pathology form input changes
  const handlePathologyInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPathologyFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  // Handle test selection
  const handleTestSelection = (testId) => {
    setPathologyFormData(prev => {
      const isSelected = prev.tests.includes(testId);
      return {
        ...prev,
        tests: isSelected 
          ? prev.tests.filter(id => id !== testId)
          : [...prev.tests, testId]
      };
    });
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'confirmed': return 'primary';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      case 'no_show': return 'secondary';
      default: return 'gray';
    }
  };

  // Get appointment type badge color
  const getAppointmentTypeColor = (type) => {
    switch (type) {
      case 'consultation': return 'info';
      case 'follow_up': return 'primary';
      case 'emergency': return 'danger';
      case 'surgery': return 'warning';
      case 'test': return 'secondary';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient Not Found</h2>
        <p className="text-gray-600 mb-4">The patient you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/receptionist/patients')} className="btn-primary">
          Back to Patients
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/receptionist/patients')}
            className="btn-secondary flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Patients
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Patient Details</h1>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center mb-6">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="alert alert-warning mb-6">
          {warnings.map((warning, index) => (
            <div key={index} className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {warning}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Information */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Patient Information</h2>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{patient.name}</h3>
                    <p className="text-sm text-gray-500">
                      {patient.opdNumber || patient.emergencyNumber || 'No ID'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{patient.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{patient.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">Age: {patient.age || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">Gender: {patient.gender || 'N/A'}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Medical History</h4>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Current Issues:</span>
                      <p className="mt-1">{patient.currentIssues || 'None recorded'}</p>
                    </div>
                    {patient.aadharNumber && (
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Aadhar Number:</span>
                        <p className="mt-1">{patient.aadharNumber}</p>
                      </div>
                    )}
                    {patient.address && (
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Address:</span>
                        <p className="mt-1">{patient.address}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Payment Status</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Balance:</span>
                    <span className={`font-semibold ${patient.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{patient.balanceAmount || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Section */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Appointment History</h2>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search appointments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input pl-10 w-48"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-input"
                >
                  <option value="all">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
            </div>
            <div className="card-body">
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No appointments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAppointments.map((appointment) => (
                    <div key={appointment._id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              Dr. {appointment.doctorId?.name || 'N/A'}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {formatDateTimeIST(appointment.appointmentDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`badge badge-${getAppointmentTypeColor(appointment.appointmentType)}`}>
                            {appointment.appointmentType?.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className={`badge badge-${getStatusBadgeColor(appointment.status)}`}>
                            {appointment.status?.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">Symptoms:</span>
                          <p className="mt-1">{appointment.symptoms}</p>
                        </div>
                        {appointment.notes && (
                          <div className="text-sm text-gray-700">
                            <span className="font-medium">Notes:</span>
                            <p className="mt-1">{appointment.notes}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-500">
                              Queue: {appointment.queueNumber || 'N/A'}
                            </span>
                            <span className="text-gray-500">
                              Fee: ₹{appointment.consultationFee || 500}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {appointment.paymentStatus === 'paid' ? (
                              <span className="badge badge-success">PAID</span>
                            ) : (
                              <span className="badge badge-warning">PENDING</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Medical Records Section */}
                      {medicalRecords[appointment._id] && (
                        <div className="border-t pt-4 mt-4">
                          <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            Medical Records
                          </h5>
                          
                          {/* Prescriptions */}
                          {medicalRecords[appointment._id].prescriptions.length > 0 && (
                            <div className="mb-3">
                              <h6 className="text-sm font-medium text-gray-700 mb-2">Prescriptions</h6>
                              <div className="space-y-2">
                                {medicalRecords[appointment._id].prescriptions.map((prescription) => (
                                  <div key={prescription._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex items-center space-x-2">
                                      <FileText className="h-3 w-3 text-blue-600" />
                                      <span className="text-sm">
                                        {prescription.type === 'image' ? 'Prescription Image' : 'Form Prescription'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {formatDateIST(prescription.createdAt)}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleDownload('prescription', prescription._id, `prescription_${prescription._id}`)}
                                      className="btn btn-sm btn-secondary"
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Download
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Other Medical Records */}
                          {['pathology', 'xray', 'ct', 'ultrasound', 'mri', 'ecg', 'surgery'].map((recordType) => {
                            const records = medicalRecords[appointment._id][recordType];
                            if (records.length === 0) return null;
                            
                            return (
                              <div key={recordType} className="mb-3">
                                <h6 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                                  {recordType === 'xray' ? 'X-Ray' : recordType.toUpperCase()} Reports
                                </h6>
                                <div className="space-y-2">
                                  {records.map((record) => (
                                    <div key={record._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                      <div className="flex items-center space-x-2">
                                        <Activity className="h-3 w-3 text-green-600" />
                                        <span className="text-sm">{record.description}</span>
                                        <span className="text-xs text-gray-500">
                                          {formatDateIST(record.reportDate)}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleDownload('medical-record', record._id, `${recordType}_${record._id}`)}
                                        className="btn btn-sm btn-secondary"
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        Download
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          
                          {medicalRecords[appointment._id].prescriptions.length === 0 &&
                           ['pathology', 'xray', 'ct', 'ultrasound', 'mri', 'ecg', 'surgery'].every(
                             type => medicalRecords[appointment._id][type].length === 0
                           ) && (
                            <p className="text-sm text-gray-500 italic">No medical records available for this appointment</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pathology Test History Section */}
      <div className="lg:col-span-3 mt-6">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pathology Test History</h2>
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {pathologyBookings.length} test{pathologyBookings.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
          <div className="card-body">
            {pathologyBookings.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No pathology tests found</p>
                <button
                  onClick={togglePathologyModal}
                  className="btn-primary mt-4"
                >
                  Book First Pathology Test
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {pathologyBookings.map((booking) => (
                  <div key={booking._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Activity className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            Pathology Tests
                          </h4>
                          <p className="text-sm text-gray-500">
                            {formatDateTimeIST(booking.bookingDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`badge badge-${
                          booking.status === 'booked' ? 'info' :
                          booking.status === 'sample_collected' ? 'warning' :
                          booking.status === 'completed' ? 'success' :
                          'secondary'
                        }`}>
                          {booking.status?.replace('_', ' ').toUpperCase()}
                        </span>
                        {booking.totalAmount && (
                          <span className="badge badge-primary">
                            ₹{booking.totalAmount}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Doctor:</span>
                        <p className="mt-1">Dr. {booking.doctorId?.name || 'N/A'}</p>
                      </div>
                      
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Tests:</span>
                        <div className="mt-1 space-y-1">
                          {booking.tests?.map((test, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <div>
                                <span className="font-medium">{test.testName}</span>
                                <span className="text-gray-500 ml-2">({test.testCode})</span>
                                <span className="text-gray-500 ml-2">- {test.category}</span>
                              </div>
                              <span className="text-sm font-medium">₹{test.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {booking.notes && (
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">Notes:</span>
                          <p className="mt-1">{booking.notes}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-500">
                            Urgency: {booking.urgency || 'Routine'}
                          </span>
                          <span className="text-gray-500">
                            Home Collection: {booking.homeCollection ? 'Yes' : 'No'}
                          </span>
                          {booking.sampleCollection?.isCollected && (
                            <span className="text-green-600">
                              Sample Collected: {formatDateIST(booking.sampleCollection.collectedDate)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {booking.paymentStatus === 'paid' ? (
                            <span className="badge badge-success">PAID</span>
                          ) : (
                            <span className="badge badge-warning">PENDING</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Reports Section */}
                      {booking.reports && booking.reports.length > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Test Reports</h6>
                          <div className="space-y-2">
                            {booking.reports.map((report, index) => (
                              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-sm">{report.testId?.name || 'Test'}</span>
                                  <span className={`badge badge-${getReportStatusBadgeColor(report.status)}`}>
                                    {report.status?.toUpperCase()}
                                  </span>
                                </div>
                                {report.reportUrl && (
                                  <button
                                    onClick={() => window.open(report.reportUrl, '_blank')}
                                    className="btn btn-sm btn-info"
                                    title="View Report"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Radiology Test History Section */}
      <div className="lg:col-span-3 mt-6">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Radiology Test History</h2>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {radiologyBookings.length} test{radiologyBookings.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
          <div className="card-body">
            {radiologyBookings.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No radiology tests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {radiologyBookings.map((booking) => (
                  <div key={booking._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {booking.bookingId || booking._id.slice(-8)}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {formatDateTimeIST(booking.bookingDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`badge badge-${
                          booking.status === 'booked' ? 'info' :
                          booking.status === 'scan_collected' ? 'warning' :
                          booking.status === 'in_progress' ? 'primary' :
                          booking.status === 'completed' ? 'success' : 'secondary'
                        }`}>
                          {booking.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-700">Tests:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {booking.tests.map((test, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {test.testName}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span className="text-gray-500">
                          Urgency: {booking.urgency || 'Routine'}
                        </span>
                        {booking.scanCollection?.isCollected && (
                          <span className="text-green-600">
                            Scan Collected: {formatDateIST(booking.scanCollection.collectedDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {booking.paymentStatus === 'paid' ? (
                          <span className="badge badge-success">PAID</span>
                        ) : (
                          <span className="badge badge-warning">PENDING</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Reports Section */}
                    {booking.reports && booking.reports.length > 0 && (
                      <div className="border-t pt-3 mt-3">
                        <h6 className="text-sm font-medium text-gray-700 mb-2">Scan Reports</h6>
                        <div className="space-y-2">
                          {booking.reports.map((report, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">{report.testId?.name || 'Test'}</span>
                                <span className={`badge badge-${getReportStatusBadgeColor(report.status)}`}>
                                  {report.status?.toUpperCase()}
                                </span>
                              </div>
                              {report.status === 'completed' && (
                                <button
                                  onClick={() => navigate(`/radiology/booking/${booking._id}`)}
                                  className="btn btn-sm btn-info"
                                  title="View Report"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bills Section */}
      <div className="lg:col-span-3 mt-6">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Bills & Payment History</h2>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {bills.length} bill{bills.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
          <div className="card-body">
            {bills.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No bills found for this patient</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bills.map((bill) => (
                  <div key={bill._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {bill.description || 'Bill'}
                            {bill.admissionId && (
                              <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                Admission {bill.admissionId}
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {formatDateTimeIST(bill.billDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`badge badge-${
                          bill.status === 'paid' ? 'success' :
                          bill.status === 'partial' ? 'warning' :
                          bill.status === 'cancelled' ? 'secondary' :
                          'danger'
                        }`}>
                          {bill.status?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Bill Number:</span>
                        <span className="font-medium">{bill.billNumber}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="font-medium">₹{bill.totalAmount || bill.amount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Paid Amount:</span>
                        <span className="font-medium text-green-600">₹{bill.totalPaid || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Balance:</span>
                        <span className={`font-medium ${bill.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₹{bill.balanceAmount || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Payment Method:</span>
                        <span className="font-medium">
                          {bill.paymentDetails?.paymentMethod ? bill.paymentDetails.paymentMethod.toUpperCase() : 'N/A'}
                        </span>
                      </div>
                      {bill.paymentDetails?.utrNumber && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Reference:</span>
                          <span className="font-medium">{bill.paymentDetails.utrNumber}</span>
                        </div>
                      )}
                      {bill.paymentSources && bill.paymentSources.length > 0 && (
                        <div className="border-t pt-2 mt-2">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Payment Breakdown</h6>
                          <div className="space-y-1">
                            {bill.paymentSources.map((source, index) => (
                              <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                <div>
                                  <span className="font-medium capitalize">{source.sourceType}</span>
                                  {source.paymentMethod && (
                                    <span className="text-gray-500 ml-2">({source.paymentMethod.toUpperCase()})</span>
                                  )}
                                </div>
                                <span className="font-medium">₹{source.amount}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admission History Section */}
      <div className="lg:col-span-3 mt-6">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Admission & Bed History</h2>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {admissions.length} admission{admissions.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
          <div className="card-body">
            {admissions.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No admission history found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {admissions.map((admission) => (
                  <div key={admission._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {admission.admissionId || admission._id.slice(-8)}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {formatDateIST(admission.admissionDate)} - {admission.status?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Doctors:</span>
                        <p className="mt-1">
                          {admission.doctorIds?.map(d => d.name).join(', ') || 'N/A'}
                        </p>
                      </div>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Current Bed:</span>
                        <p className="mt-1">
                          {admission.bedId?.bedNumber || admission.bedNumber} ({admission.bedId?.wardType || admission.bedType})
                        </p>
                      </div>
                    </div>

                    {admission.bedHistory?.length > 0 && (
                      <div className="border-t pt-3">
                        <h6 className="text-sm font-medium text-gray-700 mb-2">Bed Shift History</h6>
                        <div className="space-y-2">
                          {admission.bedHistory.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                              <div>
                                <span className="font-medium">{entry.bedNumber}</span>
                                <span className="text-gray-500 ml-2">({entry.bedType?.replace('_', ' ')})</span>
                                <span className="text-gray-500 ml-2">₹{entry.pricePerDay}/day</span>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500">
                                  {formatDateIST(entry.startDate)}
                                  {entry.endDate ? ` - ${formatDateIST(entry.endDate)}` : ' - Present'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appointment Booking Modal */}
      {showAppointmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl transform transition-all" style={{ position: 'relative', zIndex: 10000 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Book Appointment</h3>
              <button
                onClick={() => setShowAppointmentForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAppointmentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Doctor *</label>
                  <select
                    name="doctorId"
                    value={appointmentFormData.doctorId}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  >
                    <option value="">Select a doctor...</option>
                    {doctors.map((doctor) => (
                      <option key={doctor._id} value={doctor._id}>
                        Dr. {doctor.name} - {doctor.specialities?.join(', ') || 'General'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Appointment Date *</label>
                  <input
                    type="datetime-local"
                    name="appointmentDate"
                    value={appointmentFormData.appointmentDate}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Appointment Type *</label>
                <select
                  name="appointmentType"
                  value={appointmentFormData.appointmentType}
                  onChange={handleInputChange}
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

              <div>
                <label className="form-label">Symptoms *</label>
                <textarea
                  name="symptoms"
                  value={appointmentFormData.symptoms}
                  onChange={handleInputChange}
                  className="form-input"
                  rows="3"
                  required
                  placeholder="Describe the symptoms or reason for visit..."
                />
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  name="notes"
                  value={appointmentFormData.notes}
                  onChange={handleInputChange}
                  className="form-input"
                  rows="2"
                  placeholder="Additional notes (optional)..."
                />
              </div>

              <div className="flex justify-end space-x-3">
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
      )}

    {/* Appointment Booking Modal */}
    {showAppointmentForm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl transform transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Book Appointment</h3>
            <button
              onClick={() => setShowAppointmentForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleAppointmentSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Doctor *</label>
                <select
                  name="doctorId"
                  value={appointmentFormData.doctorId}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                >
                  <option value="">Select a doctor...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.name} - {doctor.specialities?.join(', ') || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Appointment Date *</label>
                <input
                  type="datetime-local"
                  name="appointmentDate"
                  value={appointmentFormData.appointmentDate}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Appointment Type *</label>
                <select
                  name="appointmentType"
                  value={appointmentFormData.appointmentType}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                >
                  <option value="consultation">Consultation</option>
                  <option value="opd">OPD</option>
                  <option value="emergency">Emergency</option>
                  <option value="surgery">Surgery</option>
                </select>
              </div>

              <div>
                <label className="form-label">Consultation Fee</label>
                <input
                  type="number"
                  name="consultationFee"
                  value={appointmentFormData.consultationFee}
                  onChange={handleInputChange}
                  className="form-input"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Symptoms *</label>
              <textarea
                name="symptoms"
                value={appointmentFormData.symptoms}
                onChange={handleInputChange}
                className="form-input"
                rows="3"
                placeholder="Describe patient symptoms..."
                required
              />
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                value={appointmentFormData.notes}
                onChange={handleInputChange}
                className="form-input"
                rows="2"
                placeholder="Additional notes (optional)..."
              />
            </div>

            <div className="flex justify-end space-x-3">
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
    )}

    {/* Pathology Test Booking Modal */}
    {showPathologyForm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl transform transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Book Pathology Test</h3>
            <button
              onClick={() => setShowPathologyForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <form onSubmit={handlePathologySubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Doctor *</label>
                <select
                  name="doctorId"
                  value={pathologyFormData.doctorId}
                  onChange={handlePathologyInputChange}
                  className="form-input"
                  required
                >
                  <option value="">Select a doctor...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.name} - {doctor.specialities?.join(', ') || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Preferred Date *</label>
                <input
                  type="date"
                  name="preferredDate"
                  value={pathologyFormData.preferredDate}
                  onChange={handlePathologyInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Preferred Time *</label>
                <input
                  type="time"
                  name="preferredTime"
                  value={pathologyFormData.preferredTime}
                  onChange={handlePathologyInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Urgency *</label>
                <select
                  name="urgency"
                  value={pathologyFormData.urgency}
                  onChange={handlePathologyInputChange}
                  className="form-input"
                  required
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label className="form-label">Payment Method</label>
                <select
                  name="paymentMethod"
                  value={pathologyFormData.paymentMethod}
                  onChange={handlePathologyInputChange}
                  className="form-input"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="online">Online</option>
                  <option value="insurance">Insurance</option>
                </select>
              </div>

              <div>
                <label className="form-label">Discount</label>
                <input
                  type="number"
                  name="discount"
                  value={pathologyFormData.discount}
                  onChange={handlePathologyInputChange}
                  className="form-input"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Select Tests *</label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {pathologyTests.length === 0 ? (
                  <p className="text-gray-500">No pathology tests available</p>
                ) : (
                  <div className="space-y-2">
                    {pathologyTests.map((test) => (
                      <div key={test._id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`test-${test._id}`}
                            checked={pathologyFormData.tests.includes(test._id)}
                            onChange={() => handleTestSelection(test._id)}
                            className="form-checkbox"
                          />
                          <div>
                            <label htmlFor={`test-${test._id}`} className="font-medium text-gray-900 cursor-pointer">
                              {test.name}
                            </label>
                            <p className="text-sm text-gray-500">{test.category} - {test.sampleType}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">₹{test.pricing.sellingPrice}</p>
                          <p className="text-xs text-gray-500">{test.provider?.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {pathologyFormData.tests.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected tests: {pathologyFormData.tests.length} | 
                  Total: ₹{pathologyFormData.tests.reduce((sum, testId) => {
                    const test = pathologyTests.find(t => t._id === testId);
                    return sum + (test?.pricing.sellingPrice || 0);
                  }, 0)}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="homeCollection"
                name="homeCollection"
                checked={pathologyFormData.homeCollection}
                onChange={handlePathologyInputChange}
                className="form-checkbox"
              />
              <label htmlFor="homeCollection" className="text-sm text-gray-700">
                Home Collection (Additional charges may apply)
              </label>
            </div>

            {pathologyFormData.homeCollection && (
              <div>
                <label className="form-label">Collection Address</label>
                <textarea
                  name="collectionAddress"
                  value={pathologyFormData.collectionAddress}
                  onChange={handlePathologyInputChange}
                  className="form-input"
                  rows="2"
                  placeholder="Enter collection address..."
                />
              </div>
            )}

            <div>
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                value={pathologyFormData.notes}
                onChange={handlePathologyInputChange}
                className="form-input"
                rows="2"
                placeholder="Additional notes (optional)..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowPathologyForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={pathologyFormData.tests.length === 0}
              >
                Book Pathology Test
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
};

export default PatientDetailsPage;
