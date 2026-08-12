import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTimeIST } from '../utils/dateUtils';
import { 
  ArrowLeft, 
  Plus, 
  Thermometer, 
  Heart, 
  Droplets, 
  Wind,
  Activity,
  Calendar,
  User
} from 'lucide-react';

const PatientVitals = () => {
  const navigate = useNavigate();
  const { admissionId } = useParams();
  const { api } = useAuth();
  
  const [admission, setAdmission] = useState(null);
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [vitalFormData, setVitalFormData] = useState({
    temperature: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    notes: ''
  });

  const fetchVitals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/nurse/vitals/${admissionId}`);
      setVitals(response.data.vitalReports || []);
      
      // Also fetch admission details
      const admissionRes = await api.get(`/admissions/${admissionId}`);
      setAdmission(admissionRes.data.admission);
    } catch (error) {
      console.error('Error fetching vitals:', error);
      setError('Failed to load vitals');
    } finally {
      setLoading(false);
    }
  }, [api, admissionId]);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  const handleAddVitals = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await api.post(`/nurse/vitals/${admissionId}`, vitalFormData);
      setShowForm(false);
      setVitalFormData({
        temperature: '',
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        heartRate: '',
        respiratoryRate: '',
        oxygenSaturation: '',
        notes: ''
      });
      fetchVitals();
    } catch (error) {
      console.error('Error adding vitals:', error);
      setError(error.response?.data?.message || 'Failed to add vitals');
    } finally {
      setSubmitting(false);
    }
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
        .patient-vitals {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .info-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
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

      <div className="patient-vitals">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/nurse/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Patient Vitals</h1>
              <p className="text-gray-600 text-sm">
                {admission?.patientId?.name || 'Loading...'} - {admission?.bedId?.bedNumber || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Vitals
          </button>
        </div>

        {error && (
          <div className="flex items-center p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        {/* Add Vitals Form */}
        {showForm && (
          <div className="info-card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Record New Vitals</h2>
            <form onSubmit={handleAddVitals}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalFormData.temperature}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, temperature: e.target.value })}
                    className="form-input"
                    placeholder="98.6"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={vitalFormData.heartRate}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, heartRate: e.target.value })}
                    className="form-input"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BP Systolic</label>
                  <input
                    type="number"
                    value={vitalFormData.bloodPressureSystolic}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, bloodPressureSystolic: e.target.value })}
                    className="form-input"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic</label>
                  <input
                    type="number"
                    value={vitalFormData.bloodPressureDiastolic}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, bloodPressureDiastolic: e.target.value })}
                    className="form-input"
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate</label>
                  <input
                    type="number"
                    value={vitalFormData.respiratoryRate}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, respiratoryRate: e.target.value })}
                    className="form-input"
                    placeholder="16"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">O2 Saturation (%)</label>
                  <input
                    type="number"
                    value={vitalFormData.oxygenSaturation}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, oxygenSaturation: e.target.value })}
                    className="form-input"
                    placeholder="98"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows="3"
                  value={vitalFormData.notes}
                  onChange={(e) => setVitalFormData({ ...vitalFormData, notes: e.target.value })}
                  className="form-input"
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setVitalFormData({
                      temperature: '',
                      bloodPressureSystolic: '',
                      bloodPressureDiastolic: '',
                      heartRate: '',
                      respiratoryRate: '',
                      oxygenSaturation: '',
                      notes: ''
                    });
                  }}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Vitals Table */}
        <div className="info-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vitals History</h2>
          {vitals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No vitals recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date & Time</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Temperature</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Heart Rate</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Blood Pressure</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Respiratory Rate</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">O2 Saturation</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Recorded By</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((vital, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {formatDateTimeIST(vital.date)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center">
                          <Thermometer className="h-4 w-4 mr-2 text-red-500" />
                          {vital.temperature || '-'}°F
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center">
                          <Heart className="h-4 w-4 mr-2 text-pink-500" />
                          {vital.heartRate || '-'} bpm
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center">
                          <Droplets className="h-4 w-4 mr-2 text-purple-500" />
                          {vital.bloodPressure?.systolic || '-'}/{vital.bloodPressure?.diastolic || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center">
                          <Wind className="h-4 w-4 mr-2 text-cyan-500" />
                          {vital.respiratoryRate || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center">
                          <Activity className="h-4 w-4 mr-2 text-green-500" />
                          {vital.oxygenSaturation || '-'}%
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {vital.recordedBy?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 max-w-xs truncate">
                        {vital.notes || '-'}
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

export default PatientVitals;
