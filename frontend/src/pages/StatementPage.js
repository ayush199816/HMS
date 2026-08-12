import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, FileText } from 'lucide-react';

const StatementPage = () => {
  const { api } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalCredit: 0, totalDebit: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/billing/statement');
      setTransactions(res.data.transactions || []);
      setSummary(res.data.summary || { totalCredit: 0, totalDebit: 0, netBalance: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load statement');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatAmount = (amount) => {
    const isCredit = amount >= 0;
    return (
      <span className={`font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
        {isCredit ? '+' : ''}₹{Math.abs(amount).toFixed(2)}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const getSourceBadge = (source) => {
    const styles = {
      collection: 'bg-green-100 text-green-700',
      refund: 'bg-red-100 text-red-700',
      expense: 'bg-orange-100 text-orange-700'
    };
    const labels = {
      collection: 'Credit',
      refund: 'Debit',
      expense: 'Debit'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[source] || 'bg-gray-100 text-gray-700'}`}>
        {labels[source] || source}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FileText className="h-6 w-6 mr-2" />
              Accounts Statement
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Collection</p>
            <p className="text-2xl font-bold text-green-600">₹{summary.totalCredit.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Debit</p>
            <p className="text-2xl font-bold text-red-600">₹{Math.abs(summary.totalDebit).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Net Balance</p>
            <p className={`text-2xl font-bold ${summary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{summary.netBalance.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Statement</h2>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No records found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-left py-3 px-4">Source</th>
                      <th className="text-left py-3 px-4">Bill / Ref</th>
                      <th className="text-left py-3 px-4">Patient / Vendor</th>
                      <th className="text-left py-3 px-4">Method</th>
                      <th className="text-right py-3 px-4">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{formatDate(t.date)}</td>
                        <td className="py-3 px-4 capitalize">{t.category}</td>
                        <td className="py-3 px-4">{getSourceBadge(t.source)}</td>
                        <td className="py-3 px-4 font-mono text-sm">{t.billNumber || '-'}</td>
                        <td className="py-3 px-4">{t.patient}</td>
                        <td className="py-3 px-4 capitalize">{t.paymentMethod}</td>
                        <td className="py-3 px-4 text-right">{formatAmount(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementPage;