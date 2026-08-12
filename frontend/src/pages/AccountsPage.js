import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Plus, Download, CreditCard, Trash2 } from 'lucide-react';

const AccountsPage = () => {
  const { api } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [particulars, setParticulars] = useState([{ description: '', category: '', subCategory: '', quantity: 1, rate: 0, amount: 0 }]);

  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [purchasesRes, categoriesRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/purchases/categories')
      ]);
      setPurchases(purchasesRes.data);
      setCategories(categoriesRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleParticularChange = (idx, field, value) => {
    setParticulars(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const updated = { ...p, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : p.quantity;
        const rate = field === 'rate' ? parseFloat(value) || 0 : p.rate;
        updated.amount = qty * rate;
      }
      return updated;
    }));
  };

  const addParticular = () => {
    setParticulars([...particulars, { description: '', category: '', subCategory: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeParticular = (idx) => {
    setParticulars(particulars.filter((_, i) => i !== idx));
  };

  const totalAmount = particulars.reduce((sum, p) => sum + p.amount, 0);

  const createPurchase = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        vendorName,
        vendorContact,
        purchaseDate,
        particulars
      };
      await api.post('/purchases', payload);
      setVendorName('');
      setVendorContact('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setParticulars([{ description: '', category: '', subCategory: '', quantity: 1, rate: 0, amount: 0 }]);
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.map(e => e.msg).join(', ') || 'Failed to create purchase');
    }
  };

  const openPayment = (purchase) => {
    setPaymentModal(purchase);
    setPaymentAmount(purchase.balanceAmount);
    setPaymentMethod('cash');
    setReferenceNumber('');
  };

  const submitPayment = async () => {
    try {
      setError('');
      const amount = parseFloat(paymentAmount);
      if (!amount || amount <= 0) {
        alert('Enter a valid payment amount');
        return;
      }
      if (paymentMethod !== 'cash' && !referenceNumber) {
        alert('Reference/UTR is required for non-cash payments');
        return;
      }
      await api.post(`/purchases/${paymentModal._id}/payment`, {
        amount,
        paymentMethod,
        referenceNumber
      });
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setReferenceNumber('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const downloadVoucher = async (id, billNumber) => {
    try {
      setError('');
      const response = await api.get(`/purchases/${id}/voucher`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voucher-${billNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download voucher');
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Accounts & Purchases</h1>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              {showForm ? 'Close' : 'New Purchase'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={createPurchase} className="mb-6">
            <div className="border-2 border-gray-800 bg-white p-6 md:p-8">
              <div className="border-b-2 border-gray-800 pb-4 mb-6">
                <h2 className="text-3xl font-bold text-center tracking-widest text-gray-900">PURCHASE BILL</h2>
                <p className="text-center text-sm text-gray-600 mt-1">Hospital Management System</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Vendor / Purchased From</p>
                  <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor Name" className="form-input w-full font-semibold" required />
                  <input type="text" value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} placeholder="Contact" className="form-input w-full mt-2" />
                </div>
                <div className="md:text-right">
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Bill Date</p>
                    <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="form-input w-full md:w-48 md:ml-auto" required />
                  </div>
                  <p className="text-xs text-gray-500">Bill No: <span className="font-mono text-gray-800">AUTO-GENERATED</span></p>
                </div>
              </div>

              <h3 className="text-sm font-bold uppercase tracking-wider mb-2 border-b border-gray-300 pb-1">Particulars</h3>
              <table className="w-full border-collapse border border-gray-800 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-800 px-2 py-1 text-left text-xs w-12">S.No</th>
                    <th className="border border-gray-800 px-2 py-1 text-left text-xs">Category</th>
                    <th className="border border-gray-800 px-2 py-1 text-left text-xs">Sub Category</th>
                    <th className="border border-gray-800 px-2 py-1 text-left text-xs">Description</th>
                    <th className="border border-gray-800 px-2 py-1 text-right text-xs w-16">Qty</th>
                    <th className="border border-gray-800 px-2 py-1 text-right text-xs w-24">Rate</th>
                    <th className="border border-gray-800 px-2 py-1 text-right text-xs w-24">Amount</th>
                    <th className="border border-gray-800 px-2 py-1 text-center text-xs w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {particulars.map((p, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-800 px-2 py-1 text-xs text-center">{idx + 1}</td>
                      <td className="border border-gray-800 px-1 py-1">
                        <input type="text" list="category-list" value={p.category} onChange={(e) => handleParticularChange(idx, 'category', e.target.value)} className="w-full border-0 p-1 text-sm focus:ring-0 outline-none" placeholder="Category" required />
                      </td>
                      <td className="border border-gray-800 px-1 py-1">
                        <input type="text" value={p.subCategory} onChange={(e) => handleParticularChange(idx, 'subCategory', e.target.value)} className="w-full border-0 p-1 text-sm focus:ring-0 outline-none" placeholder="Sub Category" />
                      </td>
                      <td className="border border-gray-800 px-1 py-1">
                        <input type="text" value={p.description} onChange={(e) => handleParticularChange(idx, 'description', e.target.value)} className="w-full border-0 p-1 text-sm focus:ring-0 outline-none" placeholder="Description" required />
                      </td>
                      <td className="border border-gray-800 px-1 py-1">
                        <input type="number" min="0" value={p.quantity} onChange={(e) => handleParticularChange(idx, 'quantity', e.target.value)} className="w-full border-0 p-1 text-sm text-right focus:ring-0 outline-none" required />
                      </td>
                      <td className="border border-gray-800 px-1 py-1">
                        <input type="number" min="0" step="0.01" value={p.rate} onChange={(e) => handleParticularChange(idx, 'rate', e.target.value)} className="w-full border-0 p-1 text-sm text-right focus:ring-0 outline-none" required />
                      </td>
                      <td className="border border-gray-800 px-2 py-1 text-right text-sm font-semibold">₹{p.amount.toFixed(2)}</td>
                      <td className="border border-gray-800 px-2 py-1 text-center">
                        {particulars.length > 1 && (
                          <button type="button" onClick={() => removeParticular(idx)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="category-list">
                {categories.map((c, i) => <option key={i} value={c} />)}
              </datalist>

              <div className="flex justify-between items-start md:items-center mb-6">
                <button type="button" onClick={addParticular} className="text-blue-600 text-sm flex items-center hover:underline">
                  <Plus className="h-4 w-4 mr-1" /> Add Particular
                </button>
                <div className="text-right mt-2 md:mt-0">
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">₹{totalAmount.toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-4 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                  <p className="text-xs text-gray-600">Authorized Signature</p>
                  <p className="mt-4 border-b border-gray-800 w-40"></p>
                </div>
                <button type="submit" className="bg-green-600 text-white px-8 py-2 rounded hover:bg-green-700 font-semibold">
                  Create Purchase
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Purchase Records</h2>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : purchases.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No purchases found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Bill No</th>
                      <th className="text-left py-3 px-4">Vendor</th>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Total</th>
                      <th className="text-left py-3 px-4">Paid</th>
                      <th className="text-left py-3 px-4">Balance</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase) => (
                      <tr key={purchase._id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono">{purchase.billNumber}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{purchase.vendorName}</p>
                          <p className="text-sm text-gray-500">{purchase.vendorContact}</p>
                        </td>
                        <td className="py-3 px-4">{new Date(purchase.purchaseDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-3 px-4">₹{purchase.totalAmount.toFixed(2)}</td>
                        <td className="py-3 px-4">₹{purchase.totalPaid.toFixed(2)}</td>
                        <td className="py-3 px-4">₹{purchase.balanceAmount.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(purchase.status)}`}>
                            {purchase.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            {purchase.status !== 'paid' && (
                              <button
                                onClick={() => openPayment(purchase)}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center"
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pay
                              </button>
                            )}
                            <button
                              onClick={() => downloadVoucher(purchase._id, purchase.billNumber)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Voucher
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

      {paymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Record Payment</h3>
            <p className="text-sm text-gray-600 mb-2">Vendor: {paymentModal.vendorName}</p>
            <p className="text-sm text-gray-600 mb-4">Balance: ₹{paymentModal.balanceAmount.toFixed(2)}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="form-input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="form-input w-full">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="online">Online Transfer</option>
                </select>
              </div>
              {paymentMethod !== 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference/UTR</label>
                  <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="form-input w-full" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setPaymentModal(null)} className="px-4 py-2 bg-gray-200 rounded text-sm">Cancel</button>
              <button onClick={submitPayment} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">Save Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
