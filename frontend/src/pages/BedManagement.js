import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Plus, Trash2, Edit, AlertCircle } from 'lucide-react';

const BedManagement = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  
  const [beds, setBeds] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBed, setEditingBed] = useState(null);
  const [filter, setFilter] = useState({ wardType: '', status: '' });

  const [formData, setFormData] = useState({
    bedNumber: '',
    wardType: 'general_ward',
    floor: '',
    roomNumber: '',
    pricePerDay: '',
    amenities: ''
  });

  const fetchBeds = useCallback(async () => {
    try {
      const params = {};
      if (filter.wardType) params.wardType = filter.wardType;
      if (filter.status) params.status = filter.status;

      const response = await api.get('/beds', { params });
      setBeds(response.data.beds || []);
    } catch (error) {
      console.error('Error fetching beds:', error);
      setError('Failed to load beds');
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/beds/stats/summary');
      setStats(response.data.stats || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchBeds();
    fetchStats();
  }, [fetchBeds, fetchStats]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const data = {
        ...formData,
        amenities: formData.amenities ? formData.amenities.split(',').map(a => a.trim()) : []
      };

      if (editingBed) {
        await api.put(`/beds/${editingBed._id}`, data);
      } else {
        await api.post('/beds', data);
      }

      setShowForm(false);
      setEditingBed(null);
      setFormData({
        bedNumber: '',
        wardType: 'general_ward',
        floor: '',
        roomNumber: '',
        pricePerDay: '',
        amenities: ''
      });
      fetchBeds();
      fetchStats();
    } catch (error) {
      console.error('Error saving bed:', error);
      setError(error.response?.data?.message || 'Failed to save bed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (bed) => {
    setEditingBed(bed);
    setFormData({
      bedNumber: bed.bedNumber,
      wardType: bed.wardType,
      floor: bed.floor || '',
      roomNumber: bed.roomNumber || '',
      pricePerDay: bed.pricePerDay || '',
      amenities: bed.amenities ? bed.amenities.join(', ') : ''
    });
    setShowForm(true);
  };

  const handleDelete = async (bedId) => {
    if (!window.confirm('Are you sure you want to delete this bed?')) {
      return;
    }

    try {
      await api.delete(`/beds/${bedId}`);
      fetchBeds();
      fetchStats();
    } catch (error) {
      console.error('Error deleting bed:', error);
      setError(error.response?.data?.message || 'Failed to delete bed');
    }
  };

  const wardTypeLabels = {
    emergency: 'Emergency',
    icu: 'ICU',
    general_ward: 'General Ward',
    private_ward: 'Private Ward'
  };

  const statusLabels = {
    available: 'Available',
    occupied: 'Occupied',
    maintenance: 'Maintenance',
    reserved: 'Reserved'
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
        .bed-management-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .bed-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
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
        .btn-secondary:hover {
          background: #4b5563;
        }
        .btn-danger {
          background: #ef4444;
          color: white;
        }
        .btn-danger:hover {
          background: #dc2626;
        }
        .form-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .form-select {
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

      <div className="bed-management-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/hospital-admin/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bed Management</h1>
              <p className="text-gray-600 text-sm">Manage hospital beds across all wards</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingBed(null);
              setFormData({
                bedNumber: '',
                wardType: 'general_ward',
                floor: '',
                roomNumber: '',
                pricePerDay: '',
                amenities: ''
              });
              setShowForm(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Bed
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {stats.map(stat => (
            <div key={stat._id} className="stat-card">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                {wardTypeLabels[stat._id] || stat._id}
              </h3>
              <div className="text-2xl font-bold text-gray-900">{stat.total}</div>
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-green-600">{stat.available} available</span> • 
                <span className="text-red-600"> {stat.occupied} occupied</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bed-card">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ward Type</label>
              <select
                value={filter.wardType}
                onChange={(e) => setFilter({ ...filter, wardType: e.target.value })}
                className="form-select"
              >
                <option value="">All Wards</option>
                <option value="emergency">Emergency</option>
                <option value="icu">ICU</option>
                <option value="general_ward">General Ward</option>
                <option value="private_ward">Private Ward</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="form-select"
              >
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingBed ? 'Edit Bed' : 'Add New Bed'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bed Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.bedNumber}
                      onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                      className="form-input"
                      placeholder="e.g., B-101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ward Type *</label>
                    <select
                      required
                      value={formData.wardType}
                      onChange={(e) => setFormData({ ...formData, wardType: e.target.value })}
                      className="form-select"
                    >
                      <option value="emergency">Emergency</option>
                      <option value="icu">ICU</option>
                      <option value="general_ward">General Ward</option>
                      <option value="private_ward">Private Ward</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                    <input
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      className="form-input"
                      placeholder="e.g., 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                    <input
                      type="text"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      className="form-input"
                      placeholder="e.g., 101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Day (₹)</label>
                    <input
                      type="number"
                      value={formData.pricePerDay}
                      onChange={(e) => setFormData({ ...formData, pricePerDay: e.target.value })}
                      className="form-input"
                      placeholder="e.g., 1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amenities (comma separated)</label>
                    <input
                      type="text"
                      value={formData.amenities}
                      onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                      className="form-input"
                      placeholder="e.g., TV, AC, Oxygen"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingBed(null);
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
                    {submitting ? 'Saving...' : (editingBed ? 'Update Bed' : 'Add Bed')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Beds List */}
        <div className="bed-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Beds ({beds.length})</h2>
          {beds.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No beds found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Bed Number</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Ward Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Floor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Room</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Price/Day</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Current Patient</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {beds.map(bed => (
                    <tr key={bed._id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900 font-medium">{bed.bedNumber}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{wardTypeLabels[bed.wardType]}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[bed.status]}`}>
                          {statusLabels[bed.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{bed.floor || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{bed.roomNumber || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">₹{bed.pricePerDay || 0}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {bed.currentAdmission?.patientId?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(bed)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(bed._id)}
                            className="p-1 hover:bg-red-100 rounded"
                            title="Delete"
                            disabled={bed.status === 'occupied'}
                          >
                            <Trash2 className={`h-4 w-4 ${bed.status === 'occupied' ? 'text-gray-300' : 'text-red-600'}`} />
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
    </div>
  );
};

export default BedManagement;
