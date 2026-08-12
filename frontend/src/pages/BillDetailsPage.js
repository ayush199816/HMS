import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST } from '../utils/dateUtils';
import { 
  ArrowLeft,
  CreditCard,
  CheckCircle,
  Printer
} from 'lucide-react';

const BillDetailsPage = () => {
  const { billId } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [bill, setBill] = useState(null);
  const [relatedDetails, setRelatedDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    sourceType: 'patient',
    amount: 0,
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    insuranceProvider: '',
    policyNumber: '',
    claimNumber: '',
    schemeName: '',
    schemeId: '',
    beneficiaryId: ''
  });

  const fetchBill = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/billing/${billId}`);
      setBill(response.data.bill);
      setRelatedDetails(response.data.relatedDetails || {});
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch bill details');
    } finally {
      setLoading(false);
    }
  }, [billId, api]);

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  const addPayment = async () => {
    try {
      await api.post(`/billing/${billId}/payment`, paymentForm);
      alert('Payment recorded successfully!');
      await fetchBill();
      setPaymentForm({
        sourceType: 'patient',
        amount: 0,
        paymentMethod: 'cash',
        referenceNumber: '',
        notes: '',
        insuranceProvider: '',
        policyNumber: '',
        claimNumber: '',
        schemeName: '',
        schemeId: '',
        beneficiaryId: ''
      });
      setShowPaymentForm(false);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to record payment');
    }
  };

  const deleteBill = async () => {
    if (!window.confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/billing/${billId}`);
      alert('Bill deleted successfully');
      navigate(-1);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete bill');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Bill not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Not Printed */}
      <div className="bg-white border-b no-print">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Bill Details</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 no-print">
            {error}
          </div>
        )}

        {/* Bill Container - Printable */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Bill Header */}
          <div className="border-b-4 border-blue-600 p-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{bill.hospitalId?.name || 'Hospital'}</h1>
                <p className="text-gray-600">Medical Bill / Invoice</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Bill Number</p>
                <p className="text-xl font-bold text-gray-900">{bill.billNumber}</p>
                <p className="text-sm text-gray-500 mt-2">Bill Date</p>
                <p className="text-gray-900">{formatDateIST(bill.billDate)}</p>
              </div>
            </div>
          </div>

          {/* Patient Information */}
          <div className="p-8 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Patient Name</p>
                <p className="font-medium text-gray-900">{bill.patientId?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Patient ID</p>
                <p className="font-medium text-gray-900">{bill.patientId?.opdNumber || bill.patientId?.emergencyNumber || 'N/A'}</p>
              </div>
              {relatedDetails.doctorName && (
                <div>
                  <p className="text-sm text-gray-500">Attending Doctor</p>
                  <p className="font-medium text-gray-900">Dr. {relatedDetails.doctorName}</p>
                  {relatedDetails.doctorSpeciality && (
                    <p className="text-sm text-gray-600">{relatedDetails.doctorSpeciality}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Bill Type</p>
                <p className="font-medium text-gray-900 capitalize">{bill.type}</p>
              </div>
              {relatedDetails.bookingId && (
                <div>
                  <p className="text-sm text-gray-500">Booking ID</p>
                  <p className="font-medium text-gray-900">{relatedDetails.bookingId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bill Items Table */}
          <div className="p-8 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bill Details</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">Description</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-semibold">Qty</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">Price</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items && bill.items.length > 0 ? (
                  bill.items.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">{item.name}</td>
                      <td className="py-3 px-4 text-center">{item.quantity}</td>
                      <td className="py-3 px-4 text-right">₹{item.price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-medium">₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-4 text-center text-gray-500">No items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Summary */}
          <div className="p-8 border-b">
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{bill.amount.toFixed(2)}</span>
                </div>
                {bill.discount > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-green-600">-₹{bill.discount.toFixed(2)}</span>
                  </div>
                )}
                {bill.tax > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">₹{bill.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t-2 border-gray-300 mt-2">
                  <span className="font-semibold text-gray-900">Total Amount</span>
                  <span className="font-bold text-xl text-gray-900">₹{bill.totalAmount.toFixed(2)}</span>
                </div>
                {bill.advanceAmount > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Advance Applied</span>
                    <span className="font-medium text-blue-600">-₹{bill.advanceAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">To Pay Balance</span>
                  <span className="font-bold text-lg text-orange-600">
                    ₹{Math.max(0, bill.totalAmount - bill.advanceAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Actual Amount Paid</span>
                  <span className="font-medium text-green-600">
                    ₹{(bill.paymentSources?.reduce((sum, source) => {
                      if (source.sourceType !== 'advance') {
                        return sum + (source.amount || 0);
                      }
                      return sum;
                    }, 0) || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Balance Due</span>
                  <span className={`font-bold text-lg ${Math.max(0, bill.totalAmount - bill.advanceAmount - (bill.paymentSources?.reduce((sum, source) => {
                    if (source.sourceType !== 'advance') {
                      return sum + (source.amount || 0);
                    }
                    return sum;
                  }, 0) || 0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{Math.max(0, bill.totalAmount - bill.advanceAmount - (bill.paymentSources?.reduce((sum, source) => {
                      if (source.sourceType !== 'advance') {
                        return sum + (source.amount || 0);
                      }
                      return sum;
                    }, 0) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {bill.paymentSources && bill.paymentSources.length > 0 && (
            <div className="p-8 border-b">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
              <div className="space-y-2">
                {bill.paymentSources.map((source, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <div>
                      <p className="font-medium capitalize">{source.sourceType.replace('_', ' ')}</p>
                      {source.paymentMethod && <p className="text-sm text-gray-500">Mode: {source.paymentMethod.toUpperCase()}</p>}
                      {bill.paymentDetails?.paymentMethod && !source.paymentMethod && <p className="text-sm text-gray-500">Mode: {bill.paymentDetails.paymentMethod.toUpperCase()}</p>}
                      {(source.referenceNumber || bill.paymentDetails?.utrNumber) && (
                        <p className="text-sm text-gray-500">UTR/Ref: {source.referenceNumber || bill.paymentDetails?.utrNumber}</p>
                      )}
                      {source.paymentDate && <p className="text-sm text-gray-500">{formatDateIST(source.paymentDate)}</p>}
                    </div>
                    <p className="font-bold text-green-600">₹{source.amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insurance/Scheme Details */}
          {(bill.insuranceDetails || bill.govtSchemeDetails) && (
            <div className="p-8 border-b">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Insurance / Scheme Details</h2>
              {bill.insuranceDetails && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Provider: <span className="font-medium">{bill.insuranceDetails.provider}</span></p>
                  <p className="text-sm text-gray-500">Policy: <span className="font-medium">{bill.insuranceDetails.policyNumber}</span></p>
                  <p className="text-sm text-gray-500">Claim: <span className="font-medium">{bill.insuranceDetails.claimNumber}</span></p>
                  <p className="text-sm text-gray-500">Status: <span className={`px-2 py-1 rounded text-xs ${
                    bill.insuranceDetails.claimStatus === 'approved' ? 'bg-green-100 text-green-800' :
                    bill.insuranceDetails.claimStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{bill.insuranceDetails.claimStatus}</span></p>
                </div>
              )}
              {bill.govtSchemeDetails && (
                <div>
                  <p className="text-sm text-gray-500">Scheme: <span className="font-medium">{bill.govtSchemeDetails.schemeName}</span></p>
                  <p className="text-sm text-gray-500">Scheme ID: <span className="font-medium">{bill.govtSchemeDetails.schemeId}</span></p>
                  <p className="text-sm text-gray-500">Beneficiary: <span className="font-medium">{bill.govtSchemeDetails.beneficiaryId}</span></p>
                  <p className="text-sm text-gray-500">Status: <span className={`px-2 py-1 rounded text-xs ${
                    bill.govtSchemeDetails.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                    bill.govtSchemeDetails.approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{bill.govtSchemeDetails.approvalStatus}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="p-8 bg-gray-50">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-gray-500 mb-2">Generated By</p>
                <p className="font-medium">{bill.createdBy?.name || 'System'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-2">Status</p>
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                  bill.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {bill.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
              <p>Thank you for choosing {bill.hospitalId?.name || 'our hospital'}</p>
              <p className="mt-1">This is a computer-generated bill. No signature required.</p>
            </div>
          </div>
        </div>

        {/* Add Payment Button - Not Printed */}
        {!showPaymentForm && bill.status !== 'paid' && (
          <div className="mt-6 no-print space-y-3">
            <button
              onClick={() => setShowPaymentForm(true)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Record Payment
            </button>
            {bill.status === 'pending' && (
              <button
                onClick={deleteBill}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 flex items-center justify-center"
              >
                Delete Bill
              </button>
            )}
          </div>
        )}

        {/* Add Payment Form - Not Printed */}
        {showPaymentForm && (
          <div className="bg-white rounded-lg shadow mt-6 p-6 no-print">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Source
                </label>
                <select
                  value={paymentForm.sourceType}
                  onChange={(e) => setPaymentForm({ ...paymentForm, sourceType: e.target.value })}
                  className="form-input w-full"
                >
                  <option value="patient">Patient Payment</option>
                  <option value="advance">Advance Payment</option>
                  <option value="insurance">Insurance</option>
                  <option value="govt_scheme">Government Scheme (e.g., Ayushman)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="form-input w-full"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="form-input w-full"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="online">Online Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              {paymentForm.sourceType === 'insurance' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Insurance Provider
                    </label>
                    <input
                      type="text"
                      value={paymentForm.insuranceProvider}
                      onChange={(e) => setPaymentForm({ ...paymentForm, insuranceProvider: e.target.value })}
                      className="form-input w-full"
                      placeholder="e.g., HDFC Ergo, ICICI Lombard"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Policy Number
                    </label>
                    <input
                      type="text"
                      value={paymentForm.policyNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, policyNumber: e.target.value })}
                      className="form-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Claim Number
                    </label>
                    <input
                      type="text"
                      value={paymentForm.claimNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, claimNumber: e.target.value })}
                      className="form-input w-full"
                    />
                  </div>
                </>
              )}

              {paymentForm.sourceType === 'govt_scheme' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheme Name
                    </label>
                    <input
                      type="text"
                      value={paymentForm.schemeName}
                      onChange={(e) => setPaymentForm({ ...paymentForm, schemeName: e.target.value })}
                      className="form-input w-full"
                      placeholder="e.g., Ayushman Bharat, PMJAY"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheme ID
                    </label>
                    <input
                      type="text"
                      value={paymentForm.schemeId}
                      onChange={(e) => setPaymentForm({ ...paymentForm, schemeId: e.target.value })}
                      className="form-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beneficiary ID
                    </label>
                    <input
                      type="text"
                      value={paymentForm.beneficiaryId}
                      onChange={(e) => setPaymentForm({ ...paymentForm, beneficiaryId: e.target.value })}
                      className="form-input w-full"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {paymentForm.paymentMethod === 'upi' ? 'UTR Number' :
                   paymentForm.paymentMethod === 'card' ? 'Card Transaction Number' :
                   paymentForm.paymentMethod === 'online' ? 'Transaction Reference Number' :
                   paymentForm.paymentMethod === 'cheque' ? 'Cheque Number' :
                   'Reference Number (Optional)'}
                </label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="form-input w-full"
                  placeholder={
                    paymentForm.paymentMethod === 'upi' ? 'Enter UTR number' :
                    paymentForm.paymentMethod === 'card' ? 'Enter card transaction number' :
                    paymentForm.paymentMethod === 'online' ? 'Enter transaction reference number' :
                    paymentForm.paymentMethod === 'cheque' ? 'Enter cheque number' :
                    'Transaction ID, Receipt Number, etc.'
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="form-input w-full"
                  rows="2"
                  placeholder="Any additional notes..."
                />
              </div>

              <button
                onClick={addPayment}
                disabled={paymentForm.amount <= 0}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Record Payment
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .min-h-screen {
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BillDetailsPage;
