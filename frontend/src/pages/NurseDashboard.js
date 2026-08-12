import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST, formatDateTimeIST, formatTimeIST } from '../utils/dateUtils';
import { 
  Bed, 
  Calendar, 
  Activity, 
  User, 
  Thermometer, 
  Heart, 
  Droplets, 
  Wind,
  Plus,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

const NurseDashboard = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('assigned-beds');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [allBeds, setAllBeds] = useState([]);
  const [assignedBeds, setAssignedBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [opdAppointments, setOpdAppointments] = useState([]);
  const [surgeries, setSurgeries] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/nurse/dashboard');
      setAllBeds(response.data.allBeds || []);
      setAssignedBeds(response.data.assignedBeds || []);
      setAdmissions(response.data.admissions || []);
      setOpdAppointments(response.data.opdAppointments || []);
      setSurgeries(response.data.surgeries || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const wardTypeLabels = {
    emergency: 'Emergency',
    icu: 'ICU',
    general_ward: 'General Ward',
    private_ward: 'Private Ward'
  };

  const statusColors = {
    available: 'bg-green-100 text-green-800',
    occupied: 'bg-red-100 text-red-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
    reserved: 'bg-blue-100 text-blue-800'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <style>{`
        .nurse-dashboard {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
        }
        .info-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        .btn-primary:hover {
          background: #2563eb;
        }
        .btn-secondary {
          background: #6b7280;
          color: white;
        }
        .form-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="nurse-dashboard">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nurse Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your assigned patients and beds</p>
        </div>

        {error && (
          <div className="flex items-center p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Assigned Beds</p>
                <p className="text-2xl font-bold text-gray-900">{assignedBeds.length}</p>
              </div>
              <Bed className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Admitted Patients</p>
                <p className="text-2xl font-bold text-gray-900">{admissions.length}</p>
              </div>
              <User className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's OPD</p>
                <p className="text-2xl font-bold text-gray-900">{opdAppointments.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Surgeries</p>
                <p className="text-2xl font-bold text-gray-900">{surgeries.length}</p>
              </div>
              <Activity className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('assigned-beds')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'assigned-beds'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bed className="inline h-4 w-4 mr-2" />
              Assigned Beds ({assignedBeds.length})
            </button>
            <button
              onClick={() => setActiveTab('all-beds')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'all-beds'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bed className="inline h-4 w-4 mr-2" />
              All Beds ({allBeds.length})
            </button>
            <button
              onClick={() => setActiveTab('opd')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'opd'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="inline h-4 w-4 mr-2" />
              OPD Appointments ({opdAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab('surgeries')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'surgeries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Activity className="inline h-4 w-4 mr-2" />
              Surgeries ({surgeries.length})
            </button>
          </nav>
        </div>

        {/* Assigned Beds */}
        {activeTab === 'assigned-beds' && (
          <div>
            {assignedBeds.length === 0 ? (
              <div className="info-card text-center py-8 text-gray-500">
                No beds assigned to you
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedBeds.map(bed => (
                  <div key={bed._id} className="info-card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{bed.bedNumber}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[bed.status]}`}>
                        {bed.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{wardTypeLabels[bed.wardType]}</p>
                    <p className="text-sm text-gray-500">Floor {bed.floor || 'N/A'} - Room {bed.roomNumber || 'N/A'}</p>
                    {bed.currentAdmission && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium text-gray-900">
                          Patient: {bed.currentAdmission.patientId?.name || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Admitted: {formatDateIST(bed.currentAdmission.admissionDate)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Beds */}
        {activeTab === 'all-beds' && (
          <div>
            {allBeds.length === 0 ? (
              <div className="info-card text-center py-8 text-gray-500">
                No beds in the hospital
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allBeds.map(bed => (
                  <div key={bed._id} className="info-card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{bed.bedNumber}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[bed.status]}`}>
                        {bed.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{wardTypeLabels[bed.wardType]}</p>
                    <p className="text-sm text-gray-500">Floor {bed.floor || 'N/A'} - Room {bed.roomNumber || 'N/A'}</p>
                    {bed.currentAdmission && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium text-gray-900">
                          Patient: {bed.currentAdmission.patientId?.name || 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OPD Appointments */}
        {activeTab === 'opd' && (
          <div>
            {opdAppointments.length === 0 ? (
              <div className="info-card text-center py-8 text-gray-500">
                No OPD appointments for today
              </div>
            ) : (
              <div className="space-y-3">
                {opdAppointments.map(appointment => (
                  <div key={appointment._id} className="info-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{appointment.patientId?.name || 'N/A'}</h3>
                        <p className="text-sm text-gray-600">Dr. {appointment.doctorId?.name || 'N/A'}</p>
                        <p className="text-sm text-gray-500">
                          {formatTimeIST(appointment.appointmentTime)}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Surgeries */}
        {activeTab === 'surgeries' && (
          <div>
            {surgeries.length === 0 ? (
              <div className="info-card text-center py-8 text-gray-500">
                No surgeries assigned
              </div>
            ) : (
              <div className="space-y-3">
                {surgeries.map(surgery => (
                  <div key={surgery._id} className="info-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{surgery.patientId?.name || 'N/A'}</h3>
                        <p className="text-sm text-gray-600">{surgery.admissionReason}</p>
                        <p className="text-sm text-gray-500">
                          Doctors: {surgery.doctorIds?.map(d => d.name).join(', ') || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-400">
                          Admitted: {formatDateIST(surgery.admissionDate)}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admitted Patients with Vitals */}
        {admissions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Admitted Patients - Vitals Management</h2>
            <div className="space-y-4">
              {admissions.map(admission => (
                <div key={admission._id} className="info-card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{admission.patientId?.name || 'N/A'}</h3>
                      <p className="text-sm text-gray-600">
                        {admission.bedId?.bedNumber || 'N/A'} - {wardTypeLabels[admission.bedType]}
                      </p>
                      <p className="text-xs text-gray-500">
                        Admitted: {formatDateIST(admission.admissionDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/nurse/vitals/${admission._id}`)}
                      className="btn btn-primary flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Manage Vitals
                    </button>
                  </div>

                  {/* Recent Vitals */}
                  {admission.vitalReports && admission.vitalReports.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Vitals</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {admission.vitalReports.slice(-1).map((vital, idx) => (
                          <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center text-sm text-gray-600 mb-1">
                              <Thermometer className="h-4 w-4 mr-1" />
                              <span>Temp</span>
                            </div>
                            <p className="font-semibold text-gray-900">{vital.temperature || 'N/A'}°F</p>
                            
                            <div className="flex items-center text-sm text-gray-600 mb-1 mt-2">
                              <Heart className="h-4 w-4 mr-1" />
                              <span>HR</span>
                            </div>
                            <p className="font-semibold text-gray-900">{vital.heartRate || 'N/A'} bpm</p>
                            
                            <div className="flex items-center text-sm text-gray-600 mb-1 mt-2">
                              <Droplets className="h-4 w-4 mr-1" />
                              <span>BP</span>
                            </div>
                            <p className="font-semibold text-gray-900">
                              {vital.bloodPressure?.systolic || 'N/A'}/{vital.bloodPressure?.diastolic || 'N/A'}
                            </p>
                            
                            <div className="flex items-center text-sm text-gray-600 mb-1 mt-2">
                              <Wind className="h-4 w-4 mr-1" />
                              <span>O2</span>
                            </div>
                            <p className="font-semibold text-gray-900">{vital.oxygenSaturation || 'N/A'}%</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Recorded by {admission.vitalRecords?.[admission.vitalReports.length - 1]?.recordedBy?.name || 'N/A'} at {formatDateTimeIST(admission.vitalReports[admission.vitalReports.length - 1].date)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NurseDashboard;
