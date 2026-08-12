import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST } from '../utils/dateUtils';
import {
  Users,
  Calendar,
  CreditCard,
  AlertCircle,
  FlaskConical,
  Image,
  Clock,
  Bed,
  Plus,
  TrendingUp,
  Activity,
  UserCheck,
  FileText
} from 'lucide-react';

const ReceptionistDashboard = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    pendingBills: 0
  });
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch basic stats and admissions
        const [patientsRes, appointmentsRes, billingRes, admissionsRes] = await Promise.all([
          api.get(`/patients/hospital/${user.hospitalId}?limit=1`),
          api.get(`/appointments?date=${new Date().toISOString().split('T')[0]}`),
          api.get(`/billing/hospital/${user.hospitalId}?status=pending&limit=1`),
          api.get(`/admissions?status=admitted`)
        ]);
        
        setStats({
          totalPatients: patientsRes.data.pagination?.total || 0,
          todayAppointments: appointmentsRes.data.appointments?.length || 0,
          pendingBills: billingRes.data.bills?.length || 0
        });
        setAdmissions(admissionsRes.data.admissions || []);
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (user?.hospitalId) {
      fetchStats();
    }
  }, [api, user?.hospitalId]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Receptionist Dashboard</h1>
              <p className="text-slate-600 mt-1">Welcome back, {user?.name}</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">System Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex items-center text-blue-600 text-sm font-medium">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12%
              </div>
            </div>
            <div>
              <p className="text-slate-600 text-sm font-medium">Total Patients</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats.totalPatients.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-2">Active patients in system</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex items-center text-green-600 text-sm font-medium">
                <Activity className="h-4 w-4 mr-1" />
                Live
              </div>
            </div>
            <div>
              <p className="text-slate-600 text-sm font-medium">Today's Appointments</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats.todayAppointments}
              </p>
              <p className="text-xs text-slate-500 mt-2">Scheduled for today</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <CreditCard className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex items-center text-amber-600 text-sm font-medium">
                <AlertCircle className="h-4 w-4 mr-1" />
                Action
              </div>
            </div>
            <div>
              <p className="text-slate-600 text-sm font-medium">Pending Bills</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats.pendingBills}
              </p>
              <p className="text-xs text-slate-500 mt-2">Awaiting payment</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 justify-items-center">
            <button
              onClick={() => navigate('/receptionist/patients')}
              className="group p-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-full"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 4px 12px -2px rgba(59, 130, 246, 0.25)',
                borderRadius: '8px',
                aspectRatio: '1 / 1', maxWidth: '150px', maxHeight: '150px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
              }}
            >
              <div className="flex flex-col items-center justify-center text-center text-white h-full">
                <div className="bg-white/20 p-2 mb-2 group-hover:scale-105 transition-transform" style={{ borderRadius: '6px' }}>
                  <Users className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-xs">Patients</h3>
                <p className="text-blue-100 mt-0.5 text-xs">Manage</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/receptionist/appointments')}
              className="group p-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-full"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px -2px rgba(16, 185, 129, 0.25)',
                borderRadius: '8px',
                aspectRatio: '1 / 1', maxWidth: '150px', maxHeight: '150px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
              }}
            >
              <div className="flex flex-col items-center justify-center text-center text-white h-full">
                <div className="bg-white/20 p-2 mb-2 group-hover:scale-105 transition-transform" style={{ borderRadius: '6px' }}>
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-xs">Appointments</h3>
                <p className="text-green-100 mt-0.5 text-xs">Schedule</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/receptionist/queue')}
              className="group p-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-full"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.25)',
                borderRadius: '8px',
                aspectRatio: '1 / 1', maxWidth: '150px', maxHeight: '150px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
              }}
            >
              <div className="flex flex-col items-center justify-center text-center text-white h-full">
                <div className="bg-white/20 p-2 mb-2 group-hover:scale-105 transition-transform" style={{ borderRadius: '6px' }}>
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-xs">Queue</h3>
                <p className="text-indigo-100 mt-0.5 text-xs">View</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/receptionist/admission')}
              className="group p-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-full"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 4px 12px -2px rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                aspectRatio: '1 / 1', maxWidth: '150px', maxHeight: '150px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
              }}
            >
              <div className="flex flex-col items-center justify-center text-center text-white h-full">
                <div className="bg-white/20 p-2 mb-2 group-hover:scale-105 transition-transform" style={{ borderRadius: '6px' }}>
                  <Bed className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-xs">Admissions</h3>
                <p className="text-red-100 mt-0.5 text-xs">View</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/pathology/test-booking')}
              className="group p-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-full"
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                boxShadow: '0 4px 12px -2px rgba(168, 85, 247, 0.25)',
                borderRadius: '8px',
                aspectRatio: '1 / 1', maxWidth: '150px', maxHeight: '150px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)';
              }}
            >
              <div className="flex flex-col items-center justify-center text-center text-white h-full">
                <div className="bg-white/20 p-2 mb-2 group-hover:scale-105 transition-transform" style={{ borderRadius: '6px' }}>
                  <FlaskConical className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-xs">Pathology</h3>
                <p className="text-purple-100 mt-0.5 text-xs">Book</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/radiology/test-booking')}
              className="group p-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-full"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                boxShadow: '0 4px 12px -2px rgba(249, 115, 22, 0.25)',
                borderRadius: '8px',
                aspectRatio: '1 / 1', maxWidth: '150px', maxHeight: '150px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
              }}
            >
              <div className="flex flex-col items-center justify-center text-center text-white h-full">
                <div className="bg-white/20 p-2 mb-2 group-hover:scale-105 transition-transform" style={{ borderRadius: '6px' }}>
                  <Image className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-xs">Radiology</h3>
                <p className="text-orange-100 mt-0.5 text-xs">Book</p>
              </div>
            </button>
          </div>
        </div>

        {/* Admissions List */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bed className="h-5 w-5 text-slate-600 mr-2" />
                <h2 className="text-xl font-bold text-slate-900">Current Admissions</h2>
              </div>
              <button
                onClick={() => navigate('/receptionist/admission')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Admission
              </button>
            </div>
          </div>

          {admissions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bed className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No active admissions</p>
              <p className="text-sm text-slate-500 mt-1">Patient admissions will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Patient</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Admission</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Room</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Doctor</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admissions.map((admission) => (
                    <tr key={admission._id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center mr-3">
                            <UserCheck className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{admission.patientId?.name}</p>
                            <p className="text-sm text-slate-500">ID: {admission.patientId?.opdNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center text-sm text-slate-600">
                          <FileText className="h-4 w-4 mr-2 text-slate-400" />
                          {formatDateIST(admission.admissionDate)}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {admission.bedType} - {admission.bedNumber}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600">
                        {admission.doctorIds?.[0]?.name || 'N/A'}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          admission.status === 'admitted'
                            ? 'bg-green-100 text-green-700'
                            : admission.status === 'discharged'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {admission.status.charAt(0).toUpperCase() + admission.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
