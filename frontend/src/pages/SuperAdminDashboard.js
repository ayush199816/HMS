import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  MapPin, 
  Phone, 
  AlertCircle
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const { api } = useAuth();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHospital, setEditingHospital] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    registrationNumber: '',
    emergencyNumber: '',
    logo: '',
    description: '',
    facilities: []
  });
  const [adminCredentials, setAdminCredentials] = useState(null);
  const [showCredentials, setShowCredentials] = useState(false);

  const fetchHospitals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/hospitals');
      setHospitals(response.data.hospitals);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch hospitals');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFacilitiesChange = (e) => {
    const facilities = e.target.value.split(',').map(f => f.trim()).filter(f => f);
    setFormData(prev => ({
      ...prev,
      facilities
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingHospital) {
        const response = await api.put(`/hospitals/${editingHospital._id}`, formData);
        setHospitals(prev => prev.map(h => 
          h._id === editingHospital._id ? response.data.hospital : h
        ));
        setShowCreateForm(false);
        setEditingHospital(null);
      } else {
        const response = await api.post('/hospitals', formData);
        console.log('Hospital creation response:', response.data);
        setHospitals(prev => [response.data.hospital, ...prev]);
        
        // Store admin credentials if provided
        if (response.data.adminCredentials) {
          console.log('Admin credentials received:', response.data.adminCredentials);
          setAdminCredentials(response.data.adminCredentials);
          setShowCredentials(true);
        } else {
          console.log('No admin credentials in response');
        }
        
        setShowCreateForm(false);
        setEditingHospital(null);
      }
      
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        registrationNumber: '',
        emergencyNumber: '',
        logo: '',
        description: '',
        facilities: []
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save hospital');
    }
  };

  const handleEdit = (hospital) => {
    setEditingHospital(hospital);
    setFormData({
      name: hospital.name,
      email: hospital.email,
      phone: hospital.phone,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      pincode: hospital.pincode,
      registrationNumber: hospital.registrationNumber,
      emergencyNumber: hospital.emergencyNumber,
      logo: hospital.logo || '',
      description: hospital.description || '',
      facilities: hospital.facilities || []
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (hospitalId) => {
    if (!window.confirm('Are you sure you want to deactivate this hospital? This will also deactivate all associated staff.')) {
      return;
    }

    try {
      await api.delete(`/hospitals/${hospitalId}`);
      setHospitals(prev => prev.filter(h => h._id !== hospitalId));
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to deactivate hospital');
    }
  };

  const filteredHospitals = hospitals.filter(hospital =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showCreateForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {editingHospital ? 'Edit Hospital' : 'Create New Hospital'}
            </h2>
            <p className="card-description">
              {editingHospital ? 'Update hospital information' : 'Add a new hospital to the system'}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger flex items-center mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Hospital Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Emergency Number *</label>
                <input
                  type="tel"
                  name="emergencyNumber"
                  value={formData.emergencyNumber}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Registration Number *</label>
                <input
                  type="text"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Logo URL</label>
                <input
                  type="url"
                  name="logo"
                  value={formData.logo}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="form-label">City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">State *</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Pincode *</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                className="form-input"
                placeholder="Brief description about the hospital..."
              />
            </div>

            <div>
              <label className="form-label">Facilities</label>
              <input
                type="text"
                value={formData.facilities.join(', ')}
                onChange={handleFacilitiesChange}
                className="form-input"
                placeholder="Emergency, ICU, Pharmacy, Laboratory (comma separated)"
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingHospital(null);
                  setFormData({
                    name: '',
                    email: '',
                    phone: '',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                    registrationNumber: '',
                    emergencyNumber: '',
                    logo: '',
                    description: '',
                    facilities: []
                  });
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                {editingHospital ? 'Update Hospital' : 'Create Hospital'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hospital Management</h1>
            <p className="text-gray-600 mt-1">Manage all hospitals in the system</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Hospital
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center mb-6">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <h2 className="card-title">All Hospitals</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search hospitals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-64"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Hospital</th>
                  <th className="table-header-cell">Contact</th>
                  <th className="table-header-cell">Location</th>
                  <th className="table-header-cell">Registration</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {filteredHospitals.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="table-body-cell text-center py-8">
                      <div className="text-gray-500">
                        {searchTerm ? 'No hospitals found matching your search.' : 'No hospitals found.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHospitals.map((hospital) => (
                    <tr key={hospital._id}>
                      <td className="table-body-cell">
                        <div className="flex items-center">
                          {hospital.logo ? (
                            <img
                              src={hospital.logo}
                              alt={hospital.name}
                              className="h-10 w-10 rounded-full mr-3"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                              <Building className="h-5 w-5 text-primary-600" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{hospital.name}</div>
                            <div className="text-sm text-gray-500">{hospital.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-body-cell">
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="h-4 w-4 mr-1" />
                          {hospital.phone}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Phone className="h-4 w-4 mr-1" />
                          Emergency: {hospital.emergencyNumber}
                        </div>
                      </td>
                      <td className="table-body-cell">
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-1" />
                          {hospital.city}, {hospital.state}
                        </div>
                        <div className="text-sm text-gray-500">{hospital.pincode}</div>
                      </td>
                      <td className="table-body-cell">
                        <div className="text-sm text-gray-900">
                          {hospital.registrationNumber}
                        </div>
                      </td>
                      <td className="table-body-cell">
                        <span className={`badge ${hospital.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {hospital.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-body-cell">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(hospital)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(hospital._id)}
                            className="text-red-600 hover:text-red-900"
                            title="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Credentials Modal */}
      {showCredentials && adminCredentials && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Hospital Admin Credentials
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-4">
                        Hospital has been created successfully. Here are the admin credentials:
                      </p>
                      <div className="bg-gray-50 p-4 rounded-md">
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
                          <div className="bg-white p-2 border border-gray-300 rounded-md font-mono text-sm">
                            {adminCredentials.email}
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Password:</label>
                          <div className="bg-yellow-50 p-2 border border-yellow-300 rounded-md font-mono text-sm text-yellow-800">
                            {adminCredentials.password}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 italic">
                          {adminCredentials.note}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${adminCredentials.email}\nPassword: ${adminCredentials.password}`);
                    alert('Credentials copied to clipboard!');
                  }}
                >
                  Copy Credentials
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowCredentials(false);
                    setAdminCredentials(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
