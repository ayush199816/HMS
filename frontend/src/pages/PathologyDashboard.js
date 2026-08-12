import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST } from '../utils/dateUtils';
import { 
  TestTube, 
  Users, 
  FileText, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  DollarSign,
  Search,
  Filter,
  Download,
  Upload,
  Eye
} from 'lucide-react';

const PathologyDashboard = () => {
  const { api, user } = useAuth();
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);

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
  const handleSampleCollection = async (bookingId, collectionData) => {
    try {
      await api.put(`/pathology-bookings/${bookingId}/sample-collection`, collectionData);
      fetchBookings();
      fetchStats();
      setShowSampleModal(false);
      setSelectedBooking(null);
    } catch (error) {
      console.error('Error updating sample collection:', error);
    }
  };

  // Handle report upload
  const handleReportUpload = async (bookingId, testId, reportData) => {
    try {
      await api.post(`/pathology-bookings/${bookingId}/reports/${testId}`, reportData);
      fetchBookings();
      fetchStats();
      setShowReportModal(false);
      setSelectedBooking(null);
    } catch (error) {
      console.error('Error uploading report:', error);
    }
  };

  // Handle report status update
  const handleReportStatusUpdate = async (bookingId, testId, status) => {
    try {
      await api.put(`/pathology-bookings/${bookingId}/reports/${testId}/status`, { status });
      fetchBookings();
      fetchStats();
    } catch (error) {
      console.error('Error updating report status:', error);
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
        <h1 className="text-2xl font-bold text-gray-900">Pathology Lab Dashboard</h1>
        <p className="text-gray-600">Manage pathology tests and reports</p>
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
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowSampleModal(true);
                              }}
                              className="btn btn-sm btn-primary"
                            >
                              <TestTube className="h-3 w-3 mr-1" />
                              Collect
                            </button>
                          )}
                          
                          {booking.sampleCollection?.isCollected && (
                            <button
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowReportModal(true);
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

      {/* Sample Collection Modal */}
      {showSampleModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sample Collection</h3>
              <button
                onClick={() => setShowSampleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Patient: <span className="font-medium">{selectedBooking.patientId?.name}</span></p>
                <p className="text-sm text-gray-600">Tests: <span className="font-medium">{selectedBooking.tests?.length}</span></p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                handleSampleCollection(selectedBooking._id, {
                  isCollected: true,
                  collectedDate: new Date().toISOString(),
                  collectionNotes: e.target.collectionNotes?.value
                });
              }}>
                <div>
                  <label className="form-label">Collection Notes</label>
                  <textarea
                    name="collectionNotes"
                    className="form-input"
                    rows="3"
                    placeholder="Add any notes about sample collection..."
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowSampleModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Mark as Collected
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Report Upload Modal */}
      {showReportModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Reports</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Patient: <span className="font-medium">{selectedBooking.patientId?.name}</span></p>
              </div>

              <div className="space-y-3">
                {selectedBooking.reports?.map((report, index) => (
                  <div key={report.testId._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{report.testId.name}</h4>
                      <span className={`badge badge-${getReportStatusBadgeColor(report.status)}`}>
                        {report.status?.toUpperCase()}
                      </span>
                    </div>

                    {report.status !== 'completed' && (
                      <div className="space-y-2">
                        <div>
                          <label className="form-label">Normal Values</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter normal range..."
                          />
                        </div>
                        <div>
                          <label className="form-label">Patient Values</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter patient values..."
                          />
                        </div>
                        <div>
                          <label className="form-label">Remarks</label>
                          <textarea
                            className="form-input"
                            rows="2"
                            placeholder="Add remarks..."
                          />
                        </div>
                        <div>
                          <label className="form-label">Upload Report</label>
                          <input
                            type="file"
                            className="form-input"
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleReportStatusUpdate(selectedBooking._id, report.testId._id, 'in_progress')}
                            className="btn btn-sm btn-secondary"
                          >
                            Mark In Progress
                          </button>
                          <button
                            onClick={() => handleReportStatusUpdate(selectedBooking._id, report.testId._id, 'completed')}
                            className="btn btn-sm btn-primary"
                          >
                            Mark Complete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PathologyDashboard;
