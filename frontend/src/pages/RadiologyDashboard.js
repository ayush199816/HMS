import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateIST } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import {
  Activity,
  Calendar,
  Clock,
  CheckCircle,
  Search,
  Upload,
  Eye,
  Package,
  FileText,
  Plus,
  Download
} from 'lucide-react';

const RadiologyDashboard = () => {
  const { api } = useAuth();
  const [stats, setStats] = useState({
    totalBookings: 0,
    todayBookings: 0,
    pendingScans: 0,
    pendingReports: 0,
    completedReports: 0
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scanFilter, setScanFilter] = useState('all');
  const [reportFilter, setReportFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showReportSection, setShowReportSection] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [reportImages, setReportImages] = useState([]);
  const [reportObservation, setReportObservation] = useState('');
  const [reportFindings, setReportFindings] = useState('');
  const [reportImpression, setReportImpression] = useState('');

  // Fetch dashboard statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/radiology-bookings/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [api]);

  // Fetch radiology bookings
  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.get('/radiology-bookings', {
        params: {
          search: searchTerm,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          scanCollected: scanFilter !== 'all' ? scanFilter : undefined,
          reportStatus: reportFilter !== 'all' ? reportFilter : undefined
        }
      });
      setBookings(response.data.bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  }, [api, searchTerm, statusFilter, scanFilter, reportFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchBookings()]).finally(() => setLoading(false));
  }, [fetchStats, fetchBookings]);

  // Handle scan collection
  const handleScanCollection = async (bookingId) => {
    try {
      const response = await api.put(`/radiology-bookings/${bookingId}/scan-collection`, {
        isCollected: true,
        collectedDate: new Date().toISOString(),
        collectionNotes: 'Scan collected'
      });

      console.log('Scan collected successfully:', response.data);
      fetchBookings();
      fetchStats();
      alert('Scan marked as collected successfully!');
    } catch (error) {
      console.error('Error updating scan collection:', error);
      alert('Failed to mark scan as collected. Please try again.');
    }
  };

  // Handle detailed report creation
  const handleDetailedReportCreation = (booking, test) => {
    console.log('Opening detailed report creation for:', { booking, test });
    setSelectedBooking(booking);
    setSelectedTest(test);
    // Pre-populate with existing data if editing a completed report
    if (test.status === 'completed') {
      setReportImages(test.images || []);
      setReportObservation(test.observation || '');
      setReportFindings(test.findings || '');
      setReportImpression(test.impression || '');
    } else {
      setReportImages([]);
      setReportObservation('');
      setReportFindings('');
      setReportImpression('');
    }
    setShowReportSection(true);
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
      const response = await api.get(`/radiology-bookings/${bookingId}/reports/${testId}/download`, {
        responseType: 'blob'
      });

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `radiology_report_${bookingId}_${testId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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

      formData.append('observation', reportObservation);
      formData.append('findings', reportFindings);
      formData.append('impression', reportImpression);

      reportImages.forEach((image) => {
        formData.append('images', image);
      });

      const response = await api.post(
        `/radiology-bookings/${selectedBooking._id}/reports/${selectedTest.testId._id}/detailed`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

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

  const getReportStatusBadgeColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'pending':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Radiology Dashboard</h1>
          <Link
            to="/radiology/test-management"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Manage Tests
          </Link>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
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
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Scans</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingScans}</p>
              </div>
              <Activity className="h-8 w-8 text-yellow-500" />
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
              <Clock className="h-8 w-8 text-orange-500" />
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
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient name or phone..."
                  className="pl-10 pr-4 py-2 w-full border rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <select
              className="px-4 py-2 border rounded-lg"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="booked">Booked</option>
              <option value="scan_collected">Scan Collected</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <select
              className="px-4 py-2 border rounded-lg"
              value={scanFilter}
              onChange={(e) => setScanFilter(e.target.value)}
            >
              <option value="all">All Scans</option>
              <option value="true">Collected</option>
              <option value="false">Not Collected</option>
            </select>
            <select
              className="px-4 py-2 border rounded-lg"
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
            >
              <option value="all">All Reports</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card">
        <div className="card-body">
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No bookings found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Patient</th>
                    <th className="text-left py-3 px-4">Tests</th>
                    <th className="text-left py-3 px-4">Booking Date</th>
                    <th className="text-left py-3 px-4">Scan Status</th>
                    <th className="text-left py-3 px-4">Report Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking._id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{booking.patientId?.name}</p>
                          <p className="text-sm text-gray-600">{booking.patientId?.phone}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {booking.tests?.map((test, index) => (
                            <span key={index} className="badge badge-secondary text-xs">
                              {test.testName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm text-gray-900">{formatDateIST(booking.bookingDate)}</p>
                          <p className="text-sm text-gray-600">{booking.preferredTime}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {booking.scanCollection?.isCollected ? (
                          <span className="badge badge-success">Collected</span>
                        ) : (
                          <span className="badge badge-warning">Not Collected</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {booking.reports?.map((report, index) => (
                            <span key={index} className={`badge badge-${getReportStatusBadgeColor(report.status)} text-xs`}>
                              {report.status?.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {!booking.scanCollection?.isCollected && (
                            <button
                              onClick={() => handleScanCollection(booking._id)}
                              className="btn btn-sm btn-primary"
                            >
                              <Activity className="h-3 w-3 mr-1" />
                              Collect Scan
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (!booking.scanCollection?.isCollected) {
                                alert('Please collect the scan first before creating a report.');
                                return;
                              }
                              console.log('Report button clicked for booking:', booking);
                              setSelectedBooking(booking);
                              // Find first pending report and auto-select it
                              const pendingReport = booking.reports?.find(r => r.status !== 'completed');
                              if (pendingReport) {
                                setSelectedTest(pendingReport);
                                setReportImages([]);
                                setReportObservation('');
                                setReportFindings('');
                                setReportImpression('');
                              }
                              setShowReportSection(true);
                            }}
                            className="btn btn-sm btn-secondary"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Report
                          </button>

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

                {viewingReport.findings && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Findings</h4>
                    <p className="text-sm bg-gray-50 p-4 rounded-lg">{viewingReport.findings}</p>
                  </div>
                )}

                {viewingReport.observation && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Observation</h4>
                    <p className="text-sm bg-gray-50 p-4 rounded-lg">{viewingReport.observation}</p>
                  </div>
                )}

                {viewingReport.impression && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Impression</h4>
                    <p className="text-sm bg-gray-50 p-4 rounded-lg">{viewingReport.impression}</p>
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
                              <button
                                onClick={() => handleDetailedReportCreation(selectedBooking, report)}
                                className="btn btn-sm btn-primary"
                                title="Edit Report"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Edit
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
                        <span className="text-gray-600">Test:</span>
                        <span className="ml-2 font-medium">{selectedTest.testId.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Category:</span>
                        <span className="ml-2 font-medium">{selectedTest.testId.category}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Body Part:</span>
                        <span className="ml-2 font-medium">{selectedTest.testId.bodyPart}</span>
                      </div>
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Upload Scan Images</h4>
                    <div className="space-y-3">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full"
                      />
                      {reportImages.length > 0 && (
                        <div className="grid grid-cols-4 gap-3">
                          {reportImages.map((image, index) => (
                            <div key={index} className="relative">
                              <img
                                src={typeof image === 'string' ? image : URL.createObjectURL(image)}
                                alt={`Preview ${index + 1}`}
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

                  {/* Findings */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Findings</h4>
                    <textarea
                      className="w-full border rounded-lg p-3"
                      rows="4"
                      placeholder="Enter findings..."
                      value={reportFindings}
                      onChange={(e) => setReportFindings(e.target.value)}
                    />
                  </div>

                  {/* Observation */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Observation</h4>
                    <textarea
                      className="w-full border rounded-lg p-3"
                      rows="4"
                      placeholder="Enter observation..."
                      value={reportObservation}
                      onChange={(e) => setReportObservation(e.target.value)}
                    />
                  </div>

                  {/* Impression */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Impression</h4>
                    <textarea
                      className="w-full border rounded-lg p-3"
                      rows="4"
                      placeholder="Enter impression..."
                      value={reportImpression}
                      onChange={(e) => setReportImpression(e.target.value)}
                    />
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
                      disabled={reportImages.length === 0}
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
    </>
  );
};

export default RadiologyDashboard;
