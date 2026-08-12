import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST } from '../utils/dateUtils';
import { ArrowLeft, Bed, User, Calendar, Search, Plus, X } from 'lucide-react';

const AdmissionsList = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [availableBeds, setAvailableBeds] = useState([]);
  const [selectedBedId, setSelectedBedId] = useState('');
  const [dischargeDate, setDischargeDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const canManage = ['receptionist', 'hospital_admin', 'accounts', 'super_admin'].includes(user?.role);

  const fetchAdmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const statusFilter = filter !== 'all' ? `&status=${filter}` : '';
      const response = await api.get(`/admissions${statusFilter}`);
      setAdmissions(response.data.admissions || []);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch admissions');
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => {
    fetchAdmissions();
  }, [fetchAdmissions]);

  useEffect(() => {
    if (showModal && modalType === 'bed') {
      api.get('/beds?status=available')
        .then(res => setAvailableBeds(res.data.beds || []))
        .catch(() => setAvailableBeds([]));
    }
  }, [showModal, modalType, api]);

  const filteredAdmissions = admissions.filter(admission => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      admission.patientId?.name?.toLowerCase().includes(searchLower) ||
      admission.patientId?.opdNumber?.toLowerCase().includes(searchLower) ||
      admission.bedNumber?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'admitted':
        return 'bg-green-100 text-green-800';
      case 'discharged':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const openModal = (admission, type) => {
    setSelectedAdmission(admission);
    setModalType(type);
    setActionError('');
    setSelectedBedId('');
    setDischargeDate(new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAdmission(null);
    setModalType(null);
    setActionError('');
    setSelectedBedId('');
  };

  const handleChangeBed = async () => {
    if (!selectedBedId) {
      setActionError('Please select a bed');
      return;
    }

    const bed = availableBeds.find(b => b._id === selectedBedId);
    if (!bed) {
      setActionError('Selected bed not found');
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      await api.put(`/admissions/${selectedAdmission._id}`, {
        bedType: bed.wardType,
        bedNumber: bed.bedNumber
      });
      closeModal();
      fetchAdmissions();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Failed to change bed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDischarge = async () => {
    if (!dischargeDate) {
      setActionError('Please select a discharge date');
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      await api.put(`/admissions/${selectedAdmission._id}`, {
        status: 'discharged',
        dischargeDate
      });
      closeModal();
      fetchAdmissions();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Failed to discharge patient');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Admissions</h1>
        </div>
        <button
          onClick={() => navigate('/receptionist/admission/new')}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Admit Patient
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name, ID, or bed number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('admitted')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'admitted' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Admitted
            </button>
            <button
              onClick={() => setFilter('discharged')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'discharged' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Discharged
            </button>
          </div>
        </div>
      </div>

      {/* Admissions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : filteredAdmissions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <Bed className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>No admissions found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Admission Date</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Bed</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Doctor</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                {canManage && (
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAdmissions.map((admission) => (
                <tr key={admission._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{admission.patientId?.name}</p>
                        <p className="text-xs text-gray-500">{admission.patientId?.opdNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {formatDateIST(admission.admissionDate)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 mr-2 text-gray-400" />
                      {admission.bedType} - {admission.bedNumber}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {admission.doctorIds?.[0]?.name || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                    {admission.admissionReason}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(admission.status)}`}>
                      {admission.status.charAt(0).toUpperCase() + admission.status.slice(1)}
                    </span>
                  </td>
                  {canManage && (
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        {admission.status !== 'discharged' && (
                          <>
                            <button
                              onClick={() => openModal(admission, 'bed')}
                              className="btn btn-secondary text-xs"
                            >
                              Change Bed
                            </button>
                            <button
                              onClick={() => openModal(admission, 'discharge')}
                              className="btn btn-danger text-xs"
                            >
                              Discharge
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Change Bed / Discharge Modal */}
      {showModal && selectedAdmission && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', margin: '0 1rem', padding: '1.5rem' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {modalType === 'bed' ? 'Change Bed' : 'Discharge Patient'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Patient: <span className="font-medium">{selectedAdmission.patientId?.name}</span>
            </p>

            {actionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {actionError}
              </div>
            )}

            {modalType === 'bed' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select New Bed</label>
                {availableBeds.length === 0 ? (
                  <p className="text-sm text-gray-500">No available beds found</p>
                ) : (
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a bed</option>
                    {availableBeds.map(bed => (
                      <option key={bed._id} value={bed._id}>
                        {bed.wardType} - {bed.bedNumber} (₹{bed.pricePerDay}/day)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {modalType === 'discharge' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Date</label>
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={modalType === 'bed' ? handleChangeBed : handleDischarge}
                disabled={actionLoading}
                className="btn btn-primary"
              >
                {actionLoading ? 'Saving...' : modalType === 'bed' ? 'Change Bed' : 'Discharge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionsList;