import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building, 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  User, 
  Phone,
  Stethoscope,
  Activity,
  Pill,
  CreditCard,
  Calendar,
  AlertCircle,
  FileText,
  UserPlus,
  Filter,
  Bed as BedIcon
} from 'lucide-react';

const HospitalAdminDashboard = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [activeTab, setActiveTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Department form data
  const [departmentFormData, setDepartmentFormData] = useState({
    name: '',
    description: '',
    departmentType: 'medical'
  });

  // Staff form data
  const [staffFormData, setStaffFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'doctor',
    departmentId: '',
    // Doctor specific fields
    specialities: [],
    education: [],
    picture: '',
    otherHospitals: [],
    emergencyNumber: '',
    address: '',
    opdFees: '',
    emergencyFees: '',
    commissionPercentage: 0,
    realOpdFees: '',
    realEmergencyFees: '',
    dailyVisitFee: 500
  });

  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (activeTab === 'departments') {
        const response = await api.get(`/departments/hospital/${user.hospitalId}`);
        setDepartments(response.data.departments);
      } else if (activeTab === 'staff') {
        const response = await api.get(`/staff/hospital/${user.hospitalId}`);
        setStaff(response.data.staff);
      } else if (activeTab === 'users') {
        const response = await api.get('/auth/users', {
          params: { search: searchTerm, role: userRoleFilter !== 'all' ? userRoleFilter : undefined }
        });
        setUsers(response.data.users);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.hospitalId, api, searchTerm, userRoleFilter]);

  useEffect(() => {
    if (user?.hospitalId) {
      fetchData();
    }
  }, [activeTab, user?.hospitalId, fetchData]);

  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingItem) {
        const response = await api.put(`/departments/${editingItem._id}`, departmentFormData);
        setDepartments(prev => prev.map(d => 
          d._id === editingItem._id ? response.data.department : d
        ));
      } else {
        const response = await api.post('/departments', {
          ...departmentFormData,
          hospitalId: user.hospitalId
        });
        setDepartments(prev => [response.data.department, ...prev]);
      }
      
      setShowCreateForm(false);
      setEditingItem(null);
      setDepartmentFormData({
        name: '',
        description: '',
        departmentType: 'medical'
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save department');
    }
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const staffData = {
        ...staffFormData,
        hospitalId: user.hospitalId,
        // Convert string fields to numbers for doctors
        ...(staffFormData.role === 'doctor' && {
          opdFees: parseFloat(staffFormData.opdFees),
          emergencyFees: parseFloat(staffFormData.emergencyFees),
          commissionPercentage: parseFloat(staffFormData.commissionPercentage),
          realOpdFees: parseFloat(staffFormData.realOpdFees),
          realEmergencyFees: parseFloat(staffFormData.realEmergencyFees),
          dailyVisitFee: parseFloat(staffFormData.dailyVisitFee)
        })
      };

      if (editingItem) {
        const response = await api.put(`/staff/${editingItem._id}`, staffData);
        setStaff(prev => prev.map(s => 
          s._id === editingItem._id ? response.data.staff : s
        ));
      } else {
        const response = await api.post('/staff', staffData);
        setStaff(prev => [response.data.staff, ...prev]);
      }
      
      setShowCreateForm(false);
      setEditingItem(null);
      setStaffFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'doctor',
        departmentId: '',
        specialities: [],
        education: [],
        picture: '',
        otherHospitals: [],
        emergencyNumber: '',
        address: '',
        opdFees: '',
        emergencyFees: '',
        commissionPercentage: 0,
        realOpdFees: '',
        realEmergencyFees: '',
        dailyVisitFee: 500
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save staff');
    }
  };

  
  const handleEdit = (item) => {
    setEditingItem(item);
    if (activeTab === 'departments') {
      setDepartmentFormData({
        name: item.name,
        description: item.description,
        departmentType: item.departmentType
      });
    } else {
      setStaffFormData({
        name: item.name,
        email: item.email,
        password: '',
        phone: item.phone,
        role: item.role,
        departmentId: item.departmentId?._id || item.departmentId,
        specialities: item.specialities || [],
        education: item.education || [],
        picture: item.picture || '',
        otherHospitals: item.otherHospitals || [],
        emergencyNumber: item.emergencyNumber || '',
        address: item.address || '',
        opdFees: item.opdFees || '',
        emergencyFees: item.emergencyFees || '',
        commissionPercentage: item.commissionPercentage || 0,
        realOpdFees: item.realOpdFees || '',
        realEmergencyFees: item.realEmergencyFees || '',
        dailyVisitFee: item.dailyVisitFee || 500
      });
    }
    setShowCreateForm(true);
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm(`Are you sure you want to deactivate this ${activeTab === 'departments' ? 'department' : 'staff member'}?`)) {
      return;
    }

    try {
      await api.delete(`/${activeTab}/${itemId}`);
      if (activeTab === 'departments') {
        setDepartments(prev => prev.filter(d => d._id !== itemId));
      } else {
        setStaff(prev => prev.filter(s => s._id !== itemId));
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete item');
    }
  };

  const getRoleIcon = (role) => {
    const icons = {
      doctor: Stethoscope,
      assistant_doctor: Activity,
      nurse: Users,
      pathologist: FileText,
      diagnostic: Activity,
      pharmacist: Pill,
      billing_staff: CreditCard,
      receptionist: Calendar
    };
    return icons[role] || User;
  };

  const filteredData = activeTab === 'departments' 
    ? departments.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : activeTab === 'users' 
    ? users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm)
      )
    : staff.filter(person =>
        person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.phone.includes(searchTerm)
      );

  if (showCreateForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {editingItem ? `Edit ${activeTab === 'departments' ? 'Department' : 'Staff Member'}` : `Create New ${activeTab === 'departments' ? 'Department' : 'Staff Member'}`}
            </h2>
            <p className="card-description">
              {activeTab === 'departments' ? 'Manage hospital departments' : 'Add new staff member to the hospital'}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger flex items-center mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {activeTab === 'departments' ? (
            <form onSubmit={handleDepartmentSubmit} className="space-y-6">
              <div>
                <label className="form-label">Department Name *</label>
                <input
                  type="text"
                  name="name"
                  value={departmentFormData.name}
                  onChange={(e) => setDepartmentFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Department Type *</label>
                <select
                  name="departmentType"
                  value={departmentFormData.departmentType}
                  onChange={(e) => setDepartmentFormData(prev => ({ ...prev, departmentType: e.target.value }))}
                  className="form-input"
                  required
                >
                  <option value="medical">Medical</option>
                  <option value="diagnostic">Diagnostic</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="billing">Billing</option>
                  <option value="administrative">Administrative</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  name="description"
                  value={departmentFormData.description}
                  onChange={(e) => setDepartmentFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows="3"
                  className="form-input"
                  placeholder="Brief description about the department..."
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingItem(null);
                    setDepartmentFormData({
                      name: '',
                      description: '',
                      departmentType: 'medical'
                    });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingItem ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStaffSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={staffFormData.name}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={staffFormData.phone}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Role *</label>
                  <select
                    name="role"
                    value={staffFormData.role}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="form-input"
                    required
                  >
                    <option value="doctor">Doctor</option>
                    <option value="assistant_doctor">Assistant Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="pathologist">Pathologist</option>
                    <option value="diagnostic">Diagnostic</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="billing_staff">Billing Staff</option>
                    <option value="accounts">Accounts</option>
                    <option value="receptionist">Receptionist</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Department *</label>
                  <select
                    name="departmentId"
                    value={staffFormData.departmentId}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                    className="form-input"
                    required
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!editingItem && (
                  <div>
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      name="password"
                      value={staffFormData.password}
                      onChange={(e) => setStaffFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="form-input"
                      required
                      minLength="6"
                    />
                  </div>
                )}
              </div>

              {staffFormData.role === 'doctor' && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Doctor Specific Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="form-label">Specialities *</label>
                      <input
                        type="text"
                        value={staffFormData.specialities.join(', ')}
                        onChange={(e) => setStaffFormData(prev => ({ 
                          ...prev, 
                          specialities: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                        }))}
                        className="form-input"
                        placeholder="Cardiology, Neurology (comma separated)"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Emergency Number *</label>
                      <input
                        type="tel"
                        name="emergencyNumber"
                        value={staffFormData.emergencyNumber}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, emergencyNumber: e.target.value }))}
                        className="form-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Address *</label>
                      <textarea
                        name="address"
                        value={staffFormData.address}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, address: e.target.value }))}
                        rows="2"
                        className="form-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">OPD Fees *</label>
                      <input
                        type="number"
                        name="opdFees"
                        value={staffFormData.opdFees}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, opdFees: e.target.value }))}
                        className="form-input"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Emergency Fees *</label>
                      <input
                        type="number"
                        name="emergencyFees"
                        value={staffFormData.emergencyFees}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, emergencyFees: e.target.value }))}
                        className="form-input"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Commission Percentage</label>
                      <input
                        type="number"
                        name="commissionPercentage"
                        value={staffFormData.commissionPercentage}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, commissionPercentage: e.target.value }))}
                        className="form-input"
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </div>

                    <div>
                      <label className="form-label">Real OPD Fees *</label>
                      <input
                        type="number"
                        name="realOpdFees"
                        value={staffFormData.realOpdFees}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, realOpdFees: e.target.value }))}
                        className="form-input"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Real Emergency Fees *</label>
                      <input
                        type="number"
                        name="realEmergencyFees"
                        value={staffFormData.realEmergencyFees}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, realEmergencyFees: e.target.value }))}
                        className="form-input"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Daily Visit Fee (Admission) *</label>
                      <input
                        type="number"
                        name="dailyVisitFee"
                        value={staffFormData.dailyVisitFee}
                        onChange={(e) => setStaffFormData(prev => ({ ...prev, dailyVisitFee: e.target.value }))}
                        className="form-input"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingItem(null);
                    setStaffFormData({
                      name: '',
                      email: '',
                      password: '',
                      phone: '',
                      role: 'doctor',
                      departmentId: '',
                      specialities: [],
                      education: [],
                      picture: '',
                      otherHospitals: [],
                      emergencyNumber: '',
                      address: '',
                      opdFees: '',
                      emergencyFees: '',
                      commissionPercentage: 0,
                      realOpdFees: '',
                      realEmergencyFees: '',
                      dailyVisitFee: 500
                    });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingItem ? 'Update Staff' : 'Create Staff'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hospital Administration</h1>
            <p className="text-gray-600 mt-1">Manage departments, staff, and beds</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/hospital-admin/bed-management')}
              className="btn-secondary flex items-center"
            >
              <BedIcon className="h-4 w-4 mr-2" />
              Manage Beds
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {activeTab === 'departments' ? 'Department' : 'Staff'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center mb-6">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('departments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'departments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building className="inline h-4 w-4 mr-2" />
            Departments ({departments.length})
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'staff'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="inline h-4 w-4 mr-2" />
            Staff ({staff.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserPlus className="inline h-4 w-4 mr-2" />
            Users ({users.length})
          </button>
        </nav>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'departments' ? 'departments' : activeTab === 'staff' ? 'staff' : 'users'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-64"
            />
          </div>
          
          {activeTab === 'users' && (
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="form-input"
              >
                <option value="all">All Roles</option>
                <option value="doctor">Doctors</option>
                <option value="pathologist">Pathology Lab</option>
                <option value="receptionist">Receptionist</option>
                <option value="nurse">Nurse</option>
                <option value="billing_staff">Billing Staff</option>
                <option value="pharmacist">Pharmacist</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                {activeTab === 'departments' ? (
                  <>
                    <th className="table-header-cell">Department</th>
                    <th className="table-header-cell">Type</th>
                    <th className="table-header-cell">Staff Count</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Actions</th>
                  </>
                ) : activeTab === 'users' ? (
                  <>
                    <th className="table-header-cell">User</th>
                    <th className="table-header-cell">Role</th>
                    <th className="table-header-cell">Department</th>
                    <th className="table-header-cell">Contact</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Actions</th>
                  </>
                ) : (
                  <>
                    <th className="table-header-cell">Staff Member</th>
                    <th className="table-header-cell">Role</th>
                    <th className="table-header-cell">Department</th>
                    <th className="table-header-cell">Contact</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="table-body">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'departments' ? 5 : 6} className="table-body-cell text-center py-8">
                    <div className="spinner mx-auto"></div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'departments' ? 5 : 6} className="table-body-cell text-center py-8">
                    <div className="text-gray-500">
                      {searchTerm ? `No ${activeTab} found matching your search.` : `No ${activeTab} found.`}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item._id}>
                    {activeTab === 'departments' ? (
                      <>
                        <td className="table-body-cell">
                          <div>
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-500">{item.description}</div>
                          </div>
                        </td>
                        <td className="table-body-cell">
                          <span className={`badge badge-${item.departmentType === 'medical' ? 'success' : 'info'}`}>
                            {item.departmentType}
                          </span>
                        </td>
                        <td className="table-body-cell">
                          <div className="text-sm text-gray-900">{item.staff?.length || 0}</div>
                        </td>
                        <td className="table-body-cell">
                          <span className={`badge ${item.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="table-body-cell">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-primary-600 hover:text-primary-900"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Deactivate"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="table-body-cell">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                              {React.createElement(getRoleIcon(item.role), { className: 'h-5 w-5 text-primary-600' })}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-500">{item.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="table-body-cell">
                          <span className={`badge badge-info`}>
                            {item.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="table-body-cell">
                          <div className="text-sm text-gray-900">
                            {item.departmentId?.name || 'N/A'}
                          </div>
                        </td>
                        <td className="table-body-cell">
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="h-4 w-4 mr-1" />
                            {item.phone}
                          </div>
                        </td>
                        <td className="table-body-cell">
                          <span className={`badge ${item.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="table-body-cell">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-primary-600 hover:text-primary-900"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Deactivate"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
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

export default HospitalAdminDashboard;
