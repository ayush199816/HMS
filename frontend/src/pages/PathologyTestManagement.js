import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  TestTube, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Save,
  X,
  ChevronDown,
  Package,
  DollarSign,
  ArrowLeft
} from 'lucide-react';

const PathologyTestManagement = () => {
  const { api } = useAuth();
  const [tests, setTests] = useState([]);
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [tempPrice, setTempPrice] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    sampleType: 'Blood',
    preparationInstructions: '',
    normalRange: '',
    units: '',
    pricing: {
      costPrice: '',
      sellingPrice: '',
      pricingMethod: 'direct'
    },
    provider: ''
  });

  // Predefined test data for quick seeding
  const predefinedTests = useMemo(() => ({
    'Hematology': [
      'Hemoglobin', 'TLC', 'DLC', 'RBC Count', 'Eosinophil Count', 'Platelet Count',
      'BT', 'CT', 'ESR', 'PCV/Hematocrit', 'Complete Hemogram', 'PBF for Type of Anemia',
      'Blood Grouping', 'PT, INR', 'APTT', 'G6PD', 'Reticulocyte count', 'd-Dimer',
      'Screening Test for hemoglobinopathies'
    ],
    'Urine Examination': [
      'Microscopic Exam', 'Urine Sugar', 'Urine ALBUMIN', 'Bile Salts', 'Bile Pigments',
      'Urinary pH', 'Urine for RBC', 'Urine for Ketone Bodies', 'Urine for Pregnancy',
      'Urine for Bilirubin', 'Urine Specific Gravity', 'Urine Urobilinogen',
      'Urine Leucocytes', 'Urine Nitrite'
    ],
    'Semen Analysis': [
      'Semen Analysis', 'Semen Volume', 'Sperm Count', 'Sperm Motility', 'Sperm Morphology'
    ],
    'Cytopathology': [
      'FNAC', 'PAP Smear'
    ],
    'Body Fluids': [
      'CSF Microscopy', 'Synovial Fluid Analysis', 'Pleural Fluid Analysis', 'Ascitic Fluid Analysis'
    ],
    'Histopathology': [
      'Whole Specimens/Biopsy Specimens', 'Postmortem specimens'
    ],
    'Microbiology': [
      'Bacterial Culture & Antibiotic sensitivity', 'Tuberculosis Culture', 'Fungal culture',
      'Gram\'s stain', 'KOH mount', 'ZN staining', 'PBF for Malarial Parasite', 'VDRL/RPR/TPHA',
      'CRP', 'Rheumatoid Factor(RA)', 'ASO', 'WIDAL', 'Malaria Ag card', 'Dengue serology',
      'HCV Card', 'HCV ELISA', 'HBsAg ELISA', 'HBsAg CARD', 'HIV card', 'Stool For Ova/Cyst',
      'Stool For Occult blood', 'IgE', 'IgG', 'IgM', 'IgA', 'Serum ferritin test',
      'Serum Ceruloplasmin levels', 'ASO level', 'C3 Level', 'IL6', 'SCRUB TYPHUS',
      'RTPCR FOR COVID 19'
    ],
    'Biochemistry': [
      'B. Glucose', 'B. urea', 'S. Creatinine', 'S. Bilirubin Total', 'T. Protein',
      'S. Albumin', 'S. Calcium', 'S. Phosphorus', 'S. Uric Acid', 'T. Cholesterol',
      'Triglyceride', 'HDL Cholesterol', 'Serum Sodium', 'Serum Potassium',
      'Serum Chloride', 'Serum Lithium', 'Ionized Calcium', 'S. SGOT', 'S. SGPT',
      'ALP', 'Amylase', 'CPK-MB', 'Iron', 'Magnesium', 'PCT', 'GGT',
      'S. L.D.L. Cholesterol', 'L.D.H.', 'TPUC', 'UIBC', 'HbA1C', 'TSH', 'fT3', 'fT4',
      'Anti - TPO Antibodies', 'hs-CRP', 'CRP', 'Transferrin'
    ],
    'Blood Bank': [
      'HIV, HBsAg, HCV, Syphilis, Malaria Parasite', 'Coombs Crossmatch',
      'Blood Grouping', 'Component Preparation', 'Apheresis'
    ]
  }), []);

  // Fetch tests
  const fetchTests = useCallback(async () => {
    try {
      const response = await api.get('/pathology/tests', {
        params: {
          search: searchTerm,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          provider: providerFilter !== 'all' ? providerFilter : undefined,
          limit: 100
        }
      });
      setTests(response.data.tests);
    } catch (error) {
      console.error('Error fetching tests:', error);
    }
  }, [api, searchTerm, categoryFilter, providerFilter]);

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    try {
      const response = await api.get('/pathology/providers', { params: { limit: 100 } });
      setProviders(response.data.providers);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  }, [api]);

  // Quick create provider
  const quickCreateProvider = async () => {
    try {
      await api.post('/pathology/providers', {
        name: 'In-house Laboratory',
        code: 'LAB001',
        contactPerson: 'Lab Manager',
        phone: '1234567890',
        email: 'lab@hospital.com',
        address: 'Hospital Laboratory',
        city: 'Default City',
        state: 'Default State',
        pincode: '123456',
        licenseNumber: 'LAB123456',
        accreditation: 'NABL',
        specialization: ['Hematology', 'Biochemistry', 'Microbiology'],
        turnaroundTime: 24,
        samplePickup: false,
        homeCollection: true,
        emergencyServices: true
      });
      
      fetchProviders();
      alert('Pathology provider created successfully!');
    } catch (error) {
      console.error('Error creating provider:', error);
      alert('Error creating provider. Please try again.');
    }
  };

  // Handle inline price editing
  const startPriceEdit = (testId, currentPrice) => {
    setEditingPrice(testId);
    setTempPrice(currentPrice.toString());
  };

  const savePriceEdit = async (testId) => {
    try {
      const newPrice = parseFloat(tempPrice);
      if (isNaN(newPrice) || newPrice < 0) {
        alert('Please enter a valid price');
        return;
      }

      await api.put(`/pathology/tests/${testId}`, {
        pricing: {
          costPrice: newPrice * 0.67, // Assume 33% profit margin
          sellingPrice: newPrice,
          pricingMethod: 'direct'
        }
      });

      fetchTests();
      setEditingPrice(null);
      setTempPrice('');
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Error updating price');
    }
  };

  const cancelPriceEdit = () => {
    setEditingPrice(null);
    setTempPrice('');
  };

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/pathology/categories');
      const existingCategories = response.data.categories || [];
      const predefinedCategories = Object.keys(predefinedTests);
      setCategories([...new Set([...existingCategories, ...predefinedCategories])]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, [api, predefinedTests]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTests(), fetchProviders(), fetchCategories()]).finally(() => setLoading(false));
  }, [fetchTests, fetchProviders, fetchCategories]);

  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        pricing: {
          ...formData.pricing,
          costPrice: parseFloat(formData.pricing.costPrice),
          sellingPrice: parseFloat(formData.pricing.sellingPrice)
        }
      };

      if (selectedTest) {
        await api.put(`/pathology/tests/${selectedTest._id}`, data);
      } else {
        await api.post('/pathology/tests', data);
      }

      fetchTests();
      setShowAddModal(false);
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving test:', error);
    }
  };

  // Handle delete
  const handleDelete = async (testId) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      try {
        await api.delete(`/pathology/tests/${testId}`);
        fetchTests();
      } catch (error) {
        console.error('Error deleting test:', error);
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      category: '',
      description: '',
      sampleType: 'Blood',
      preparationInstructions: '',
      normalRange: '',
      units: '',
      pricing: {
        costPrice: '',
        sellingPrice: '',
        pricingMethod: 'direct'
      },
      provider: ''
    });
    setSelectedTest(null);
  };

  
  // Quick add tests from predefined list
  const quickAddTests = async (category, testNames) => {
    try {
      const defaultProvider = providers[0];
      if (!defaultProvider) {
        alert('Please add a pathology provider first');
        return;
      }

      for (const testName of testNames) {
        const code = testName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        await api.post('/pathology/tests', {
          name: testName,
          code: code,
          category: category,
          description: `${testName} - ${category} test`,
          sampleType: getDefaultSampleType(category),
          preparationInstructions: '',
          normalRange: '',
          units: '',
          pricing: {
            costPrice: 100,
            sellingPrice: 150,
            pricingMethod: 'direct'
          },
          provider: defaultProvider._id
        });
      }
      
      fetchTests();
      setShowCategoryDropdown(false);
    } catch (error) {
      console.error('Error adding tests:', error);
    }
  };

  const getDefaultSampleType = (category) => {
    switch (category) {
      case 'Hematology':
      case 'Biochemistry':
      case 'Blood Bank':
        return 'Blood';
      case 'Urine Examination':
        return 'Urine';
      case 'Semen Analysis':
        return 'Other';
      case 'Histopathology':
      case 'Cytopathology':
        return 'Tissue';
      case 'Microbiology':
        return 'Swab';
      case 'Body Fluids':
        return 'CSF';
      default:
        return 'Blood';
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
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="btn btn-secondary mb-4 inline-flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Pathology Test Management</h1>
            <p className="text-gray-600">Add and manage pathology tests</p>
          </div>
        </div>
      </div>

      {/* Warning for no providers */}
      {providers.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-yellow-800 font-medium">No Pathology Providers Found</h3>
              <p className="text-yellow-600 text-sm mt-1">You need to add a pathology provider before you can create tests.</p>
            </div>
            <button
              onClick={quickCreateProvider}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Default Provider
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          {providers.length === 0 && (
            <button
              onClick={quickCreateProvider}
              className="btn btn-warning"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Provider First
            </button>
          )}
          <button
            onClick={() => {
              setShowAddModal(true);
              setShowEditModal(false);
            }}
            disabled={providers.length === 0}
            className={`btn ${providers.length === 0 ? 'btn-disabled' : 'btn-primary'}`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Test
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              disabled={providers.length === 0}
              className={`btn ${providers.length === 0 ? 'btn-disabled' : 'btn-secondary'}`}
            >
              <Package className="h-4 w-4 mr-2" />
              Quick Add Category
              <ChevronDown className="h-4 w-4 ml-2" />
            </button>
            
            {showCategoryDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-50">
                <div className="max-h-96 overflow-y-auto">
                  {Object.entries(predefinedTests).map(([category, tests]) => (
                    <button
                      key={category}
                      onClick={() => quickAddTests(category, tests)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{category}</div>
                      <div className="text-sm text-gray-500">{tests.length} tests</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-48"
            />
          </div>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">All Providers</option>
            {providers.map(provider => (
              <option key={provider._id} value={provider._id}>{provider.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tests Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Pathology Tests ({tests.length})</h2>
        </div>
        <div className="card-body">
          {tests.length === 0 ? (
            <div className="text-center py-8">
              <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No tests found</p>
              <p className="text-sm text-gray-500">Add your first pathology test to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Test Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sample Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tests.map((test) => (
                    <tr key={test._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{test.name}</div>
                          <div className="text-sm text-gray-500">{test.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {test.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="badge badge-info">{test.category}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {test.sampleType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {test.provider?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editingPrice === test._id ? (
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              <DollarSign className="h-3 w-3 text-gray-400 mr-1" />
                              <input
                                type="number"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(e.target.value)}
                                className="form-input w-20 text-sm"
                                min="0"
                                step="0.01"
                                autoFocus
                              />
                            </div>
                            <button
                              onClick={() => savePriceEdit(test._id)}
                              className="btn btn-sm btn-primary"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              onClick={cancelPriceEdit}
                              className="btn btn-sm btn-secondary"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center cursor-pointer hover:text-blue-600"
                            onClick={() => startPriceEdit(test._id, test.pricing?.sellingPrice || 0)}
                          >
                            <DollarSign className="h-3 w-3 text-gray-400 mr-1" />
                            <span>₹{test.pricing?.sellingPrice || 0}</span>
                            <Edit className="h-3 w-3 ml-2 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setShowEditModal(true);
                              setShowAddModal(false);
                              setSelectedTest(test);
                              setFormData({
                                name: test.name,
                                code: test.code,
                                category: test.category,
                                description: test.description,
                                sampleType: test.sampleType,
                                preparationInstructions: test.preparationInstructions,
                                normalRange: test.normalRange,
                                units: test.units,
                                pricing: test.pricing,
                                provider: test.provider?._id
                              });
                            }}
                            className="btn btn-sm btn-secondary"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(test._id)}
                            className="btn btn-sm btn-danger"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
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

      {/* Simple Test Modal - Independent */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 0, 0, 0.8)',
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '4px solid blue',
            maxWidth: '500px'
          }}>
            <h3>TEST MODAL WORKING!</h3>
            <p>If you can see this, the modal rendering works.</p>
            <button 
              onClick={() => setShowAddModal(false)}
              style={{
                backgroundColor: 'blue',
                color: 'white',
                padding: '10px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close Test Modal
            </button>
          </div>
        </div>
      )}

      {/* Modal Debug Test */}
      {(showAddModal || showEditModal) && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-4 z-[999999] rounded">
          MODAL IS OPEN! Add: {showAddModal.toString()}, Edit: {showEditModal.toString()}
        </div>
      )}

      {/* Add/Edit Modal - Fixed with Inline Styles */}
      {(showAddModal || showEditModal) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '672px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                {selectedTest ? 'Edit Test' : 'Add New Test'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Test Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="e.g., Hemoglobin"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Test Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="e.g., HGB"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Sample Type *
                  </label>
                  <select
                    required
                    value={formData.sampleType}
                    onChange={(e) => setFormData({...formData, sampleType: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="Blood">Blood</option>
                    <option value="Urine">Urine</option>
                    <option value="Stool">Stool</option>
                    <option value="Sputum">Sputum</option>
                    <option value="Swab">Swab</option>
                    <option value="Tissue">Tissue</option>
                    <option value="CSF">CSF</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Description *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '60px'
                  }}
                  placeholder="Test description..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Preparation Instructions
                </label>
                <textarea
                  value={formData.preparationInstructions}
                  onChange={(e) => setFormData({...formData, preparationInstructions: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '60px'
                  }}
                  placeholder="Patient preparation instructions..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Normal Range
                  </label>
                  <input
                    type="text"
                    value={formData.normalRange}
                    onChange={(e) => setFormData({...formData, normalRange: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="e.g., 12-16 g/dL"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Units
                  </label>
                  <input
                    type="text"
                    value={formData.units}
                    onChange={(e) => setFormData({...formData, units: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="e.g., g/dL"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Provider *
                  </label>
                  <select
                    required
                    value={formData.provider}
                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select Provider</option>
                    {providers.map(provider => (
                      <option key={provider._id} value={provider._id}>{provider.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                <h4 style={{ fontWeight: '500', color: '#111827', marginBottom: '12px' }}>Pricing Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Cost Price *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.pricing.costPrice}
                      onChange={(e) => setFormData({
                        ...formData, 
                        pricing: {...formData.pricing, costPrice: e.target.value}
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Selling Price *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.pricing.sellingPrice}
                      onChange={(e) => setFormData({
                        ...formData, 
                        pricing: {...formData.pricing, sellingPrice: e.target.value}
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Pricing Method
                    </label>
                    <select
                      value={formData.pricing.pricingMethod}
                      onChange={(e) => setFormData({
                        ...formData, 
                        pricing: {...formData.pricing, pricingMethod: e.target.value}
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="direct">Direct</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Save style={{ width: '16px', height: '16px' }} />
                  {selectedTest ? 'Update Test' : 'Add Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PathologyTestManagement;
