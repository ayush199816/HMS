import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST, toISTDateTimeLocal } from '../utils/dateUtils';
import axios from 'axios';
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  Download,
  X,
  User,
  Bed,
  Calendar
} from 'lucide-react';

const AdmissionBillingPage = () => {
  const { admissionId } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [admission, setAdmission] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBillForm, setShowBillForm] = useState(false);
  const [billType, setBillType] = useState('advance'); // 'advance' or 'full_final'
  const [billCalculation, setBillCalculation] = useState(null);
  const [dischargeDate, setDischargeDate] = useState('');
  const [customItems, setCustomItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, price: 0, hasTax: false });
  const [discount, setDiscount] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceFromBalance, setAdvanceFromBalance] = useState(0);
  const [assistantDoctors, setAssistantDoctors] = useState([]);
  const [selectedAssistantDoctors, setSelectedAssistantDoctors] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [claimFromInsurance, setClaimFromInsurance] = useState(false);
  const [claimAmount, setClaimAmount] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [billToPay, setBillToPay] = useState(null);
  const [admissionDateInput, setAdmissionDateInput] = useState('');

  const fetchAdmissionDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/admissions/${admissionId}`);
      setAdmission(response.data.admission);
      setAdmissionDateInput(
        response.data.admission.admissionDate
          ? toISTDateTimeLocal(response.data.admission.admissionDate).split('T')[0]
          : ''
      );
      setBills(response.data.admission.billIds || []);
      
      // Fetch doctors for assistant doctor selection
      const doctorsResponse = await api.get(`/staff/hospital/${response.data.admission.hospitalId}?role=doctor`);
      setAssistantDoctors(doctorsResponse.data.staff || []);
      
      // Pre-select assistant doctors from admission
      if (response.data.admission.assistantDoctorIds) {
        setSelectedAssistantDoctors(response.data.admission.assistantDoctorIds);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch admission details');
    } finally {
      setLoading(false);
    }
  }, [admissionId, api]);

  const updateAdmissionDate = async () => {
    try {
      setError('');
      const response = await api.put(`/admissions/${admissionId}`, {
        admissionDate: new Date(admissionDateInput).toISOString()
      });
      setAdmission(response.data.admission);
      setAdmissionDateInput(
        response.data.admission.admissionDate
          ? toISTDateTimeLocal(response.data.admission.admissionDate).split('T')[0]
          : ''
      );
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update admission date');
    }
  };

  useEffect(() => {
    fetchAdmissionDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId, api]);

  // Auto-add selected assistant doctors to bill items
  useEffect(() => {
    if (selectedAssistantDoctors.length > 0 && assistantDoctors.length > 0) {
      const assistantDoctorItems = selectedAssistantDoctors.map(docId => {
        const doctor = assistantDoctors.find(d => d._id === docId);
        return {
          id: `assistant-${docId}`,
          name: doctor?.name || 'Assistant Doctor',
          description: 'Assistant Doctor',
          quantity: billCalculation?.daysAdmitted || 1,
          price: doctor?.dailyVisitFee || 500,
          total: (doctor?.dailyVisitFee || 500) * (billCalculation?.daysAdmitted || 1),
          hasTax: false,
          type: 'assistant'
        };
      });
      
      // Filter out existing assistant doctor items and add new ones
      setBillItems(prev => {
        const existingNonAssistant = prev.filter(item => item.type !== 'assistant');
        return [...existingNonAssistant, ...assistantDoctorItems];
      });
    } else {
      // Remove assistant doctor items if none selected
      setBillItems(prev => prev.filter(item => item.type !== 'assistant'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssistantDoctors, assistantDoctors, billCalculation?.daysAdmitted]);

  // Pre-fill advance amount with total advance collected for full & final bills
  useEffect(() => {
    if (billType === 'full_final' && bills.length > 0) {
      const totalAdvanceCollected = bills.reduce((sum, b) => sum + (b.advanceAmount || 0), 0);
      setAdvanceAmount(totalAdvanceCollected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billType, bills]);

  const calculateAdmissionBill = async (dateValue = null) => {
    try {
      const dateToUse = dateValue || dischargeDate;
      if (!dateToUse) {
        const today = new Date();
        const istDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const todayStr = istDate.toISOString().split('T')[0];
        setDischargeDate(todayStr);
        return;
      }

      let dischargeDateToSend = dateToUse;
      if (dateToUse && !dateToUse.includes('T')) {
        dischargeDateToSend = new Date(dateToUse).toISOString();
      }

      const response = await api.post('/billing/calculate-admission-bill', {
        admissionId,
        dischargeDate: dischargeDateToSend
      });
      setBillCalculation(response.data);
      setCustomItems([]);
      
      // Initialize bill items with editable quantities
      if (response.data) {
        const initialBillItems = [];
        
        // Add bed charges (per bed history if available)
        if (response.data.breakdown?.bedBreakdown?.length > 0) {
          response.data.breakdown.bedBreakdown.forEach((entry, idx) => {
            initialBillItems.push({
              id: `bed-${idx}`,
              name: 'Bed Charges',
              description: `${entry.bedNumber} - ${entry.wardType?.replace('_', ' ')}`,
              quantity: entry.days,
              price: entry.pricePerDay,
              total: entry.total,
              hasTax: false,
              type: 'bed'
            });
          });
        } else if (response.data.bedDetails) {
          initialBillItems.push({
            id: 'bed',
            name: 'Bed Charges',
            description: `${response.data.bedDetails.bedNumber} - ${response.data.bedDetails.wardType?.replace('_', ' ')}`,
            quantity: response.data.daysAdmitted,
            price: response.data.bedDetails.pricePerDay,
            total: response.data.bedDetails.total,
            hasTax: false,
            type: 'bed'
          });
        }
        
        // Add primary doctors
        if (response.data.doctorDetails) {
          response.data.doctorDetails.forEach((doctor, idx) => {
            initialBillItems.push({
              id: `doctor-${idx}`,
              name: doctor.name,
              description: doctor.role,
              quantity: response.data.daysAdmitted,
              price: doctor.dailyFee,
              total: doctor.totalFee,
              hasTax: false,
              type: 'doctor'
            });
          });
        }
        
        setBillItems(initialBillItems);
      }
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

  const calculateSubtotal = () => {
    const billItemsTotal = billItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      return sum + (item.hasTax ? itemTotal * 1.05 : itemTotal);
    }, 0);
    
    const customItemsTotal = customItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      return sum + (item.hasTax ? itemTotal * 1.05 : itemTotal);
    }, 0);
    
    return billItemsTotal + customItemsTotal;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const total = subtotal - discount - advanceAmount;
    
    return total;
  };

  const deleteBill = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/billing/${billId}`);
      await fetchAdmissionDetails();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete bill');
    }
  };

  const handleDownloadAndPrintBill = async (bill) => {
    try {
      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      
      const response = await axios.get(`${baseURL}/billing/${bill._id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const patientName = (admission?.patientId?.name || bill?.patientId?.name || 'patient').replace(/\s+/g, '-');
      const billNumber = (bill.billNumber || bill._id).replace(/\s+/g, '-');
      const filename = `${patientName}-${billNumber}.pdf`;
      
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        alert('Popup was blocked. Bill downloaded instead.');
      }
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Error generating/printing PDF bill:', error);
      alert(`Failed to generate/print bill: ${error.response?.data?.message || error.message}`);
    }
  };

  const markBillAsPaid = async (billId) => {
    console.log('Mark as paid clicked for bill:', billId);
    const bill = bills.find(b => b._id === billId);
    console.log('Found bill:', bill);
    setBillToPay(bill);
    setPaymentMethod('cash');
    setReferenceNumber('');
    setShowPaymentModal(true);
    console.log('Modal should now be visible, showPaymentModal state set to true');
  };

  const processPayment = async () => {
    try {
      // Client-side validation: require reference number for non-cash methods
      if (paymentMethod && paymentMethod !== 'cash' && !referenceNumber) {
        alert('Please enter a reference number (UTR/transaction id) for non-cash payments');
        return;
      }

      const utrNumber = paymentMethod === 'cash' ? 'CASH_PAYMENT' : referenceNumber || 'N/A';

      const payload = {
        amount: billToPay.balanceAmount || 0,
        sourceType: 'patient',
        paymentMethod,
        referenceNumber: utrNumber
      };

      console.log('Processing payment for bill', billToPay?._id, payload);

      const response = await api.post(`/billing/${billToPay._id}/payment`, payload);

      console.log('Payment response:', response.data);

      await fetchAdmissionDetails();
      setShowPaymentModal(false);
      setPaymentMethod('cash');
      setReferenceNumber('');
      setBillToPay(null);
      alert('Bill marked as paid successfully');
    } catch (error) {
      console.error('Error marking bill as paid:', error);
      // Show detailed errors where possible
      const serverMessage = error.response?.data?.message || (error.response?.data?.errors ? error.response.data.errors.map(e => e.msg).join(', ') : null);
      alert(`Failed to mark bill as paid: ${serverMessage || error.message}`);
    }
  };

  const createBill = async () => {
    try {
      console.log('Creating bill with data:', {
        admissionId,
        billType,
        totalAmount: calculateTotal(),
        discount,
        advanceAmount,
        admission: admission?.admissionId,
        patientId: admission?.patientId?._id,
        assistantDoctors: selectedAssistantDoctors
      });

      const finalAmount = calculateTotal();
      
      // For advance bills, amount should be 0 (it's a collection, not a service bill)
      // The advance amount is stored separately in advanceAmount field
      // For full & final bills, amount should be the final amount (subtotal - advance)
      // This can be negative if advance exceeds subtotal (refund due)
      const billAmount = billType === 'advance' ? 0 : finalAmount;
      
      const items = billType === 'advance' ? [] : [
        ...billItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.hasTax ? (item.price * item.quantity) * 1.05 : (item.price * item.quantity),
          hasTax: item.hasTax
        })),
        ...customItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.hasTax ? (item.price * item.quantity) * 1.05 : (item.price * item.quantity),
          hasTax: item.hasTax
        }))
      ];

      const totalTax = items.reduce((sum, item) => {
        return sum + (item.hasTax ? (item.price * item.quantity) * 0.05 : 0);
      }, 0);

      if (billType === 'advance' && paymentMethod !== 'cash' && !referenceNumber) {
        alert('Please enter a reference number (UTR/Transaction ID) for non-cash advance payments');
        return;
      }

      const response = await api.post('/billing', {
        type: billType === 'advance' ? 'admission_advance' : 'admission',
        referenceId: admissionId,
        amount: billAmount,
        description: billType === 'advance' 
          ? `Advance Bill - ${admission?.admissionId}` 
          : `Full & Final Bill - ${admission?.admissionId}`,
        patientId: admission?.patientId?._id,
        items,
        discount,
        advanceAmount,
        advanceFromBalance,
        assistantDoctorIds: selectedAssistantDoctors,
        taxDetails: {
          totalTax
        },
        isAdvanceBill: billType === 'advance',
        previousBills: billType === 'full_final' ? bills : undefined,
        claimFromInsurance,
        claimAmount,
        ...(billType === 'advance' ? { paymentMethod, referenceNumber } : {})
      });

      console.log('Bill created successfully:', response.data);

      await fetchAdmissionDetails();
      setBillCalculation(null);
      setShowBillForm(false);
      setDischargeDate('');
      setCustomItems([]);
      setBillItems([]);
      setDiscount(0);
      setAdvanceAmount(0);
      setSelectedAssistantDoctors([]);
      setPaymentMethod('cash');
      setReferenceNumber('');
      setBillType('advance');
    } catch (error) {
      console.error('Error creating bill:', error);
      setError(error.response?.data?.message || 'Failed to create bill');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && !admission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEBUG: Show modal state */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', top: '10px', right: '10px', background: 'red', color: 'white', padding: '10px', zIndex: 9999 }}>
          DEBUG: showPaymentModal = true
        </div>
      )}
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
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admission Billing</h1>
                <p className="text-sm text-gray-500">Admission ID: {admission?.admissionId}</p>
              </div>
            </div>
            {!showBillForm && (
              <button
                onClick={() => {
                  const today = new Date();
                  const istDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                  const todayStr = istDate.toISOString().split('T')[0];
                  setDischargeDate(todayStr);
                  setShowBillForm(true);
                  calculateAdmissionBill(todayStr);
                  // Initialize advance from balance to full available amount
                  setAdvanceFromBalance(admission?.patientId?.advanceBalance || 0);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Bill
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Admission Details */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Admission Details</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Patient</p>
                  <p className="font-medium">{admission?.patientId?.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Bed className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Bed</p>
                  <p className="font-medium">
                    {admission?.bedId?.bedNumber || admission?.bedNumber}
                    {admission?.bedId?.wardType ? ` (${admission.bedId.wardType.replace('_', ' ')})` : admission?.bedType ? ` (${admission.bedType.replace('_', ' ')})` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div className="w-full">
                  <p className="text-sm text-gray-500">Admitted On</p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={admissionDateInput}
                      onChange={(e) => setAdmissionDateInput(e.target.value)}
                      className="form-input py-1 px-2 text-sm"
                    />
                    <button
                      onClick={updateAdmissionDate}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Previous Bills */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Previous Bills ({bills.length})</h2>
            {bills.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No bills created yet</p>
            ) : (
              <div className="space-y-3">
                {bills.map((bill) => (
                  <div key={bill._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{bill.billNumber}</p>
                      <p className="text-sm text-gray-500">{formatDateIST(bill.billDate)}</p>
                      <p className="text-sm text-gray-600">Amount: ₹{bill.totalAmount?.toFixed(2)}</p>
                      {bill.advanceAmount > 0 && (
                        <p className="text-sm text-blue-600">Advance: ₹{bill.advanceAmount.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                        bill.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        bill.status === 'refund_due' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {bill.status === 'refund_due' ? 'REFUND DUE' : bill.status?.toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleDownloadAndPrintBill(bill)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Print Bill
                      </button>
                      {['pending', 'partial'].includes(bill.status) && (
                        <button
                          onClick={() => markBillAsPaid(bill._id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {bill.status === 'partial' ? 'Pay Balance' : 'Mark as Paid'}
                        </button>
                      )}
                      {bill.status === 'pending' && (
                        <button
                          onClick={() => deleteBill(bill._id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bill Creation Form */}
        {showBillForm && billCalculation && (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Create New Bill</h2>
                  <p className="text-sm text-gray-500 mt-1">Admission ID: {billCalculation.admissionId}</p>
                </div>
                <button
                  onClick={() => {
                    setShowBillForm(false);
                    setBillCalculation(null);
                    setDischargeDate('');
                    setCustomItems([]);
                    setDiscount(0);
                    setAdvanceAmount(0);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Bill Type Selection */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                <label className="block text-sm font-medium text-blue-900 mb-3">Bill Type</label>
                <div className="flex space-x-4">
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    billType === 'advance' ? 'border-blue-500 bg-blue-100' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="billType"
                      value="advance"
                      checked={billType === 'advance'}
                      onChange={(e) => setBillType(e.target.value)}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Advance Bill</p>
                      <p className="text-xs text-gray-500">Collect partial payment during admission</p>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    billType === 'full_final' ? 'border-blue-500 bg-blue-100' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="billType"
                      value="full_final"
                      checked={billType === 'full_final'}
                      onChange={(e) => setBillType(e.target.value)}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Full & Final Bill</p>
                      <p className="text-xs text-gray-500">Complete bill with advance usage summary</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Discharge Date - Only for Full & Final */}
              {billType === 'full_final' && (
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Date</label>
                    {bills.length > 0 ? (
                      <input
                        type="date"
                        value={dischargeDate ? dischargeDate.split('T')[0] : ''}
                        disabled
                        className="form-input bg-gray-100 cursor-not-allowed"
                        title="Discharge date cannot be changed after bills are created"
                      />
                    ) : (
                      <input
                        type="date"
                        value={dischargeDate ? dischargeDate.split('T')[0] : ''}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setDischargeDate(newValue);
                          calculateAdmissionBill(newValue);
                        }}
                        className="form-input"
                      />
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Days Admitted</p>
                    <p className="text-2xl font-bold text-blue-600">{billCalculation.daysAdmitted}</p>
                  </div>
                </div>
              )}

              {/* Advance Bill Form */}
              {billType === 'advance' && (
                <div className="bg-green-50 p-6 rounded-lg border border-green-100 mb-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-4">Advance Payment Details</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Advance Amount (₹)</label>
                    <input
                      type="number"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                      className="form-input"
                      min="0"
                      step="100"
                      placeholder="Enter advance amount"
                    />
                  </div>
                  <div className="mt-4 p-3 bg-white rounded border border-green-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Total Advance to Collect:</span> ₹{advanceAmount}
                    </p>
                  </div>
                </div>
              )}

              {/* Bill Items Table - Only for Full & Final */}
              {billType === 'full_final' && (
                <>
                  <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Item</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Days/Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Tax 5%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {billItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">{item.description}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity = parseInt(e.target.value) || 1;
                                  setBillItems(prev => prev.map(i => 
                                    i.id === item.id ? { ...i, quantity: newQuantity, total: i.price * newQuantity } : i
                                  ));
                                }}
                                className="w-16 text-center border border-gray-300 rounded px-2 py-1"
                                min="1"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">₹{item.price}</td>
                            <td className="px-4 py-3 text-right font-medium">₹{item.hasTax ? (item.price * item.quantity * 1.05).toFixed(2) : (item.price * item.quantity).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.hasTax}
                                onChange={(e) => {
                                  setBillItems(prev => prev.map(i => 
                                    i.id === item.id ? { ...i, hasTax: e.target.checked } : i
                                  ));
                                }}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                            </td>
                          </tr>
                        ))}
                        {customItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">Additional Item</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity = parseInt(e.target.value) || 1;
                                  setCustomItems(prev => prev.map(i => 
                                    i.id === item.id ? { ...i, quantity: newQuantity } : i
                                  ));
                                }}
                                className="w-16 text-center border border-gray-300 rounded px-2 py-1"
                                min="1"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">₹{item.price}</td>
                            <td className="px-4 py-3 text-right font-medium">₹{item.hasTax ? (item.price * item.quantity * 1.05).toFixed(2) : (item.price * item.quantity).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.hasTax}
                                onChange={(e) => {
                                  const updatedItems = customItems.map(i => 
                                    i.id === item.id ? { ...i, hasTax: e.target.checked } : i
                                  );
                                  setCustomItems(updatedItems);
                                }}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Custom Item */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">Add Additional Item</p>
                    <div className="grid grid-cols-5 gap-3">
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
                      <label className="flex items-center justify-center bg-white border border-gray-200 rounded-lg px-3 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={newItem.hasTax}
                          onChange={(e) => setNewItem({ ...newItem, hasTax: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded mr-2"
                        />
                        <span className="text-sm text-gray-700">Tax 5%</span>
                      </label>
                      <button
                        onClick={addCustomItem}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Assistant Doctors Selection */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                    <p className="text-sm font-medium text-blue-900 mb-3">Assistant Doctors (Optional)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {assistantDoctors.map(doctor => (
                        <label
                          key={doctor._id}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedAssistantDoctors.includes(doctor._id)
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssistantDoctors.includes(doctor._id)}
                            onChange={() => {
                              setSelectedAssistantDoctors(prev =>
                                prev.includes(doctor._id)
                                  ? prev.filter(id => id !== doctor._id)
                                  : [...prev, doctor._id]
                              );
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
                  </div>

                  {/* Advance Usage Summary */}
                  {bills.length > 0 && (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 mb-6">
                      <h3 className="text-sm font-medium text-yellow-900 mb-3">Previous Advance Payments</h3>
                      <div className="space-y-2">
                        {bills.filter(b => b.type === 'admission_advance' || (b.advanceAmount > 0)).map(bill => (
                          <div key={bill._id} className="flex justify-between items-center p-2 bg-white rounded border border-yellow-200">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{bill.billNumber}</p>
                              <p className="text-xs text-gray-500">{formatDateIST(bill.billDate)}</p>
                            </div>
                            <p className="text-sm font-medium text-green-600">₹{bill.advanceAmount?.toFixed(2) || 0}</p>
                          </div>
                        ))}
                        <div className="flex justify-between items-center p-2 bg-yellow-100 rounded border border-yellow-300">
                          <p className="text-sm font-medium text-yellow-900">Total Advance Collected</p>
                          <p className="text-sm font-bold text-yellow-900">₹{bills.reduce((sum, b) => sum + (b.advanceAmount || 0), 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Insurance/Govt Scheme */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 mb-6">
                <p className="text-sm font-medium text-purple-900 mb-2">Insurance / Government Scheme</p>
                {admission?.hasInsurance ? (
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-purple-700">TPA Insurance - {admission.insuranceProvider}</p>
                      <p className="text-xs text-purple-600">Policy: {admission.insuranceNumber}</p>
                    </div>
                    <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">Insurance Available</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-3">No insurance information on file</p>
                )}
                {admission?.hasGovtScheme && (
                  <div className="mb-3">
                    <p className="text-sm text-green-700">Govt Scheme: {admission.schemeName} ({admission.schemeNumber})</p>
                  </div>
                )}
                
                {/* Claim from Insurance/Scheme */}
                {(admission?.hasInsurance || admission?.hasGovtScheme) && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <label className="flex items-center mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={claimFromInsurance}
                        onChange={(e) => setClaimFromInsurance(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-purple-900">
                        Claim from {admission?.hasInsurance ? 'Insurance' : admission?.hasGovtScheme ? 'Government Scheme' : 'Insurance/Scheme'}
                      </span>
                    </label>
                    {claimFromInsurance && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-purple-900 mb-1">Claim Amount (₹)</label>
                        <input
                          type="number"
                          value={claimAmount}
                          onChange={(e) => setClaimAmount(parseFloat(e.target.value) || 0)}
                          className="form-input w-full"
                          min="0"
                          step="0.01"
                          placeholder="Enter claim amount"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Patient Balance Information - Only for Full & Final */}
              {billType === 'full_final' && (admission?.patientId?.advanceBalance > 0 || admission?.patientId?.unpaidBalance > 0) && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 mb-6">
                  <p className="text-sm font-medium text-yellow-900 mb-2">Patient Balance Information</p>
                  {admission?.patientId?.advanceBalance > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm text-blue-700">Advance Balance Available</p>
                          <p className="text-xs text-blue-600">Available: ₹{admission.patientId.advanceBalance.toFixed(2)}</p>
                        </div>
                        <p className="text-lg font-bold text-blue-600">₹{admission.patientId.advanceBalance.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-blue-600">Apply to this bill:</label>
                        <input
                          type="number"
                          value={advanceFromBalance}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setAdvanceFromBalance(Math.min(value, admission.patientId.advanceBalance));
                          }}
                          className="form-input w-32 text-sm"
                          min="0"
                          max={admission.patientId.advanceBalance}
                          step="0.01"
                        />
                        <button
                          onClick={() => setAdvanceFromBalance(admission.patientId.advanceBalance)}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                        >
                          Max
                        </button>
                        <button
                          onClick={() => setAdvanceFromBalance(0)}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                  {admission?.patientId?.unpaidBalance > 0 && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-700">Unpaid Balance from Previous Bills</p>
                        <p className="text-xs text-red-600">Will be added to this bill</p>
                      </div>
                      <p className="text-lg font-bold text-red-600">₹{admission.patientId.unpaidBalance.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Discount & Advance Payment - Only for Full & Final */}
              {billType === 'full_final' && (
                <div className="grid grid-cols-2 gap-4 mb-6">
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
              )}

              {/* Payment Method & Reference - Only for Advance */}
              {billType === 'advance' && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-sm font-medium text-blue-900 mb-2">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="form-input w-full"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="online">Bank Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {paymentMethod !== 'cash' && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <label className="block text-sm font-medium text-blue-900 mb-2">Reference/UTR Number</label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="form-input w-full"
                        placeholder="Enter UTR/Transaction ID"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Total & Create Button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                {billType === 'advance' ? (
                  <div>
                    <p className="text-sm text-gray-500">Advance Amount to Collect</p>
                    <p className="text-2xl font-bold text-green-600">₹{advanceAmount.toFixed(2)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">Subtotal: ₹{calculateSubtotal().toFixed(2)}</p>
                    {discount > 0 && <p className="text-sm text-green-600">Discount: -₹{discount.toFixed(2)}</p>}
                    {advanceAmount > 0 && <p className="text-sm text-blue-600">Advance: -₹{advanceAmount.toFixed(2)}</p>}
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900">₹{calculateTotal().toFixed(2)}</p>
                  </div>
                )}
                <button
                  onClick={createBill}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 flex items-center"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Create Bill
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal - Outside main container to avoid clipping */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Mark Bill as Paid</h3>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', color: '#4b5563' }}>Bill Number: {billToPay?.billNumber}</p>
              <p style={{ fontSize: '14px', color: '#4b5563' }}>Balance: ₹{billToPay?.balanceAmount?.toFixed(2)}</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="online">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            {paymentMethod !== 'cash' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Reference Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="Enter UTR/Transaction ID"
                />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentMethod('cash');
                  setReferenceNumber('');
                  setBillToPay(null);
                }}
                style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionBillingPage;
