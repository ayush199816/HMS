import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, ArrowLeft } from 'lucide-react';

const RadiologyTestManagement = () => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [editingTest, setEditingTest] = useState(null);
  const [testFormData, setTestFormData] = useState({
    name: '',
    code: '',
    category: 'X-Ray',
    description: '',
    bodyPart: '',
    preparationInstructions: '',
    contrastRequired: false,
    pricing: {
      costPrice: 0,
      sellingPrice: 0,
      pricingMethod: 'direct'
    }
  });

  const testCategories = [
    'X-Ray',
    'CT Scan',
    'MRI',
    'Ultrasound',
    'PET Scan',
    'Mammography',
    'DEXA Scan',
    'Fluoroscopy',
    'Angiography',
    'Other'
  ];

  const fetchTests = useCallback(async () => {
    try {
      const response = await api.get('/radiology/tests', { params: { limit: 100000 } });
      setTests(response.data.tests);
    } catch (error) {
      console.error('Error fetching tests:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTest) {
        await api.put(`/radiology/tests/${editingTest._id}`, testFormData);
        alert('Test updated successfully!');
      } else {
        await api.post('/radiology/tests', testFormData);
        alert('Test created successfully!');
      }
      setEditingTest(null);
      resetTestForm();
      fetchTests();
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Failed to save test. Please try again.');
    }
  };

  const handleTestEdit = (test) => {
    setEditingTest(test);
    setTestFormData({
      name: test.name,
      code: test.code,
      category: test.category,
      description: test.description,
      bodyPart: test.bodyPart,
      preparationInstructions: test.preparationInstructions,
      contrastRequired: test.contrastRequired,
      pricing: test.pricing
    });
  };

  const handleTestDelete = async (testId) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      try {
        await api.delete(`/radiology/tests/${testId}`);
        alert('Test deleted successfully!');
        fetchTests();
      } catch (error) {
        console.error('Error deleting test:', error);
        alert('Failed to delete test. Please try again.');
      }
    }
  };

  const resetTestForm = () => {
    setTestFormData({
      name: '',
      code: '',
      category: 'X-Ray',
      description: '',
      bodyPart: '',
      preparationInstructions: '',
      contrastRequired: false,
      pricing: {
        costPrice: 0,
        sellingPrice: 0,
        pricingMethod: 'direct'
      }
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            color: '#374151',
            cursor: 'pointer',
            marginBottom: '16px',
            fontSize: '14px'
          }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          Back
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
          Radiology Test Management
        </h1>
        <p style={{ color: '#6b7280' }}>Add, edit, and manage radiology tests</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Add/Edit Form */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px', display: 'flex', alignItems: 'center' }}>
            {editingTest ? (
              <>
                <svg style={{ width: '20px', height: '20px', marginRight: '8px', color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Test
              </>
            ) : (
              <>
                <Plus style={{ width: '20px', height: '20px', marginRight: '8px', color: '#22c55e' }} />
                Add New Test
              </>
            )}
          </h2>
          <form onSubmit={handleTestSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Test Name *</label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    placeholder="e.g., Chest X-Ray"
                    value={testFormData.name}
                    onChange={(e) => setTestFormData({ ...testFormData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Test Code *</label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', textTransform: 'uppercase' }}
                    placeholder="e.g., CHESTXRAY"
                    value={testFormData.code}
                    onChange={(e) => setTestFormData({ ...testFormData, code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Category *</label>
                  <select
                    required
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    value={testFormData.category}
                    onChange={(e) => setTestFormData({ ...testFormData, category: e.target.value })}
                  >
                    {testCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Body Part *</label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                    placeholder="e.g., Chest, Brain, Abdomen"
                    value={testFormData.bodyPart}
                    onChange={(e) => setTestFormData({ ...testFormData, bodyPart: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Description *</label>
                <textarea
                  required
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', resize: 'none' }}
                  rows="3"
                  placeholder="Describe the test procedure..."
                  value={testFormData.description}
                  onChange={(e) => setTestFormData({ ...testFormData, description: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Preparation Instructions</label>
                <textarea
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', resize: 'none' }}
                  rows="2"
                  placeholder="Any special preparation required..."
                  value={testFormData.preparationInstructions}
                  onChange={(e) => setTestFormData({ ...testFormData, preparationInstructions: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <input
                  type="checkbox"
                  id="contrastRequired"
                  style={{ width: '16px', height: '16px', marginRight: '12px' }}
                  checked={testFormData.contrastRequired}
                  onChange={(e) => setTestFormData({ ...testFormData, contrastRequired: e.target.checked })}
                />
                <label htmlFor="contrastRequired" style={{ fontSize: '14px', color: '#374151' }}>Contrast Required</label>
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                <h3 style={{ fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Pricing</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Cost Price *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>₹</span>
                      <input
                        type="number"
                        required
                        min="0"
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', paddingLeft: '32px', paddingRight: '16px', padding: '10px', fontSize: '14px' }}
                        value={testFormData.pricing.costPrice}
                        onChange={(e) => setTestFormData({
                          ...testFormData,
                          pricing: { ...testFormData.pricing, costPrice: parseFloat(e.target.value) || 0 }
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Selling Price *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>₹</span>
                      <input
                        type="number"
                        required
                        min="0"
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', paddingLeft: '32px', paddingRight: '16px', padding: '10px', fontSize: '14px' }}
                        value={testFormData.pricing.sellingPrice}
                        onChange={(e) => setTestFormData({
                          ...testFormData,
                          pricing: { ...testFormData.pricing, sellingPrice: parseFloat(e.target.value) || 0 }
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Pricing Method</label>
                    <select
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', fontSize: '14px' }}
                      value={testFormData.pricing.pricingMethod}
                      onChange={(e) => setTestFormData({
                        ...testFormData,
                        pricing: { ...testFormData.pricing, pricingMethod: e.target.value }
                      })}
                    >
                      <option value="direct">Direct</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
                {editingTest && (
                  <button
                    type="button"
                    onClick={() => {
                      resetTestForm();
                      setEditingTest(null);
                    }}
                    style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', color: '#374151', cursor: 'pointer' }}
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500' }}
                >
                  {editingTest ? 'Update Test' : 'Create Test'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Existing Tests List */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
            <Package style={{ width: '20px', height: '20px', marginRight: '8px', color: '#a855f7' }} />
            Existing Tests ({tests.length})
          </h2>
          <div style={{ overflowY: 'auto', maxHeight: '500px' }}>
            {tests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
                No tests found. Add your first test!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Code</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Price</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test) => (
                    <tr key={test._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '500', color: '#111827' }}>{test.code}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>{test.name}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                          {test.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>₹{test.pricing.sellingPrice}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleTestEdit(test)}
                            style={{ padding: '6px', color: '#2563eb', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            title="Edit"
                          >
                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleTestDelete(test._id)}
                            style={{ padding: '6px', color: '#dc2626', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            title="Delete"
                          >
                            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RadiologyTestManagement;
