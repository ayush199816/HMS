import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileText,
  Download,
  Plus,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  Activity,
  Image,
  Stethoscope,
  Heart,
  Brain,
  Radio
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST, formatTimeIST } from '../utils/dateUtils';

const ConsultationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { api, user } = useAuth();
  
  // Get appointment and patient data from navigation state
  const { appointment, patient } = location.state || {};
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('prescriptions');
  const [prescriptions, setPrescriptions] = useState([]);
  const [pathologyReports, setPathologyReports] = useState([]);
  const [xrayReports, setXrayReports] = useState([]);
  const [surgeryHistory, setSurgeryHistory] = useState([]);
  const [ctScans, setCtScans] = useState([]);
  const [ultrasoundReports, setUltrasoundReports] = useState([]);
  const [mriScans, setMriScans] = useState([]);
  const [ecgReports, setEcgReports] = useState([]);
  
  // Form states
  const [prescriptionForm, setPrescriptionForm] = useState({
    type: 'form', // 'form' or 'image'
    prescriptionFile: null,
    medicines: [
      {
        name: '',
        dosage: '',
        frequency: 'daily',
        customFrequency: '',
        instructions: ''
      }
    ],
    generalInstructions: '',
    followUpDate: ''
  });
  
  const [uploadForm, setUploadForm] = useState({
    reportType: '',
    file: null,
    description: '',
    reportDate: ''
  });

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

  const fetchMedicalRecords = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all medical records for the patient
      const [
        prescriptionsRes,
        pathologyRes,
        xrayRes,
        surgeryRes,
        ctRes,
        ultrasoundRes,
        mriRes,
        ecgRes
      ] = await Promise.all([
        api.get(`/medical-records/patient/${patient._id}/prescriptions`),
        api.get(`/medical-records/patient/${patient._id}/pathology`),
        api.get(`/medical-records/patient/${patient._id}/xray`),
        api.get(`/medical-records/patient/${patient._id}/surgery`),
        api.get(`/medical-records/patient/${patient._id}/ct`),
        api.get(`/medical-records/patient/${patient._id}/ultrasound`),
        api.get(`/medical-records/patient/${patient._id}/mri`),
        api.get(`/medical-records/patient/${patient._id}/ecg`)
      ]);

      // Handle API response structure - extract the actual data array
      setPrescriptions(Array.isArray(prescriptionsRes.data?.prescriptions) ? prescriptionsRes.data.prescriptions : []);
      setPathologyReports(Array.isArray(pathologyRes.data?.medicalRecords) ? pathologyRes.data.medicalRecords : []);
      setXrayReports(Array.isArray(xrayRes.data?.medicalRecords) ? xrayRes.data.medicalRecords : []);
      setSurgeryHistory(Array.isArray(surgeryRes.data?.medicalRecords) ? surgeryRes.data.medicalRecords : []);
      setCtScans(Array.isArray(ctRes.data?.medicalRecords) ? ctRes.data.medicalRecords : []);
      setUltrasoundReports(Array.isArray(ultrasoundRes.data?.medicalRecords) ? ultrasoundRes.data.medicalRecords : []);
      setMriScans(Array.isArray(mriRes.data?.medicalRecords) ? mriRes.data.medicalRecords : []);
      setEcgReports(Array.isArray(ecgRes.data?.medicalRecords) ? ecgRes.data.medicalRecords : []);
      
    } catch (error) {
      console.error('Error fetching medical records:', error);
      setError('Failed to fetch medical records');
      // Set empty arrays on error to prevent .map errors
      setPrescriptions([]);
      setPathologyReports([]);
      setXrayReports([]);
      setSurgeryHistory([]);
      setCtScans([]);
      setUltrasoundReports([]);
      setMriScans([]);
      setEcgReports([]);
    } finally {
      setLoading(false);
    }
  }, [api, patient?._id]);

  // Fetch patient medical records
  useEffect(() => {
    if (patient?._id) {
      fetchMedicalRecords();
    }
  }, [patient?._id, fetchMedicalRecords]);

  // Handle medicine list management
  const addMedicine = () => {
    setPrescriptionForm({
      ...prescriptionForm,
      medicines: [
        ...prescriptionForm.medicines,
        {
          name: '',
          dosage: '',
          frequency: 'daily',
          customFrequency: '',
          instructions: ''
        }
      ]
    });
  };

  const removeMedicine = (index) => {
    const newMedicines = prescriptionForm.medicines.filter((_, i) => i !== index);
    setPrescriptionForm({
      ...prescriptionForm,
      medicines: newMedicines
    });
  };

  const updateMedicine = (index, field, value) => {
    const newMedicines = [...prescriptionForm.medicines];
    newMedicines[index][field] = value;
    setPrescriptionForm({
      ...prescriptionForm,
      medicines: newMedicines
    });
  };

  // Handle prescription submission
  const handlePrescriptionSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      
      if (prescriptionForm.type === 'image' && prescriptionForm.prescriptionFile) {
        // Image-based prescription
        formData.append('file', prescriptionForm.prescriptionFile);
        formData.append('type', 'image');
        formData.append('patientId', patient._id);
        formData.append('doctorId', user.id);
        formData.append('appointmentId', appointment._id);
        formData.append('generalInstructions', prescriptionForm.generalInstructions);
        formData.append('followUpDate', prescriptionForm.followUpDate);
        
        await api.post('/medical-records/prescriptions', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // Form-based prescription
        await api.post('/medical-records/prescriptions', {
          type: 'form',
          patientId: patient._id,
          doctorId: user.id,
          appointmentId: appointment._id,
          medicines: prescriptionForm.medicines,
          generalInstructions: prescriptionForm.generalInstructions,
          followUpDate: prescriptionForm.followUpDate
        });
      }
      
      // Reset form and refresh prescriptions
      setPrescriptionForm({
        type: 'form',
        prescriptionFile: null,
        medicines: [
          {
            name: '',
            dosage: '',
            frequency: 'daily',
            duration: '',
            instructions: ''
          }
        ],
        generalInstructions: '',
        followUpDate: ''
      });
      fetchMedicalRecords();
      
    } catch (error) {
      console.error('Error saving prescription:', error);
      setError('Failed to save prescription');
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('patientId', patient._id);
      formData.append('doctorId', user.id);
      formData.append('appointmentId', appointment._id);
      formData.append('reportType', uploadForm.reportType);
      formData.append('description', uploadForm.description);
      formData.append('reportDate', uploadForm.reportDate);

      await api.post('/medical-records/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Reset form and refresh records
      setUploadForm({
        reportType: '',
        file: null,
        description: '',
        reportDate: ''
      });
      fetchMedicalRecords();
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    }
  };

  // Handle appointment completion
  const handleCompleteAppointment = async () => {
    try {
      await api.patch(`/appointments/${appointment._id}/status`, { 
        status: 'completed' 
      });
      navigate('/doctor/dashboard');
    } catch (error) {
      console.error('Error completing appointment:', error);
      setError('Failed to complete appointment');
    }
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'prescriptions':
        return (
          <div className="space-y-6">
            {/* New Prescription Form */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">New Prescription</h3>
              </div>
              <div className="card-body">
                <form onSubmit={handlePrescriptionSubmit} className="space-y-6">
                  {/* Prescription Type Selection */}
                  <div>
                    <label className="form-label">Prescription Type</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="form"
                          checked={prescriptionForm.type === 'form'}
                          onChange={(e) => setPrescriptionForm({...prescriptionForm, type: e.target.value})}
                          className="mr-2"
                        />
                        <span>Detailed Form</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="image"
                          checked={prescriptionForm.type === 'image'}
                          onChange={(e) => setPrescriptionForm({...prescriptionForm, type: e.target.value})}
                          className="mr-2"
                        />
                        <span>Upload Prescription Image</span>
                      </label>
                    </div>
                  </div>

                  {prescriptionForm.type === 'image' ? (
                    /* Image-based Prescription */
                    <div className="space-y-4">
                      <div>
                        <label className="form-label">Upload Prescription Image</label>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={(e) => setPrescriptionForm({...prescriptionForm, prescriptionFile: e.target.files[0]})}
                          className="form-input"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">General Instructions</label>
                        <textarea
                          value={prescriptionForm.generalInstructions}
                          onChange={(e) => setPrescriptionForm({...prescriptionForm, generalInstructions: e.target.value})}
                          className="form-input"
                          rows="3"
                          placeholder="Additional instructions for the patient"
                        />
                      </div>
                      <div>
                        <label className="form-label">Follow-up Date</label>
                        <input
                          type="date"
                          value={prescriptionForm.followUpDate}
                          onChange={(e) => setPrescriptionForm({...prescriptionForm, followUpDate: e.target.value})}
                          className="form-input"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Form-based Prescription */
                    <div className="space-y-4">
                      {/* Medicines List */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="form-label">Medicines</label>
                          <button
                            type="button"
                            onClick={addMedicine}
                            className="btn btn-secondary btn-sm"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Medicine
                          </button>
                        </div>
                        
                        {prescriptionForm.medicines.map((medicine, index) => (
                          <div key={index} className="border rounded-lg p-4 mb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="form-label text-sm">Medicine Name</label>
                                <input
                                  type="text"
                                  value={medicine.name}
                                  onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                                  className="form-input"
                                  placeholder="e.g., Paracetamol"
                                  required
                                />
                              </div>
                              <div>
                                <label className="form-label text-sm">Dosage</label>
                                <input
                                  type="text"
                                  value={medicine.dosage}
                                  onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                                  className="form-input"
                                  placeholder="e.g., 500mg, 1 tablet"
                                  required
                                />
                              </div>
                              <div>
                                <label className="form-label text-sm">Frequency</label>
                                <select
                                  value={medicine.frequency}
                                  onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                                  className="form-input"
                                >
                                  <option value="daily">Daily</option>
                                  <option value="alternately">Alternatively</option>
                                  <option value="weekly">Weekly</option>
                                  <option value="in 10 days">In 10 Days</option>
                                  <option value="in 15 days">In 15 Days</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="quarterly">Quarterly</option>
                                  <option value="yearly">Yearly</option>
                                  <option value="custom">Custom (Enter below)</option>
                                </select>
                              </div>
                              {medicine.frequency === 'custom' && (
                                <div>
                                  <label className="form-label text-sm">Custom Frequency</label>
                                  <input
                                    type="text"
                                    value={medicine.customFrequency}
                                    onChange={(e) => updateMedicine(index, 'customFrequency', e.target.value)}
                                    className="form-input"
                                    placeholder="e.g., Every 2 hours, 3 times a week, As needed for pain"
                                  />
                                </div>
                              )}
                              <div className="md:col-span-2">
                                <label className="form-label text-sm">Instructions</label>
                                <input
                                  type="text"
                                  value={medicine.instructions}
                                  onChange={(e) => updateMedicine(index, 'instructions', e.target.value)}
                                  className="form-input"
                                  placeholder="e.g., After meals, Before food, With water"
                                />
                              </div>
                            </div>
                            {prescriptionForm.medicines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeMedicine(index)}
                                className="btn btn-danger btn-sm mt-2"
                              >
                                Remove Medicine
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="form-label">General Instructions</label>
                        <textarea
                          value={prescriptionForm.generalInstructions}
                          onChange={(e) => setPrescriptionForm({...prescriptionForm, generalInstructions: e.target.value})}
                          className="form-input"
                          rows="3"
                          placeholder="Additional instructions for the patient"
                        />
                      </div>
                      <div>
                        <label className="form-label">Follow-up Date</label>
                        <input
                          type="date"
                          value={prescriptionForm.followUpDate}
                          onChange={(e) => setPrescriptionForm({...prescriptionForm, followUpDate: e.target.value})}
                          className="form-input"
                        />
                      </div>
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary">
                    <FileText className="h-4 w-4 mr-2" />
                    {prescriptionForm.type === 'image' ? 'Upload Prescription' : 'Add Prescription'}
                  </button>
                </form>
              </div>
            </div>

            {/* Previous Prescriptions */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Previous Prescriptions</h3>
              </div>
              <div className="card-body">
                {prescriptions.length === 0 ? (
                  <p className="text-gray-500">No previous prescriptions found</p>
                ) : (
                  <div className="space-y-4">
                    {prescriptions.map((prescription) => (
                      <div key={prescription._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">
                              {formatDateIST(prescription.createdAt)}
                            </span>
                            <span className={`badge badge-${prescription.type === 'image' ? 'info' : 'primary'}`}>
                              {prescription.type === 'image' ? 'Image' : 'Form'}
                            </span>
                          </div>
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleDownload('prescription', prescription._id, `prescription_${prescription._id}`)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                        
                        {prescription.type === 'image' ? (
                          <div>
                            <p className="font-medium">Prescription Image</p>
                            <p className="text-sm text-gray-600">
                              {prescription.generalInstructions || 'No additional instructions'}
                            </p>
                            {prescription.imageUrl && (
                              <div className="mt-2">
                                <img 
                                  src={prescription.imageUrl} 
                                  alt="Prescription" 
                                  className="max-w-xs h-auto border rounded"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">Medicines:</p>
                            <div className="mt-2 space-y-2">
                              {prescription.medicines?.map((medicine, index) => (
                                <div key={index} className="text-sm border-l-2 border-blue-200 pl-3">
                                  <p className="font-medium">{medicine.name} - {medicine.dosage}</p>
                                  <p className="text-gray-600">
                                    Frequency: {medicine.frequency === 'custom' ? medicine.customFrequency : medicine.frequency || 'Not specified'}
                                  </p>
                                  {medicine.instructions && (
                                    <p className="text-gray-600">Instructions: {medicine.instructions}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                            {prescription.generalInstructions && (
                              <p className="text-sm text-gray-600 mt-2">
                                <strong>General Instructions:</strong> {prescription.generalInstructions}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {prescription.followUpDate && (
                          <p className="text-sm text-gray-500 mt-2">
                            <strong>Follow-up:</strong> {formatDateIST(prescription.followUpDate)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'pathology':
        return (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Pathology Reports</h3>
              </div>
              <div className="card-body">
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <label className="form-label">Upload Pathology Report</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setUploadForm({...uploadForm, file: e.target.files[0]})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                      className="form-input"
                      placeholder="e.g., Blood Test, Urine Test"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Report Date</label>
                    <input
                      type="date"
                      value={uploadForm.reportDate}
                      onChange={(e) => setUploadForm({...uploadForm, reportDate: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <input type="hidden" value="pathology" />
                  <button type="submit" className="btn btn-primary">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Report
                  </button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Previous Pathology Reports</h3>
              </div>
              <div className="card-body">
                {pathologyReports.length === 0 ? (
                  <p className="text-gray-500">No pathology reports found</p>
                ) : (
                  <div className="space-y-4">
                    {pathologyReports.map((report) => (
                      <div key={report._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{report.description}</p>
                            <p className="text-sm text-gray-500">{formatDateIST(report.reportDate)}</p>
                          </div>
                          <button className="btn btn-sm btn-secondary">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'imaging':
        return (
          <div className="space-y-6">
            {/* X-ray Reports */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center space-x-2">
                  <Image className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">X-ray Reports</h3>
                </div>
              </div>
              <div className="card-body">
                {xrayReports.length === 0 ? (
                  <p className="text-gray-500">No X-ray reports found</p>
                ) : (
                  <div className="space-y-4">
                    {xrayReports.map((report) => (
                      <div key={report._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{report.description}</p>
                            <p className="text-sm text-gray-500">{formatDateIST(report.reportDate)}</p>
                          </div>
                          <button className="btn btn-sm btn-secondary">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CT Scans */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold">CT Scans</h3>
                </div>
              </div>
              <div className="card-body">
                {ctScans.length === 0 ? (
                  <p className="text-gray-500">No CT scans found</p>
                ) : (
                  <div className="space-y-4">
                    {ctScans.map((report) => (
                      <div key={report._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{report.description}</p>
                            <p className="text-sm text-gray-500">{formatDateIST(report.reportDate)}</p>
                          </div>
                          <button className="btn btn-sm btn-secondary">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ultrasound */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center space-x-2">
                  <Radio className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">Ultrasound Reports</h3>
                </div>
              </div>
              <div className="card-body">
                {ultrasoundReports.length === 0 ? (
                  <p className="text-gray-500">No ultrasound reports found</p>
                ) : (
                  <div className="space-y-4">
                    {ultrasoundReports.map((report) => (
                      <div key={report._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{report.description}</p>
                            <p className="text-sm text-gray-500">{formatDateIST(report.reportDate)}</p>
                          </div>
                          <button className="btn btn-sm btn-secondary">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* MRI Scans */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-red-600" />
                  <h3 className="text-lg font-semibold">MRI Scans</h3>
                </div>
              </div>
              <div className="card-body">
                {mriScans.length === 0 ? (
                  <p className="text-gray-500">No MRI scans found</p>
                ) : (
                  <div className="space-y-4">
                    {mriScans.map((report) => (
                      <div key={report._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{report.description}</p>
                            <p className="text-sm text-gray-500">{formatDateIST(report.reportDate)}</p>
                          </div>
                          <button className="btn btn-sm btn-secondary">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ECG Reports */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center space-x-2">
                  <Heart className="h-5 w-5 text-pink-600" />
                  <h3 className="text-lg font-semibold">ECG Reports</h3>
                </div>
              </div>
              <div className="card-body">
                {ecgReports.length === 0 ? (
                  <p className="text-gray-500">No ECG reports found</p>
                ) : (
                  <div className="space-y-4">
                    {ecgReports.map((report) => (
                      <div key={report._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{report.description}</p>
                            <p className="text-sm text-gray-500">{formatDateIST(report.reportDate)}</p>
                          </div>
                          <button className="btn btn-sm btn-secondary">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'surgery':
        return (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Surgery History</h3>
              </div>
              <div className="card-body">
                {surgeryHistory.length === 0 ? (
                  <p className="text-gray-500">No surgery history found</p>
                ) : (
                  <div className="space-y-4">
                    {surgeryHistory.map((surgery) => (
                      <div key={surgery._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{surgery.procedureName}</p>
                            <p className="text-sm text-gray-500">
                              {formatDateIST(surgery.surgeryDate)} - Dr. {surgery.surgeonName}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{surgery.description}</p>
                          </div>
                          <button className="btn btn-sm btn-secondary">
                            <Download className="h-3 w-3 mr-1" />
                            Download Report
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/doctor/dashboard')}
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Consultation</h1>
            <p className="text-gray-600">Dr. {user?.name} - {user?.specialities?.join(', ') || 'General Practitioner'}</p>
          </div>
        </div>
        <button
          onClick={handleCompleteAppointment}
          className="btn btn-success"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete Appointment
        </button>
      </div>

      {/* Patient Information */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Patient Information</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">{patient?.name || 'N/A'}</p>
                <p className="text-sm text-gray-500">{patient?.opdNumber || 'No OPD ID'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">{patient?.phone || 'N/A'}</p>
                <p className="text-sm text-gray-500">{patient?.email || 'No email'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">Age: {patient?.age || 'N/A'}</p>
                <p className="text-sm text-gray-500">Gender: {patient?.gender || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Information */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Current Appointment</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">
                  {formatDateIST(appointment?.appointmentDate) || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">
                  {formatTimeIST(appointment?.appointmentDate) || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Stethoscope className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium capitalize">{appointment?.appointmentType || 'N/A'}</p>
                <p className="text-sm text-gray-500 capitalize">{appointment?.status || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">Queue #{appointment?.queueNumber || 'N/A'}</p>
                <p className="text-sm text-gray-500">Symptoms: {appointment?.symptoms || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="card-header">
          <div className="flex space-x-4 border-b">
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'prescriptions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4 mr-2 inline" />
              Prescriptions
            </button>
            <button
              onClick={() => setActiveTab('pathology')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'pathology'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Activity className="h-4 w-4 mr-2 inline" />
              Pathology
            </button>
            <button
              onClick={() => setActiveTab('imaging')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'imaging'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Image className="h-4 w-4 mr-2 inline" />
              Imaging
            </button>
            <button
              onClick={() => setActiveTab('surgery')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'surgery'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertCircle className="h-4 w-4 mr-2 inline" />
              Surgery History
            </button>
          </div>
        </div>
        <div className="card-body">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ConsultationPage;
