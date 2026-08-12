import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  Activity,
  User,
  Phone,
  Play,
  CheckCircle,
  Search,
  Stethoscope,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST, formatTimeIST } from '../utils/dateUtils';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  
  // State
  const [opdQueue, setOpdQueue] = useState([]);
  const [emergencyQueue, setEmergencyQueue] = useState([]);
  const [surgeryQueue, setSurgeryQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return istDate.toISOString().split('T')[0];
  });
  const [dateRange, setDateRange] = useState('today'); // today, upcoming, past, all
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [schedulingData, setSchedulingData] = useState({
    appointmentId: '',
    scheduledDate: '',
    scheduledTime: '',
    notes: ''
  });

  // Fetch doctor's queues
  const fetchDoctorQueues = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      let apiUrl = `/appointments/doctor/${user.id}`;
      
      // Build API URL based on date range
      if (dateRange === 'today') {
        apiUrl += `/queue/${selectedDate}`;
      } else if (dateRange === 'upcoming') {
        // Get appointments from today onwards
        const today = new Date();
        const istToday = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const futureDate = new Date(istToday);
        futureDate.setDate(istToday.getDate() + 30); // Next 30 days
        apiUrl += `/queue/${istToday.toISOString().split('T')[0]}`;
      } else if (dateRange === 'past') {
        // Get appointments from past 30 days
        const today = new Date();
        const istToday = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const pastDate = new Date(istToday);
        pastDate.setDate(istToday.getDate() - 30);
        apiUrl += `/queue/${pastDate.toISOString().split('T')[0]}`;
      } else if (dateRange === 'all') {
        // Get all appointments (use a very old date to get everything)
        apiUrl += `/queue/2020-01-01`;
      }
      
      // Fetch OPD queue
      const opdResponse = await api.get(`${apiUrl}?type=opd${dateRange !== 'today' ? '&dateRange=' + dateRange : ''}`);
      setOpdQueue(opdResponse.data.queue || []);
      
      // Fetch Emergency queue
      const emergencyResponse = await api.get(`${apiUrl}?type=emergency${dateRange !== 'today' ? '&dateRange=' + dateRange : ''}`);
      setEmergencyQueue(emergencyResponse.data.queue || []);
      
      // Fetch Surgery queue
      const surgeryResponse = await api.get(`${apiUrl}?type=surgery${dateRange !== 'today' ? '&dateRange=' + dateRange : ''}`);
      setSurgeryQueue(surgeryResponse.data.queue || []);
      
    } catch (error) {
      console.error('Error fetching doctor queues:', error);
      setError(error.response?.data?.message || 'Failed to fetch queues');
    } finally {
      setLoading(false);
    }
  }, [api, user.id, selectedDate, dateRange]);

  useEffect(() => {
    if (user?.id) {
      fetchDoctorQueues();
    }
  }, [fetchDoctorQueues, user?.id]);

  // Handle patient card click - navigate to consultation page
  const handlePatientClick = (patient) => {
    navigate(`/doctor/consultation/${patient._id}`, {
      state: {
        appointment: patient,
        patient: patient.patientId
      }
    });
  };

  // Filter queues based on search and status
  const filterQueue = (queue) => {
    return queue.filter(patient => {
      const matchesSearch = searchTerm === '' || 
        patient.patientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.patientId?.phone?.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  // Handle patient status update
  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, { status: newStatus });
      fetchDoctorQueues();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      setError('Failed to update status');
    }
  };

  // Handle surgery scheduling
  const handleSurgeryScheduling = async (appointment) => {
    setSelectedPatient(appointment);
    setSchedulingData({
      appointmentId: appointment._id,
      scheduledDate: (() => {
        const now = new Date();
        const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        return istDate.toISOString().split('T')[0];
      })(),
      scheduledTime: '09:00',
      notes: ''
    });
    setShowSchedulingModal(true);
  };

  // Submit surgery scheduling
  const handleSchedulingSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/appointments/${schedulingData.appointmentId}/schedule`, {
        scheduledDate: schedulingData.scheduledDate,
        scheduledTime: schedulingData.scheduledTime,
        notes: schedulingData.notes
      });
      
      setShowSchedulingModal(false);
      setSchedulingData({
        appointmentId: '',
        scheduledDate: '',
        scheduledTime: '',
        notes: ''
      });
      fetchDoctorQueues();
    } catch (error) {
      console.error('Error scheduling surgery:', error);
      setError('Failed to schedule surgery');
    }
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

  // Get priority color for emergency
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'secondary';
      default: return 'gray';
    }
  };

  // Render patient card
  const renderPatientCard = (patient, department) => (
    <button
      key={patient._id}
      onClick={() => handlePatientClick(patient)}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow w-full text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{patient.patientId?.name || 'N/A'}</h4>
            <p className="text-sm text-gray-500">
              {patient.patientId?.opdNumber ? `OPD ID: ${patient.patientId.opdNumber}` : 'No OPD ID'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`badge badge-${getStatusBadgeColor(patient.status)}`}>
            {patient.status?.replace('_', ' ').toUpperCase()}
          </span>
          {department === 'emergency' && (
            <span className={`badge badge-${getPriorityColor(patient.priority)}`}>
              {patient.priority?.toUpperCase()}
            </span>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-gray-500">
              <Phone className="h-3 w-3 inline mr-1" />
              {patient.patientId?.phone || 'N/A'}
            </span>
            <span className="text-gray-500">
              <Clock className="h-3 w-3 inline mr-1" />
              {formatTimeIST(patient.appointmentDate)}
            </span>
          </div>
          <span className="text-gray-500">
            Queue: {patient.queueNumber || 'N/A'}
          </span>
        </div>
        
        <div className="text-sm text-gray-700">
          <span className="font-medium">Symptoms:</span>
          <p className="mt-1">{patient.symptoms}</p>
        </div>
        
        {patient.notes && (
          <div className="text-sm text-gray-700">
            <span className="font-medium">Notes:</span>
            <p className="mt-1">{patient.notes}</p>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <div className="flex items-center space-x-2">
          {department === 'opd' && (
            <>
              {patient.status === 'scheduled' && (
                <button
                  onClick={() => handleStatusUpdate(patient._id, 'in_progress')}
                  className="btn-sm btn-primary flex items-center"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </button>
              )}
              {patient.status === 'in_progress' && (
                <button
                  onClick={() => handleStatusUpdate(patient._id, 'completed')}
                  className="btn-sm btn-success flex items-center"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedPatient(patient);
                  setShowPatientDetails(true);
                }}
                className="btn-sm btn-secondary flex items-center"
              >
                <User className="h-3 w-3 mr-1" />
                Details
              </button>
            </>
          )}
          
          {department === 'emergency' && (
            <>
              {patient.status === 'scheduled' && (
                <button
                  onClick={() => handleStatusUpdate(patient._id, 'in_progress')}
                  className="btn-sm btn-warning flex items-center"
                >
                  <Activity className="h-3 w-3 mr-1" />
                  Triage
                </button>
              )}
              {patient.status === 'in_progress' && (
                <button
                  onClick={() => handleStatusUpdate(patient._id, 'completed')}
                  className="btn-sm btn-success flex items-center"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Treat
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedPatient(patient);
                  setShowPatientDetails(true);
                }}
                className="btn-sm btn-secondary flex items-center"
              >
                <User className="h-3 w-3 mr-1" />
                Details
              </button>
            </>
          )}
          
          {department === 'surgery' && (
            <>
              {!patient.scheduledDate && (
                <button
                  onClick={() => handleSurgeryScheduling(patient)}
                  className="btn-sm btn-primary flex items-center"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Schedule
                </button>
              )}
              {patient.scheduledDate && (
                <div className="text-sm text-gray-600">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {formatDateIST(patient.scheduledDate)}
                  <Clock className="h-3 w-3 inline ml-2 mr-1" />
                  {patient.scheduledTime}
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedPatient(patient);
                  setShowPatientDetails(true);
                }}
                className="btn-sm btn-secondary flex items-center"
              >
                <User className="h-3 w-3 mr-1" />
                Details
              </button>
            </>
          )}
        </div>
      </div>
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
          <p className="text-gray-600">Dr. {user?.name} - {user?.specialities?.join(', ') || 'General Practitioner'}</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="form-input"
          >
            <option value="today">Today</option>
            <option value="upcoming">Upcoming (30 days)</option>
            <option value="past">Past (30 days)</option>
            <option value="all">All Appointments</option>
          </select>
          {dateRange === 'today' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-input"
            />
          )}
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patients..."
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
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center mb-6">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Department Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OPD Queue */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                <h2 className="card-title">OPD Queue</h2>
              </div>
              <span className="badge badge-info">{filterQueue(opdQueue).length} patients</span>
            </div>
          </div>
          <div className="card-body">
            {filterQueue(opdQueue).length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No patients in OPD queue</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filterQueue(opdQueue).map(patient => renderPatientCard(patient, 'opd'))}
              </div>
            )}
          </div>
        </div>

        {/* Emergency Queue */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h2 className="card-title">Emergency Queue</h2>
              </div>
              <span className="badge badge-danger">{filterQueue(emergencyQueue).length} patients</span>
            </div>
          </div>
          <div className="card-body">
            {filterQueue(emergencyQueue).length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No patients in emergency queue</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filterQueue(emergencyQueue).map(patient => renderPatientCard(patient, 'emergency'))}
              </div>
            )}
          </div>
        </div>

        {/* Surgery Queue */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-purple-600" />
                <h2 className="card-title">Surgery Queue</h2>
              </div>
              <span className="badge badge-purple">{filterQueue(surgeryQueue).length} patients</span>
            </div>
          </div>
          <div className="card-body">
            {filterQueue(surgeryQueue).length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No patients in surgery queue</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filterQueue(surgeryQueue).map(patient => renderPatientCard(patient, 'surgery'))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Details Modal */}
      {showPatientDetails && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Patient Details</h3>
              <button
                onClick={() => setShowPatientDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Patient Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Name:</span>
                    <p>{selectedPatient.patientId?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium">ID:</span>
                    <p>{selectedPatient.patientId?.opdNumber || selectedPatient.patientId?.emergencyNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>
                    <p>{selectedPatient.patientId?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Age:</span>
                    <p>{selectedPatient.patientId?.age || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Appointment Details</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Date:</span>
                    <p>{formatDateIST(selectedPatient.appointmentDate)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Time:</span>
                    <p>{formatTimeIST(selectedPatient.appointmentDate)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Type:</span>
                    <p>{selectedPatient.appointmentType?.replace('_', ' ').toUpperCase()}</p>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <p>{selectedPatient.status?.replace('_', ' ').toUpperCase()}</p>
                  </div>
                  <div>
                    <span className="font-medium">Symptoms:</span>
                    <p>{selectedPatient.symptoms}</p>
                  </div>
                  {selectedPatient.notes && (
                    <div>
                      <span className="font-medium">Notes:</span>
                      <p>{selectedPatient.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowPatientDetails(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Surgery Scheduling Modal */}
      {showSchedulingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Surgery</h3>
              <button
                onClick={() => setShowSchedulingModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSchedulingSubmit} className="space-y-4">
              <div>
                <label className="form-label">Patient</label>
                <div className="form-input bg-gray-50">
                  {selectedPatient?.patientId?.name || 'N/A'}
                </div>
              </div>
              
              <div>
                <label className="form-label">Scheduled Date *</label>
                <input
                  type="date"
                  value={schedulingData.scheduledDate}
                  onChange={(e) => setSchedulingData({...schedulingData, scheduledDate: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <div>
                <label className="form-label">Scheduled Time *</label>
                <input
                  type="time"
                  value={schedulingData.scheduledTime}
                  onChange={(e) => setSchedulingData({...schedulingData, scheduledTime: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <div>
                <label className="form-label">Notes</label>
                <textarea
                  value={schedulingData.notes}
                  onChange={(e) => setSchedulingData({...schedulingData, notes: e.target.value})}
                  className="form-input"
                  rows="3"
                  placeholder="Surgery notes and requirements..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSchedulingModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Schedule Surgery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
