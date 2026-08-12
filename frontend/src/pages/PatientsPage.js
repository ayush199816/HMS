import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, User, AlertCircle } from 'lucide-react';

const PatientsPage = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  
  // State
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientFormData, setPatientFormData] = useState({
    name: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    age: '',
    ageDisplay: '',
    gender: 'male',
    aadharNumber: '',
    address: '',
    patientType: 'opd',
    currentIssues: '',
    insuranceProvider: '',
    insuranceNumber: '',
    govtSchemeNumber: ''
  });

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/patients/hospital/${user.hospitalId}`);
      setPatients(response.data.patients || []);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  }, [api, user?.hospitalId]);

  useEffect(() => {
    if (user?.hospitalId) {
      fetchPatients();
    }
  }, [fetchPatients, user?.hospitalId]);

  // Filter patients
  const filteredPatients = patients.filter(patient =>
    patient.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone?.includes(searchTerm) ||
    patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.opdNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Form handlers
  const handlePatientInputChange = (e) => {
    const { name, value } = e.target;
    setPatientFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateAge = (dob) => {
    const birthDate = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - birthDate.getFullYear();
    let months = now.getMonth() - birthDate.getMonth();
    let days = now.getDate() - birthDate.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    return { years, months, days, text: `${years}y ${months}m ${days}d` };
  };

  const handleDateOfBirthChange = (e) => {
    const dateOfBirth = e.target.value;
    if (!dateOfBirth) {
      setPatientFormData(prev => ({ ...prev, dateOfBirth: '', age: '', ageDisplay: '' }));
      return;
    }
    const { years, text } = calculateAge(dateOfBirth);
    setPatientFormData(prev => ({ ...prev, dateOfBirth, age: years.toString(), ageDisplay: text }));
  };

  const handlePatientSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const dataToSend = { ...patientFormData };
    if (dataToSend.dateOfBirth) {
      dataToSend.age = calculateAge(dataToSend.dateOfBirth).years;
    }
    delete dataToSend.ageDisplay;

    try {
      console.log('Frontend: Creating patient with data:', {
        ...dataToSend,
        hospitalId: user.hospitalId,
        createdBy: user.id
      });
      
      const response = await api.post('/patients', {
        ...dataToSend,
        hospitalId: user.hospitalId,
        createdBy: user.id
      });
      
      console.log('Frontend: Patient created successfully:', response);

      setPatientFormData({
        name: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        age: '',
        ageDisplay: '',
        gender: 'male',
        aadharNumber: '',
        address: '',
        patientType: 'opd',
        currentIssues: '',
        insuranceProvider: '',
        insuranceNumber: '',
        govtSchemeNumber: ''
      });
      setShowPatientForm(false);
      fetchPatients();
    } catch (error) {
      console.error('Frontend: Patient creation error:', error);
      console.error('Frontend: Error response:', error.response?.data);
      setError(error.response?.data?.message || 'Failed to create patient');
    }
  };

  // Patient form component
  if (showPatientForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Register New Patient</h2>
            <p className="card-description">
              Add a new patient to the hospital system
            </p>
          </div>

          {error && (
            <div className="alert alert-danger flex items-center mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handlePatientSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={patientFormData.name}
                  onChange={handlePatientInputChange}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={patientFormData.phone}
                  onChange={handlePatientInputChange}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  value={patientFormData.email}
                  onChange={handlePatientInputChange}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Date of Birth *</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={patientFormData.dateOfBirth}
                  onChange={handleDateOfBirthChange}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Age</label>
                <input
                  type="text"
                  name="ageDisplay"
                  value={patientFormData.ageDisplay || ''}
                  className="form-input"
                  readOnly
                  placeholder="Calculated from date of birth"
                />
              </div>
              <div>
                <label className="form-label">Gender *</label>
                <select
                  name="gender"
                  value={patientFormData.gender}
                  onChange={handlePatientInputChange}
                  className="form-input"
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Patient Type *</label>
                <select
                  name="patientType"
                  value={patientFormData.patientType}
                  onChange={handlePatientInputChange}
                  className="form-input"
                  required
                >
                  <option value="opd">OPD</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Aadhar Number</label>
              <input
                type="text"
                name="aadharNumber"
                value={patientFormData.aadharNumber}
                onChange={handlePatientInputChange}
                className="form-input"
                placeholder="12-digit Aadhar number"
              />
            </div>
            <div>
              <label className="form-label">Address</label>
              <textarea
                name="address"
                value={patientFormData.address}
                onChange={handlePatientInputChange}
                className="form-input"
                rows="3"
              />
            </div>
            <div>
              <label className="form-label">Symptoms / Reason for Visit *</label>
              <textarea
                name="currentIssues"
                value={patientFormData.currentIssues}
                onChange={handlePatientInputChange}
                className="form-input"
                rows="3"
                required
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Insurance & Government Scheme</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Insurance Provider</label>
                  <input
                    type="text"
                    name="insuranceProvider"
                    value={patientFormData.insuranceProvider}
                    onChange={handlePatientInputChange}
                    className="form-input"
                    placeholder="e.g. HDFC Ergo"
                  />
                </div>
                <div>
                  <label className="form-label">Insurance Number</label>
                  <input
                    type="text"
                    name="insuranceNumber"
                    value={patientFormData.insuranceNumber}
                    onChange={handlePatientInputChange}
                    className="form-input"
                    placeholder="Insurance policy number"
                  />
                </div>
                <div>
                  <label className="form-label">Government Scheme Number</label>
                  <input
                    type="text"
                    name="govtSchemeNumber"
                    value={patientFormData.govtSchemeNumber}
                    onChange={handlePatientInputChange}
                    className="form-input"
                    placeholder="e.g. Ayushman card number"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowPatientForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Register Patient
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-600 mt-2">Manage patient records and information</p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => navigate('/receptionist/dashboard')}
            className="btn-secondary"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => setShowPatientForm(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Patient
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6">
          <div className="relative flex-1 max-w-md">
            <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patients by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full"
            />
          </div>
          <div className="mt-4 md:mt-0 text-sm text-gray-500">
            {filteredPatients.length} of {patients.length} patients
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

      {/* Patients Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="table-header-cell">Patient</th>
                <th className="table-header-cell">Type</th>
                <th className="table-header-cell">Contact</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-body-cell text-center py-8">
                    <div className="spinner mx-auto"></div>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-body-cell text-center py-8">
                    <div className="text-gray-500">
                      {searchTerm ? 'No patients found matching your search.' : 'No patients found.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient._id}>
                    <td className="table-body-cell">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <button
                            onClick={() => navigate(`/receptionist/patients/${patient._id}`)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {patient.name || 'N/A'}
                          </button>
                          <div className="text-sm text-gray-500">
                            {patient.opdNumber || patient.emergencyNumber || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <span className="badge badge-info">
                        {(patient.patientType || 'OPD').toUpperCase()}
                      </span>
                    </td>
                    <td className="table-body-cell">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{patient.phone || 'N/A'}</div>
                        <div className="text-gray-500">{patient.email || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <div className="text-sm">
                        <div className="flex items-center">
                          <span className={`badge badge-${(patient.balanceAmount > 0) ? 'warning' : 'success'}`}>
                            {(patient.balanceAmount > 0) ? 'PENDING' : 'PAID'}
                          </span>
                        </div>
                        <div className="text-gray-500 mt-1">
                          Balance: ₹{patient.balanceAmount || 0}
                        </div>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          View
                        </button>
                        <button
                          className="text-green-600 hover:text-green-900"
                          title="Billing"
                        >
                          Bill
                        </button>
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

export default PatientsPage;
