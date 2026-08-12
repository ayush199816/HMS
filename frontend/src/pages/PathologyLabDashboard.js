import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import {
  TestTube,
  Calendar,
  Clock,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Search,
  Upload,
  Eye,
  Package,
  FileText,
  Plus,
  Download
} from 'lucide-react';

const PathologyLabDashboard = () => {
  const { api } = useAuth();
  const [stats, setStats] = useState({
    totalBookings: 0,
    todayBookings: 0,
    pendingSamples: 0,
    pendingReports: 0,
    completedReports: 0,
    totalRevenue: 0
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sampleFilter, setSampleFilter] = useState('all');
  const [reportFilter, setReportFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showReportSection, setShowReportSection] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [reportComponents, setReportComponents] = useState([]);
  const [reportImages, setReportImages] = useState([]);
  const [reportOutcome, setReportOutcome] = useState('');
  const [reportNotes, setReportNotes] = useState('');

  // Fetch dashboard statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/pathology-bookings/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [api]);

  // Fetch pathology bookings
  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.get('/pathology-bookings', {
        params: {
          search: searchTerm,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          sampleCollected: sampleFilter !== 'all' ? sampleFilter : undefined,
          reportStatus: reportFilter !== 'all' ? reportFilter : undefined
        }
      });
      setBookings(response.data.bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  }, [api, searchTerm, statusFilter, sampleFilter, reportFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchBookings()]).finally(() => setLoading(false));
  }, [fetchStats, fetchBookings]);

  // Handle sample collection
  const handleSampleCollection = async (bookingId) => {
    try {
      const response = await api.put(`/pathology-bookings/${bookingId}/sample-collection`, {
        isCollected: true,
        collectedDate: new Date().toISOString(),
        collectionNotes: 'Sample collected'
      });
      
      console.log('Sample collected successfully:', response.data);
      fetchBookings();
      fetchStats();
      alert('Sample marked as collected successfully!');
    } catch (error) {
      console.error('Error updating sample collection:', error);
      alert('Failed to mark sample as collected. Please try again.');
    }
  };

  
  
  // Handle detailed report creation
  const handleDetailedReportCreation = (booking, test) => {
    console.log('Opening detailed report creation for:', { booking, test });
    setSelectedBooking(booking);
    setSelectedTest(test);
    setReportComponents([]);
    setReportImages([]);
    setReportOutcome('');
    setReportNotes('');
    setShowReportSection(true);
  };

  // Add report component
  const addReportComponent = () => {
    setReportComponents([...reportComponents, {
      id: Date.now(),
      name: '',
      patientLevel: '',
      genericRange: '',
      description: '',
      level: 'normal',
      unit: ''
    }]);
  };

  // Update report component
  const updateReportComponent = (id, field, value) => {
    setReportComponents(reportComponents.map(comp => 
      comp.id === id ? { ...comp, [field]: value } : comp
    ));
  };

  // Remove report component
  const removeReportComponent = (id) => {
    setReportComponents(reportComponents.filter(comp => comp.id !== id));
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setReportImages([...reportImages, ...files]);
  };

  // Remove image
  const removeImage = (index) => {
    setReportImages(reportImages.filter((_, i) => i !== index));
  };

  // Handle report download
  const handleReportDownload = async (bookingId, testId) => {
    try {
      const response = await api.get(`/pathology-bookings/${bookingId}/reports/${testId}/download`);

      if (response.data.type === 'image' || response.data.type === 'url') {
        // Download image/PDF
        const link = document.createElement('a');
        link.href = response.data.url;
        link.download = response.data.fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (response.data.type === 'text') {
        // Download text file
        const blob = new Blob([response.data.content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = response.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    }
  };

  // Handle report view
  const handleReportView = (report) => {
    setViewingReport(report);
  };

  // Submit detailed report
  const submitDetailedReport = async () => {
    try {
      const formData = new FormData();

      // Add report data
      formData.append('components', JSON.stringify(reportComponents));
      formData.append('outcome', reportOutcome);
      formData.append('notes', reportNotes);

      // Add images
      reportImages.forEach((image, index) => {
        formData.append(`images`, image);
      });

      const response = await api.post(`/pathology-bookings/${selectedBooking._id}/reports/${selectedTest.testId._id}/detailed`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Detailed report submitted successfully:', response.data);
      fetchBookings();
      fetchStats();
      setShowReportSection(false);
      setSelectedBooking(null);
      setSelectedTest(null);
      alert('Detailed report submitted successfully!');
    } catch (error) {
      console.error('Error submitting detailed report:', error);
      alert('Failed to submit detailed report. Please try again.');
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'booked': return 'info';
      case 'sample_collected': return 'warning';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'gray';
    }
  };

  // Get report status badge color
  const getReportStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'ready': return 'info';
      default: return 'gray';
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
            <h1 className="text-2xl font-bold text-gray-900">Pathology Lab Dashboard</h1>
            <p className="text-gray-600">Manage pathology tests and reports</p>
          </div>
          <Link
            to="/pathology/test-management"
            className="btn btn-secondary"
          >
            <Package className="h-4 w-4 mr-2" />
            Manage Tests
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayBookings}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Samples</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingSamples}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <TestTube className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Reports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingReports}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Reports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedReports}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">₹{stats.totalRevenue}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Pathology Bookings</h2>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-48"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">All Status</option>
              <option value="booked">Booked</option>
              <option value="sample_collected">Sample Collected</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={sampleFilter}
              onChange={(e) => setSampleFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">All Samples</option>
              <option value="true">Collected</option>
              <option value="false">Pending</option>
            </select>

            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">All Reports</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div className="card-body">
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No bookings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sample
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reports
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {booking.patientId?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {booking.patientId?.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {booking.tests?.length} test(s)
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.tests?.map(test => test.testName).join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateIST(booking.bookingDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge badge-${getStatusBadgeColor(booking.status)}`}>
                          {booking.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.sampleCollection?.isCollected ? (
                          <span className="badge badge-success">Collected</span>
                        ) : (
                          <span className="badge badge-warning">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {booking.reports?.filter(r => r.status === 'completed').length}/{booking.reports?.length}
                        </div>
                        <div className="text-sm text-gray-500">
                          Ready
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{booking.finalAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {!booking.sampleCollection?.isCollected && (
                            <button
                              onClick={() => handleSampleCollection(booking._id)}
                              className="btn btn-sm btn-primary"
                            >
                              <TestTube className="h-3 w-3 mr-1" />
                              Collect
                            </button>
                          )}
                          
                          {booking.sampleCollection?.isCollected && (
                            <button
                              onClick={() => {
                                console.log('Report button clicked for booking:', booking);
                                setSelectedBooking(booking);
                                setShowReportSection(true);
                              }}
                              className="btn btn-sm btn-secondary"
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Report
                            </button>
                          )}
                          
                          <button className="btn btn-sm btn-gray">
                            <Eye className="h-3 w-3 mr-1" />
                            View
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

      {/* Report Section - Inline */}
      {showReportSection && selectedBooking && (
        <div className="card mt-6">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Reports</h3>
              <button
                onClick={() => {
                  setShowReportSection(false);
                  setSelectedBooking(null);
                  setSelectedTest(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
          <div className="card-body">
            {viewingReport ? (
              // View report details
              <div className="space-y-6">
                <button
                  onClick={() => setViewingReport(null)}
                  className="btn btn-sm btn-secondary mb-4"
                >
                  ← Back to Tests
                </button>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Report Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Patient:</span>
                      <span className="ml-2 font-medium">{selectedBooking.patientId?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Test:</span>
                      <span className="ml-2 font-medium">{viewingReport.testId?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2 font-medium">{viewingReport.status?.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Report Date:</span>
                      <span className="ml-2 font-medium">{viewingReport.reportDate ? formatDateIST(viewingReport.reportDate) : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {viewingReport.components && viewingReport.components.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Test Components</h4>
                    <div className="space-y-3">
                      {viewingReport.components.map((component, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-900">{component.name}</h5>
                            <span className={`badge badge-${component.level === 'normal' ? 'success' : 'warning'}`}>
                              {component.level}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Patient Level:</span>
                              <span className="ml-2 font-medium">{component.patientLevel}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Generic Range:</span>
                              <span className="ml-2 font-medium">{component.genericRange}</span>
                            </div>
                            {component.unit && (
                              <div>
                                <span className="text-gray-600">Unit:</span>
                                <span className="ml-2 font-medium">{component.unit}</span>
                              </div>
                            )}
                          </div>
                          {component.description && (
                            <div className="mt-2 text-sm">
                              <span className="text-gray-600">Description:</span>
                              <p className="mt-1">{component.description}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingReport.images && viewingReport.images.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Report Images</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {viewingReport.images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image.url}
                            alt={`Report ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border cursor-pointer"
                            onClick={() => window.open(image.url, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingReport.outcome && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Overall Assessment</h4>
                    <p className="text-sm bg-gray-50 p-4 rounded-lg">{viewingReport.outcome}</p>
                  </div>
                )}

                {viewingReport.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Additional Notes</h4>
                    <p className="text-sm bg-gray-50 p-4 rounded-lg">{viewingReport.notes}</p>
                  </div>
                )}
              </div>
            ) : !selectedTest ? (
              // Show list of tests for the booking
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Patient: <span className="font-medium">{selectedBooking.patientId?.name}</span></p>
                </div>

                <div className="space-y-3">
                  {selectedBooking.reports?.map((report, index) => (
                    <div key={report.testId._id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{report.testId.name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`badge badge-${getReportStatusBadgeColor(report.status)}`}>
                            {report.status?.toUpperCase()}
                          </span>
                          {report.status === 'completed' && (
                            <>
                              <button
                                onClick={() => handleReportView(report)}
                                className="btn btn-sm btn-secondary"
                                title="View Report"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </button>
                              <button
                                onClick={() => handleReportDownload(selectedBooking._id, report.testId._id)}
                                className="btn btn-sm btn-secondary"
                                title="Download Report"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </button>
                            </>
                          )}
                          {report.status !== 'completed' && (
                            <button
                              onClick={() => handleDetailedReportCreation(selectedBooking, report)}
                              className="btn btn-sm btn-primary"
                              title="Create Detailed Report"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Create Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Show detailed report creation form
              <>
                <button
                  onClick={() => setSelectedTest(null)}
                  className="btn btn-sm btn-secondary mb-4"
                >
                  ← Back to Tests
                </button>

                <div className="space-y-6">
                  {/* Test Information */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Test Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Patient:</span>
                        <span className="ml-2 font-medium">{selectedBooking.patientId?.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Test:</span>
                        <span className="ml-2 font-medium">{selectedTest.testId?.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Test Components */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Test Components</h4>
                      <button
                        onClick={addReportComponent}
                        className="btn btn-sm btn-primary"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Component
                      </button>
                    </div>

                    <div className="space-y-3">
                    {reportComponents.map((component, index) => (
                      <div key={component.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900">Component {index + 1}</h5>
                          <button
                            onClick={() => removeReportComponent(component.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="form-label">Component Name *</label>
                            <input
                              type="text"
                              value={component.name}
                              onChange={(e) => updateReportComponent(component.id, 'name', e.target.value)}
                              className="form-input"
                              placeholder="e.g., Hemoglobin, WBC Count"
                            />
                          </div>
                          <div>
                            <label className="form-label">Unit</label>
                            <input
                              type="text"
                              value={component.unit}
                              onChange={(e) => updateReportComponent(component.id, 'unit', e.target.value)}
                              className="form-input"
                              placeholder="e.g., g/dL, cells/μL"
                            />
                          </div>
                          <div>
                            <label className="form-label">Generic Range *</label>
                            <input
                              type="text"
                              value={component.genericRange}
                              onChange={(e) => updateReportComponent(component.id, 'genericRange', e.target.value)}
                              className="form-input"
                              placeholder="e.g., 12-16 g/dL"
                            />
                          </div>
                          <div>
                            <label className="form-label">Patient Level *</label>
                            <input
                              type="text"
                              value={component.patientLevel}
                              onChange={(e) => updateReportComponent(component.id, 'patientLevel', e.target.value)}
                              className="form-input"
                              placeholder="e.g., 14.5 g/dL"
                            />
                          </div>
                          <div>
                            <label className="form-label">Level Indicator *</label>
                            <select
                              value={component.level}
                              onChange={(e) => updateReportComponent(component.id, 'level', e.target.value)}
                              className="form-input"
                            >
                              <option value="normal">Normal</option>
                              <option value="low">Low</option>
                              <option value="medium_low">Medium Low</option>
                              <option value="medium">Medium</option>
                              <option value="medium_high">Medium High</option>
                              <option value="high">High</option>
                              <option value="risky">Risky</option>
                              <option value="below_range">Below Range</option>
                              <option value="above_range">Above Range</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="form-label">Description</label>
                            <textarea
                              value={component.description}
                              onChange={(e) => updateReportComponent(component.id, 'description', e.target.value)}
                              className="form-input"
                              rows="2"
                              placeholder="Add description for this component..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Upload Images (Optional)</h4>
                  <div className="space-y-3">
                    <div>
                      <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.gif"
                        onChange={handleImageUpload}
                        className="form-input"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Upload multiple images (slides, microscope views, etc.)
                      </p>
                    </div>

                    {reportImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {reportImages.map((image, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(image)}
                              alt={`Upload ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Outcome and Notes */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Report Outcome</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Overall Assessment *</label>
                      <textarea
                        value={reportOutcome}
                        onChange={(e) => setReportOutcome(e.target.value)}
                        className="form-input"
                        rows="3"
                        placeholder="Provide overall assessment and interpretation of results..."
                      />
                    </div>
                    <div>
                      <label className="form-label">Additional Notes</label>
                      <textarea
                        value={reportNotes}
                        onChange={(e) => setReportNotes(e.target.value)}
                        className="form-input"
                        rows="2"
                        placeholder="Any additional notes or recommendations..."
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setSelectedTest(null);
                      setShowReportSection(false);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDetailedReport}
                    disabled={reportComponents.length === 0 || !reportOutcome}
                    className="btn-primary"
                  >
                    Submit Report
                  </button>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PathologyLabDashboard;
