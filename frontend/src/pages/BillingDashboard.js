import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST } from '../utils/dateUtils';
import {
  Calendar,
  Bed,
  ArrowLeft,
  Calculator,
  CheckCircle,
  Plus,
  Download,
  Activity,
  FlaskConical,
  X,
  Shield,
  DollarSign
} from 'lucide-react';

const BillingDashboard = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [appointmentBills, setAppointmentBills] = useState([]);
  const [radiologyBookings, setRadiologyBookings] = useState([]);
  const [radiologyBills, setRadiologyBills] = useState([]);
  const [pathologyBookings, setPathologyBookings] = useState([]);
  const [pathologyBills, setPathologyBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [billCalculation, setBillCalculation] = useState(null);
  const [dischargeDate, setDischargeDate] = useState('');
  const [customItems, setCustomItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, price: 0 });
  const [discount, setDiscount] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [insuranceModal, setInsuranceModal] = useState({ show: false, bill: null, type: '' });
  const [insuranceForm, setInsuranceForm] = useState({
    insuranceProvider: '',
    policyNumber: '',
    approvedAmount: 0,
    claimNumber: '',
    paymentMethod: 'online',
    referenceNumber: '',
    notes: ''
  });

  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/billing/billing-data');
      setAppointments(response.data.appointments || []);
      setAdmissions(response.data.admissions || []);
      setAppointmentBills(response.data.appointmentBills || []);
      setRadiologyBookings(response.data.radiologyBookings || []);
      setRadiologyBills(response.data.radiologyBills || []);
      setPathologyBookings(response.data.pathologyBookings || []);
      setPathologyBills(response.data.pathologyBills || []);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const calculateAdmissionBill = async (admissionId) => {
    try {
      // Initialize discharge date to today if not set
      if (!dischargeDate) {
        const today = new Date();
        const istDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const todayStr = istDate.toISOString().split('T')[0];
        setDischargeDate(todayStr);
      }

      // Convert date string to ISO format if provided
      let dischargeDateToSend = dischargeDate;
      if (dischargeDate && !dischargeDate.includes('T')) {
        // Date input returns YYYY-MM-DD, convert to full ISO string
        dischargeDateToSend = new Date(dischargeDate).toISOString();
      }

      const response = await api.post('/billing/calculate-admission-bill', {
        admissionId,
        dischargeDate: dischargeDateToSend || new Date().toISOString()
      });
      setBillCalculation(response.data);
      setSelectedAdmission(admissionId);
      setCustomItems([]);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to calculate bill');
    }
  };

  const addCustomItem = () => {
    if (newItem.name && newItem.price > 0) {
      setCustomItems([...customItems, { ...newItem, id: Date.now() }]);
      setNewItem({ name: '', quantity: 1, price: 0 });
    }
  };

  const calculateTotal = () => {
    const baseAmount = billCalculation?.totalAmount || 0;
    const customItemsTotal = customItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return baseAmount + customItemsTotal - discount;
  };

  const getPaymentInfo = (bill) => {
    if (!bill) return { mode: 'N/A', ref: 'N/A' };
    if (bill.paymentDetails?.paymentMethod) {
      return {
        mode: bill.paymentDetails.paymentMethod.toUpperCase(),
        ref: bill.paymentDetails.utrNumber || 'N/A'
      };
    }
    const source = bill.paymentSources?.find(s => s.sourceType === 'patient' || s.sourceType === 'other') || bill.paymentSources?.[0];
    if (source) {
      return {
        mode: (source.paymentMethod || 'cash').toUpperCase(),
        ref: source.referenceNumber || 'N/A'
      };
    }
    return { mode: 'N/A', ref: 'N/A' };
  };

  const downloadBillByType = async (bill) => {
    try {
      const endpoints = {
        appointment: `/appointments/${bill.referenceId}/bill-pdf`,
        consultation: `/appointments/${bill.referenceId}/bill-pdf`,
        emergency: `/appointments/${bill.referenceId}/bill-pdf`,
        opd: `/appointments/${bill.referenceId}/bill-pdf`,
        surgery: `/appointments/${bill.referenceId}/bill-pdf`,
        radiology: `/radiology-bookings/${bill.referenceId}/bill-pdf`,
        pathology: `/pathology-bookings/${bill.referenceId}/bill-pdf`,
        admission: `/billing/${bill._id}/pdf`
      };
      const endpoint = endpoints[bill.type] || `/billing/${bill._id}/pdf`;
      const filename = `${bill.type || 'bill'}-${bill._id}.pdf`;

      const response = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download bill PDF error:', error);
      alert(`Failed to download bill: ${error.response?.data?.message || error.message}`);
    }
  };

  const createBill = async (type, referenceId, amount, description) => {
    try {
      const totalAmount = calculateTotal();
      const items = [
        ...(billCalculation ? [{
          name: 'Bed Charges',
          quantity: billCalculation.daysAdmitted,
          price: billCalculation.bedDetails.pricePerDay,
          total: billCalculation.bedDetails.total
        }] : []),
        ...(billCalculation && billCalculation.doctorFees > 0 ? [{
          name: 'Doctor Visit Fees',
          quantity: billCalculation.daysAdmitted,
          price: billCalculation.doctorFees / billCalculation.daysAdmitted,
          total: billCalculation.doctorFees
        }] : []),
        ...customItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        }))
      ];

      const response = await api.post('/billing', {
        type,
        referenceId,
        amount: totalAmount + discount,
        description,
        patientId: type === 'admission' ? selectedAdmission?.patientId?._id : null,
        items,
        discount,
        advanceAmount
      });

      const billId = response.data.bill._id;
      setBillCalculation(null);
      setSelectedAdmission(null);
      setDischargeDate('');
      setCustomItems([]);
      setDiscount(0);
      setAdvanceAmount(0);

      // Open bill details in new tab
      window.open(`/billing/bill/${billId}`, '_blank');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create bill');
    }
  };

  const handleApplyInsurance = async () => {
    try {
      await api.post(`/billing/${insuranceModal.bill._id}/apply-insurance`, {
        insuranceProvider: insuranceForm.insuranceProvider,
        policyNumber: insuranceForm.policyNumber
      });
      setInsuranceModal({ show: false, bill: null, type: '' });
      fetchBillingData();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to apply for insurance');
    }
  };

  const handleApproveInsurance = async () => {
    try {
      await api.post(`/billing/${insuranceModal.bill._id}/approve-insurance`, {
        approvedAmount: insuranceForm.approvedAmount,
        claimNumber: insuranceForm.claimNumber
      });
      setInsuranceModal({ show: false, bill: null, type: '' });
      fetchBillingData();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to approve insurance');
    }
  };

  const handleInsurancePayment = async () => {
    try {
      await api.post(`/billing/${insuranceModal.bill._id}/insurance-payment`, {
        paymentMethod: insuranceForm.paymentMethod,
        referenceNumber: insuranceForm.referenceNumber,
        notes: insuranceForm.notes
      });
      setInsuranceModal({ show: false, bill: null, type: '' });
      fetchBillingData();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to record insurance payment');
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Billing Dashboard</h1>
            </div>
            <div className="text-sm text-gray-500">
              Hospital: {user?.hospitalId?.name || 'Loading...'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'appointments'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Appointments
          </button>
          <button
            onClick={() => setActiveTab('radiology')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'radiology'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Activity className="h-4 w-4 inline mr-2" />
            Radiology
          </button>
          <button
            onClick={() => setActiveTab('pathology')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'pathology'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FlaskConical className="h-4 w-4 inline mr-2" />
            Pathology
          </button>
          <button
            onClick={() => setActiveTab('admissions')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'admissions'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Bed className="h-4 w-4 inline mr-2" />
            Admissions
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">OPD & Emergency Appointments</h2>
              {appointments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No appointments found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Patient</th>
                        <th className="text-left py-3 px-4">Type</th>
                        <th className="text-left py-3 px-4">Doctor</th>
                        <th className="text-left py-3 px-4">Date</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Bill Details</th>
                        <th className="text-left py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((appointment) => {
                        const bill = appointmentBills.find(b => b._id === appointment.billId?._id);
                        return (
                          <tr key={appointment._id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium">{appointment.patientId?.name}</p>
                                <p className="text-sm text-gray-500">
                                  {appointment.patientId?.opdNumber || appointment.patientId?.emergencyNumber}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-4 capitalize">{appointment.appointmentType}</td>
                            <td className="py-3 px-4">
                              <p>Dr. {appointment.doctorId?.name}</p>
                              {appointment.assistantDoctorIds?.length > 0 && (
                                <p className="text-sm text-gray-500">
                                  +{appointment.assistantDoctorIds.length} assistant(s)
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {formatDateIST(appointment.appointmentDate)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${
                                appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                appointment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {appointment.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {bill ? (
                                (() => {
                                  const { mode, ref } = getPaymentInfo(bill);
                                  return (
                                    <div className="text-sm">
                                      <p className="font-medium text-green-600">₹{appointment.paymentStatus === 'paid' ? (bill.totalPaid || bill.totalAmount) : bill.totalPaid}</p>
                                      <p className="text-gray-500">Mode: {mode}</p>
                                      <p className="text-gray-500">UTR: {ref}</p>
                                      <p className="text-gray-500">By: {bill.createdBy?.name || 'N/A'}</p>
                                    </div>
                                  );
                                })()
                              ) : (
                                <span className="text-gray-400">No bill</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {bill ? (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => downloadBillByType(bill)}
                                    className="btn btn-success"
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </button>
                                  {bill.status === 'pending' && (
                                    <button
                                      onClick={() => {
                                        setInsuranceModal({ show: true, bill, type: 'apply' });
                                        setInsuranceForm({ ...insuranceForm, insuranceProvider: '', policyNumber: '' });
                                      }}
                                      className="btn btn-primary"
                                    >
                                      <Shield className="h-4 w-4 mr-1" />
                                      Apply Insurance
                                    </button>
                                  )}
                                  {bill.status === 'insurance_applied' && (
                                    <button
                                      onClick={() => {
                                        setInsuranceModal({ show: true, bill, type: 'approve' });
                                        setInsuranceForm({ ...insuranceForm, approvedAmount: bill.totalAmount, claimNumber: '' });
                                      }}
                                      className="btn btn-secondary"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Approve
                                    </button>
                                  )}
                                  {bill.status === 'insurance_approved' && (
                                    <button
                                      onClick={() => {
                                        setInsuranceModal({ show: true, bill, type: 'payment' });
                                        setInsuranceForm({ ...insuranceForm, paymentMethod: 'online', referenceNumber: '', notes: '' });
                                      }}
                                      className="btn btn-danger"
                                    >
                                      <DollarSign className="h-4 w-4 mr-1" />
                                      Mark Payment
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => createBill(
                                    'appointment',
                                    appointment._id,
                                    appointment.consultationFee,
                                    `Consultation - ${appointment.appointmentType}`
                                  )}
                                  className="btn btn-primary"
                                >
                                  Create Bill
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Radiology Tab */}
        {activeTab === 'radiology' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Radiology Bookings</h2>
              {radiologyBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No radiology bookings found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Patient</th>
                        <th className="text-left py-3 px-4">Booking ID</th>
                        <th className="text-left py-3 px-4">Tests</th>
                        <th className="text-left py-3 px-4">Date</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Bill Details</th>
                        <th className="text-left py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {radiologyBookings.map((booking) => {
                        const bill = radiologyBills.find(b => b._id === booking.billId?._id);
                        return (
                          <tr key={booking._id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium">{booking.patientId?.name}</p>
                                <p className="text-sm text-gray-500">
                                  {booking.patientId?.opdNumber || booking.patientId?.emergencyNumber}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono">{booking.bookingId}</td>
                            <td className="py-3 px-4">
                              {booking.tests.map((test, idx) => (
                                <span key={idx} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-1 mb-1">
                                  {test.testName}
                                </span>
                              ))}
                            </td>
                            <td className="py-3 px-4">
                              {formatDateIST(booking.bookingDate)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${
                                booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                                booking.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {bill ? (
                                (() => {
                                  const { mode, ref } = getPaymentInfo(bill);
                                  return (
                                    <div className="text-sm">
                                      <p className="font-medium text-green-600">₹{booking.paymentStatus === 'paid' ? (bill.totalPaid || bill.totalAmount) : bill.totalPaid}</p>
                                      <p className="text-gray-500">Mode: {mode}</p>
                                      <p className="text-gray-500">UTR: {ref}</p>
                                      <p className="text-gray-500">By: {bill.createdBy?.name || 'N/A'}</p>
                                    </div>
                                  );
                                })()
                              ) : (
                                <span className="text-gray-400">No bill</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {bill ? (
                                <button
                                  onClick={() => downloadBillByType(bill)}
                                  className="btn btn-success"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </button>
                              ) : (
                                <span className="text-gray-400">Pending</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pathology Tab */}
        {activeTab === 'pathology' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Pathology Bookings</h2>
              {pathologyBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pathology bookings found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Patient</th>
                        <th className="text-left py-3 px-4">Tests</th>
                        <th className="text-left py-3 px-4">Date</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Bill Details</th>
                        <th className="text-left py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pathologyBookings.map((booking) => {
                        const bill = pathologyBills.find(b => b._id === booking.billId?._id);
                        return (
                          <tr key={booking._id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium">{booking.patientId?.name}</p>
                                <p className="text-sm text-gray-500">
                                  {booking.patientId?.opdNumber || booking.patientId?.emergencyNumber}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {booking.tests.map((test, idx) => (
                                <span key={idx} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-1 mb-1">
                                  {test.testName}
                                </span>
                              ))}
                            </td>
                            <td className="py-3 px-4">
                              {formatDateIST(booking.bookingDate)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${
                                booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                                booking.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {bill ? (
                                (() => {
                                  const { mode, ref } = getPaymentInfo(bill);
                                  return (
                                    <div className="text-sm">
                                      <p className="font-medium text-green-600">₹{booking.paymentStatus === 'paid' ? (bill.totalPaid || bill.totalAmount) : bill.totalPaid}</p>
                                      <p className="text-gray-500">Mode: {mode}</p>
                                      <p className="text-gray-500">UTR: {ref}</p>
                                      <p className="text-gray-500">By: {bill.createdBy?.name || 'N/A'}</p>
                                    </div>
                                  );
                                })()
                              ) : (
                                <span className="text-gray-400">No bill</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {bill ? (
                                <button
                                  onClick={() => downloadBillByType(bill)}
                                  className="btn btn-success"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </button>
                              ) : (
                                <span className="text-gray-400">Pending</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admissions Tab */}
        {activeTab === 'admissions' && (
          <div className="space-y-6">
            {/* Admissions List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Active Admissions</h2>
                {admissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No active admissions found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Patient</th>
                          <th className="text-left py-3 px-4">Admission ID</th>
                          <th className="text-left py-3 px-4">Bed</th>
                          <th className="text-left py-3 px-4">Doctors</th>
                          <th className="text-left py-3 px-4">Admitted On</th>
                          <th className="text-left py-3 px-4">Last Bill Status</th>
                          <th className="text-left py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissions.map((admission) => (
                          <tr key={admission._id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium">{admission.patientId?.name}</p>
                                <p className="text-sm text-gray-500">
                                  {admission.patientId?.opdNumber || admission.patientId?.emergencyNumber}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono">{admission.admissionId}</td>
                            <td className="py-3 px-4">
                              <p>{admission.bedId?.bedNumber}</p>
                              <p className="text-sm text-gray-500 capitalize">{admission.bedId?.wardType?.replace('_', ' ')}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p>Dr. {admission.doctorIds?.[0]?.name}</p>
                              {admission.assistantDoctorIds?.length > 0 && (
                                <p className="text-sm text-gray-500">
                                  +{admission.assistantDoctorIds.length} assistant(s)
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {formatDateIST(admission.admissionDate)}
                            </td>
                            <td className="py-3 px-4">
                              {admission.billIds && admission.billIds.length > 0 ? (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  admission.billIds[admission.billIds.length - 1]?.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  admission.billIds[admission.billIds.length - 1]?.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {admission.billIds[admission.billIds.length - 1]?.status?.toUpperCase() || 'PENDING'}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">No bills</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => navigate(`/billing/admission/${admission._id}`)}
                                className="btn btn-primary"
                              >
                                <Calculator className="h-4 w-4 inline mr-1" />
                                Manage Bills
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Bill Calculation */}
            {billCalculation && (
              <div className="bg-white rounded-lg shadow-lg">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Bill Calculation</h2>
                      <p className="text-sm text-gray-500 mt-1">Admission ID: {billCalculation.admissionId}</p>
                    </div>
                    <button
                      onClick={() => {
                        setBillCalculation(null);
                        setSelectedAdmission(null);
                        setDischargeDate('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Bill Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">Admission Bill</h2>
                        <p className="text-blue-100 mt-1">Bill for {billCalculation.patientName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">₹{calculateTotal()}</p>
                        <p className="text-blue-100 text-sm">Total Amount</p>
                      </div>
                    </div>
                  </div>

                  {/* Bill Body */}
                  <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6 space-y-6">
                    {/* Discharge Date */}
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Date</label>
                        <input
                          type="date"
                          value={dischargeDate ? dischargeDate.split('T')[0] : ''}
                          onChange={(e) => {
                            setDischargeDate(e.target.value);
                            if (selectedAdmission) {
                              calculateAdmissionBill(selectedAdmission);
                            }
                          }}
                          className="form-input"
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Days Admitted</p>
                        <p className="text-2xl font-bold text-blue-600">{billCalculation.daysAdmitted}</p>
                      </div>
                    </div>

                    {/* Patient & Admission Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-600 uppercase font-semibold mb-2">Patient Details</p>
                        <p className="font-medium text-gray-900">{billCalculation.patientName}</p>
                        <p className="text-sm text-gray-600">ID: {billCalculation.admissionId}</p>
                        <p className="text-sm text-gray-600">Admitted: {formatDateIST(billCalculation.admissionDate)}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 uppercase font-semibold mb-2">Bed Details</p>
                        <p className="font-medium text-gray-900">{billCalculation.bedDetails.bedNumber} ({billCalculation.bedDetails.wardType?.replace('_', ' ')})</p>
                        <p className="text-sm text-gray-600">₹{billCalculation.bedDetails.pricePerDay}/day</p>
                        <p className="text-sm text-gray-600">Total: ₹{billCalculation.bedDetails.total}</p>
                      </div>
                    </div>

                    {/* Bill Items Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Item</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Days/Qty</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">Bed Charges</p>
                              <p className="text-sm text-gray-500">{billCalculation.bedDetails.bedNumber} - {billCalculation.bedDetails.wardType?.replace('_', ' ')}</p>
                            </td>
                            <td className="px-4 py-3 text-center">{billCalculation.daysAdmitted}</td>
                            <td className="px-4 py-3 text-right">₹{billCalculation.bedDetails.pricePerDay}</td>
                            <td className="px-4 py-3 text-right font-medium">₹{billCalculation.bedDetails.total}</td>
                          </tr>
                          {billCalculation.doctorDetails && billCalculation.doctorDetails.map((doctor, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{doctor.name}</p>
                                <p className="text-sm text-gray-500">{doctor.role}</p>
                              </td>
                              <td className="px-4 py-3 text-center">{billCalculation.daysAdmitted}</td>
                              <td className="px-4 py-3 text-right">₹{doctor.dailyFee}</td>
                              <td className="px-4 py-3 text-right font-medium">₹{doctor.totalFee}</td>
                            </tr>
                          ))}
                          {customItems.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{item.name}</p>
                                <p className="text-sm text-gray-500">Additional Item</p>
                              </td>
                              <td className="px-4 py-3 text-center">{item.quantity}</td>
                              <td className="px-4 py-3 text-right">₹{item.price}</td>
                              <td className="px-4 py-3 text-right font-medium">₹{item.price * item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Add Custom Item */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-3">Add Additional Item</p>
                      <div className="grid grid-cols-4 gap-3">
                        <input
                          type="text"
                          placeholder="Item name"
                          value={newItem.name}
                          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                          className="form-input"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                          className="form-input"
                          min="1"
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={newItem.price}
                          onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                          className="form-input"
                          min="0"
                          step="0.01"
                        />
                        <button
                          onClick={addCustomItem}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Insurance/Govt Scheme */}
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                      <p className="text-sm font-medium text-purple-900 mb-2">Insurance / Government Scheme</p>
                      {billCalculation.insuranceInfo?.hasInsurance ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-purple-700">TPA Insurance - {billCalculation.insuranceInfo.insuranceProvider}</p>
                            <p className="text-xs text-purple-600">Policy: {billCalculation.insuranceInfo.insuranceNumber}</p>
                          </div>
                          <button
                            onClick={() => {
                              setInsuranceModal({ show: true, bill: null, type: 'apply' });
                              setInsuranceForm({ ...insuranceForm, insuranceProvider: billCalculation.insuranceInfo.insuranceProvider, policyNumber: billCalculation.insuranceInfo.insuranceNumber });
                            }}
                            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                          >
                            Apply for Insurance
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No insurance information on file</p>
                      )}
                      {billCalculation.govtSchemeInfo?.hasGovtScheme && (
                        <div className="mt-2 pt-2 border-t border-purple-200">
                          <p className="text-sm text-green-700">Govt Scheme: {billCalculation.govtSchemeInfo.schemeName} ({billCalculation.govtSchemeInfo.schemeNumber})</p>
                        </div>
                      )}
                    </div>

                    {/* Discount & Advance Payment */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <label className="block text-sm font-medium text-green-900 mb-2">Discount (₹)</label>
                        <input
                          type="number"
                          value={discount}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          className="form-input w-full"
                          min="0"
                          step="0.01"
                          placeholder="Enter discount amount"
                        />
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <label className="block text-sm font-medium text-blue-900 mb-2">Advance Payment (₹)</label>
                        <input
                          type="number"
                          value={advanceAmount}
                          onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                          className="form-input w-full"
                          min="0"
                          step="0.01"
                          placeholder="Enter advance amount"
                        />
                      </div>
                    </div>

                    {/* Total & Create Button */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-sm text-gray-500">Subtotal: ₹{(calculateTotal() + discount).toFixed(2)}</p>
                        {discount > 0 && <p className="text-sm text-green-600">Discount: -₹{discount.toFixed(2)}</p>}
                        {advanceAmount > 0 && <p className="text-sm text-blue-600">Advance: ₹{advanceAmount.toFixed(2)}</p>}
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="text-2xl font-bold text-gray-900">₹{calculateTotal().toFixed(2)}</p>
                        {advanceAmount > 0 && (
                          <p className="text-sm text-gray-600">Balance Due: ₹{(calculateTotal() - advanceAmount).toFixed(2)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => createBill(
                          'admission',
                          selectedAdmission,
                          calculateTotal(),
                          `Admission Bill - ${billCalculation.admissionId}`
                        )}
                        className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 flex items-center"
                      >
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Create Bill
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insurance Modal */}
      {insuranceModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {insuranceModal.type === 'apply' && 'Apply for TPA Insurance'}
                  {insuranceModal.type === 'approve' && 'Approve Insurance Claim'}
                  {insuranceModal.type === 'payment' && 'Record Insurance Payment'}
                </h3>
                <button
                  onClick={() => setInsuranceModal({ show: false, bill: null, type: '' })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {insuranceModal.type === 'apply' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Insurance Provider</label>
                    <input
                      type="text"
                      value={insuranceForm.insuranceProvider}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceProvider: e.target.value })}
                      className="form-input"
                      placeholder="e.g., Star Health, HDFC Ergo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Policy Number</label>
                    <input
                      type="text"
                      value={insuranceForm.policyNumber}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, policyNumber: e.target.value })}
                      className="form-input"
                      placeholder="Enter policy number"
                    />
                  </div>
                </>
              )}
              {insuranceModal.type === 'approve' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bill Amount</label>
                    <p className="text-2xl font-bold text-gray-900">₹{insuranceModal.bill?.totalAmount}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Approved Amount</label>
                    <input
                      type="number"
                      value={insuranceForm.approvedAmount}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, approvedAmount: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                      min="0"
                      max={insuranceModal.bill?.totalAmount}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Claim Number</label>
                    <input
                      type="text"
                      value={insuranceForm.claimNumber}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, claimNumber: e.target.value })}
                      className="form-input"
                      placeholder="Enter claim number"
                    />
                  </div>
                </>
              )}
              {insuranceModal.type === 'payment' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Insurance Amount</label>
                    <p className="text-2xl font-bold text-green-600">₹{insuranceModal.bill?.insuranceDetails?.approvedAmount}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Patient Balance</label>
                    <p className="text-lg font-medium text-orange-600">₹{insuranceModal.bill?.totalAmount - insuranceModal.bill?.insuranceDetails?.approvedAmount}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      value={insuranceForm.paymentMethod}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, paymentMethod: e.target.value })}
                      className="form-input"
                    >
                      <option value="online">Online Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number / UTR</label>
                    <input
                      type="text"
                      value={insuranceForm.referenceNumber}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, referenceNumber: e.target.value })}
                      className="form-input"
                      placeholder="Enter reference number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea
                      value={insuranceForm.notes}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, notes: e.target.value })}
                      className="form-input"
                      rows="2"
                      placeholder="Add any notes"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => setInsuranceModal({ show: false, bill: null, type: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              {insuranceModal.type === 'apply' && (
                <button
                  onClick={handleApplyInsurance}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Apply
                </button>
              )}
              {insuranceModal.type === 'approve' && (
                <button
                  onClick={handleApproveInsurance}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Approve
                </button>
              )}
              {insuranceModal.type === 'payment' && (
                <button
                  onClick={handleInsurancePayment}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Record Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingDashboard;
