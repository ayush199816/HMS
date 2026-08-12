import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, AlertCircle, Users } from 'lucide-react';

const AdmissionForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { api, user } = useAuth();
  
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    patientId: searchParams.get('patientId') || '',
    doctorIds: [],
    assistantDoctorIds: [],
    admissionReason: '',
    prescription: '',
    prescriptionFile: null,
    bedType: 'general_ward',
    bedNumber: '',
    assignedNurses: [],
    hasInsurance: false,
    insuranceProvider: '',
    insuranceNumber: '',
    hasGovtScheme: false,
    schemeName: '',
    schemeNumber: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [patientsRes, doctorsRes, nursesRes, bedsRes] = await Promise.all([
        api.get(`/patients/hospital/${user.hospitalId}`),
        api.get(`/staff/hospital/${user.hospitalId}?role=doctor`),
        api.get(`/staff/hospital/${user.hospitalId}?role=nurse`),
        api.get('/beds')
      ]);

      setPatients(patientsRes.data.patients || []);
      setDoctors(doctorsRes.data.staff || []);
      setNurses(nursesRes.data.staff || []);
      setBeds(bedsRes.data.beds || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load required data');
    } finally {
      setLoading(false);
    }
  }, [api, user.hospitalId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-fetch insurance / govt scheme details when patient is selected
  useEffect(() => {
    if (!formData.patientId || !patients.length) return;
    const patient = patients.find(p => p._id === formData.patientId);
    if (patient) {
      const govtNumber = patient.govtSchemeNumber || patient.ayushmanNumber || '';
      setFormData(prev => ({
        ...prev,
        hasInsurance: !!patient.insuranceNumber,
        insuranceProvider: patient.insuranceProvider || '',
        insuranceNumber: patient.insuranceNumber || '',
        hasGovtScheme: !!govtNumber,
        schemeName: patient.govtSchemeNumber ? 'Government Scheme' : (patient.ayushmanNumber ? 'Ayushman Bharat' : ''),
        schemeNumber: govtNumber
      }));
    }
  }, [formData.patientId, patients]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Validation
    if (!formData.patientId) {
      setError('Please select a patient');
      setSubmitting(false);
      return;
    }

    if (!formData.doctorIds || formData.doctorIds.length === 0) {
      setError('At least one doctor must be selected');
      setSubmitting(false);
      return;
    }

    if (!formData.admissionReason) {
      setError('Please provide admission reason');
      setSubmitting(false);
      return;
    }

    if (!formData.bedType) {
      setError('Please select ward type');
      setSubmitting(false);
      return;
    }

    if (!formData.bedNumber) {
      setError('Please select a bed');
      setSubmitting(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('patientId', formData.patientId);
      
      // Ensure arrays contain only string IDs to avoid circular reference errors
      const cleanDoctorIds = formData.doctorIds.filter(id => typeof id === 'string');
      const cleanAssistantDoctorIds = formData.assistantDoctorIds.filter(id => typeof id === 'string');
      const cleanAssignedNurses = formData.assignedNurses.filter(id => typeof id === 'string');
      
      formDataToSend.append('doctorIds', JSON.stringify(cleanDoctorIds));
      formDataToSend.append('assistantDoctorIds', JSON.stringify(cleanAssistantDoctorIds));
      formDataToSend.append('admissionReason', formData.admissionReason);
      formDataToSend.append('prescription', formData.prescription);
      formDataToSend.append('bedType', formData.bedType);
      formDataToSend.append('bedNumber', formData.bedNumber);
      
      if (cleanAssignedNurses.length > 0) {
        formDataToSend.append('assignedNurses', JSON.stringify(cleanAssignedNurses));
      }

      if (formData.prescriptionFile) {
        formDataToSend.append('prescriptionFile', formData.prescriptionFile);
      }

      formDataToSend.append('hasInsurance', formData.hasInsurance);
      if (formData.hasInsurance) {
        formDataToSend.append('insuranceProvider', formData.insuranceProvider);
        formDataToSend.append('insuranceNumber', formData.insuranceNumber);
      }

      formDataToSend.append('hasGovtScheme', formData.hasGovtScheme);
      if (formData.hasGovtScheme) {
        formDataToSend.append('schemeName', formData.schemeName);
        formDataToSend.append('schemeNumber', formData.schemeNumber);
      }

      await api.post('/admissions', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Admission created successfully!');
      navigate('/receptionist/dashboard');
    } catch (error) {
      console.error('Error creating admission:', error);
      setError(error.response?.data?.message || 'Failed to create admission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssistantDoctorToggle = (doctorId) => {
    setFormData(prev => ({
      ...prev,
      assistantDoctorIds: prev.assistantDoctorIds.includes(doctorId)
        ? prev.assistantDoctorIds.filter(id => id !== doctorId)
        : [...prev.assistantDoctorIds, doctorId]
    }));
  };

  const handleNurseToggle = (nurseId) => {
    setFormData(prev => ({
      ...prev,
      assignedNurses: prev.assignedNurses.includes(nurseId)
        ? prev.assignedNurses.filter(id => id !== nurseId)
        : [...prev.assignedNurses, nurseId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Admission</h1>
          <p className="text-gray-600 text-sm">Admit patient to hospital ward</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-danger flex items-center mb-4">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {/* Admission Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <div className="card">
          <div className="card-header p-4">
            <h2 className="card-title text-sm">Patient Information</h2>
          </div>
          <div className="card-body p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Patient *
              </label>
              <select
                required
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                className="form-input w-full"
              >
                <option value="">Select a patient</option>
                {patients.map(patient => (
                  <option key={patient._id} value={patient._id}>
                    {patient.name} - {patient.opdNumber || patient.phone}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Admission Details */}
        <div className="card">
          <div className="card-header p-4">
            <h2 className="card-title text-sm">Admission Details</h2>
          </div>
          <div className="card-body p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admission Reason *
              </label>
              <textarea
                required
                rows="3"
                value={formData.admissionReason}
                onChange={(e) => setFormData({ ...formData, admissionReason: e.target.value })}
                className="form-input w-full"
                placeholder="Enter reason for admission..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attending Doctors *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doctors.map(doctor => (
                  <label
                    key={doctor._id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.doctorIds.includes(doctor._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.doctorIds.includes(doctor._id)}
                      onChange={() => {
                        setError('');
                        setFormData(prev => ({
                          ...prev,
                          doctorIds: prev.doctorIds.includes(doctor._id)
                            ? prev.doctorIds.filter(id => id !== doctor._id)
                            : [...prev.doctorIds, doctor._id]
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
              {formData.doctorIds.length === 0 && (
                <p className="text-sm text-red-600 mt-2">At least one doctor must be selected</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assistant Doctors (Optional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doctors.map(doctor => (
                  <label
                    key={doctor._id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.assistantDoctorIds.includes(doctor._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.assistantDoctorIds.includes(doctor._id)}
                      onChange={handleAssistantDoctorToggle}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prescription
              </label>
              <textarea
                rows="3"
                value={formData.prescription}
                onChange={(e) => setFormData({ ...formData, prescription: e.target.value })}
                className="form-input w-full"
                placeholder="Enter prescription details..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Prescription File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFormData({ ...formData, prescriptionFile: e.target.files[0] })}
                  className="w-full"
                />
                {formData.prescriptionFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {formData.prescriptionFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Insurance Information */}
        <div className="card">
          <div className="card-header p-4">
            <h2 className="card-title text-sm">Insurance Information</h2>
          </div>
          <div className="card-body p-4 space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="hasInsurance"
                checked={formData.hasInsurance}
                onChange={(e) => setFormData({ ...formData, hasInsurance: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hasInsurance" className="text-sm font-medium text-gray-700">
                Patient has Insurance
              </label>
            </div>

            {formData.hasInsurance && (
              <div className="space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Provider *
                  </label>
                  <input
                    type="text"
                    required={formData.hasInsurance}
                    value={formData.insuranceProvider}
                    onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                    className="form-input w-full"
                    placeholder="e.g., HDFC Ergo, ICICI Lombard, Star Health"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Number *
                  </label>
                  <input
                    type="text"
                    required={formData.hasInsurance}
                    value={formData.insuranceNumber}
                    onChange={(e) => setFormData({ ...formData, insuranceNumber: e.target.value })}
                    className="form-input w-full"
                    placeholder="Enter insurance policy number"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Government Scheme Information */}
        <div className="card">
          <div className="card-header p-4">
            <h2 className="card-title text-sm">Government Health Scheme</h2>
          </div>
          <div className="card-body p-4 space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="hasGovtScheme"
                checked={formData.hasGovtScheme}
                onChange={(e) => setFormData({ ...formData, hasGovtScheme: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hasGovtScheme" className="text-sm font-medium text-gray-700">
                Patient registered under Government Health Scheme
              </label>
            </div>

            {formData.hasGovtScheme && (
              <div className="space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheme Name *
                  </label>
                  <input
                    type="text"
                    required={formData.hasGovtScheme}
                    value={formData.schemeName}
                    onChange={(e) => setFormData({ ...formData, schemeName: e.target.value })}
                    className="form-input w-full"
                    placeholder="e.g., Ayushman Bharat, PMJAY, ESI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheme Number *
                  </label>
                  <input
                    type="text"
                    required={formData.hasGovtScheme}
                    value={formData.schemeNumber}
                    onChange={(e) => setFormData({ ...formData, schemeNumber: e.target.value })}
                    className="form-input w-full"
                    placeholder="Enter scheme/beneficiary ID"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bed Allotment */}
        <div className="card">
          <div className="card-header p-4">
            <h2 className="card-title text-sm">Bed Allotment</h2>
          </div>
          <div className="card-body p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ward Type *
              </label>
              <select
                required
                value={formData.bedType}
                onChange={(e) => {
                  setFormData({ ...formData, bedType: e.target.value, bedNumber: '' });
                }}
                className="form-input w-full"
              >
                <option value="icu">ICU</option>
                <option value="private_ward">Private Ward</option>
                <option value="general_ward">General Ward</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bed *
              </label>
              <select
                required
                value={formData.bedNumber}
                onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                className="form-input w-full"
              >
                <option value="">Select a bed</option>
                {beds
                  .filter(bed => bed.wardType === formData.bedType && bed.status === 'available')
                  .map(bed => (
                    <option key={bed._id} value={bed.bedNumber}>
                      {bed.bedNumber} - Floor {bed.floor || 'N/A'} - Room {bed.roomNumber || 'N/A'} - ₹{bed.pricePerDay || 0}/day
                    </option>
                  ))}
              </select>
              {beds.filter(bed => bed.wardType === formData.bedType && bed.status === 'available').length === 0 && (
                <p className="text-sm text-red-600 mt-1">No available beds in this ward type</p>
              )}
            </div>

            {/* Bed Status Summary */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Bed Status - {formData.bedType.replace('_', ' ').toUpperCase()}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Available: {beds.filter(bed => bed.wardType === formData.bedType && bed.status === 'available').length}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Occupied: {beds.filter(bed => bed.wardType === formData.bedType && bed.status === 'occupied').length}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Maintenance: {beds.filter(bed => bed.wardType === formData.bedType && bed.status === 'maintenance').length}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Reserved: {beds.filter(bed => bed.wardType === formData.bedType && bed.status === 'reserved').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nurse Assignment */}
        <div className="card">
          <div className="card-header p-4">
            <h2 className="card-title text-sm">Nurse Assignment</h2>
          </div>
          <div className="card-body p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nurses.length === 0 ? (
                <p className="text-gray-500 text-sm col-span-2">No nurses available</p>
              ) : (
                nurses.map(nurse => (
                  <label
                    key={nurse._id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.assignedNurses.includes(nurse._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.assignedNurses.includes(nurse._id)}
                      onChange={() => handleNurseToggle(nurse._id)}
                      className="mr-3"
                    />
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{nurse.name}</p>
                        <p className="text-xs text-gray-500">Nurse</p>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Admit Patient'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdmissionForm;
