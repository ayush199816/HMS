import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatTimeIST } from '../utils/dateUtils';
import { User, Clock, Calendar, ArrowLeft, AlertCircle } from 'lucide-react';

const Queue = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  const [queueData, setQueueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return istDate.toISOString().split('T')[0];
  });

  const fetchQueueData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments', {
        params: {
          date: selectedDate,
          status: 'scheduled'
        }
      });

      // Group appointments by doctor
      const groupedByDoctor = response.data.appointments.reduce((acc, appointment) => {
        const doctorId = appointment.doctorId?._id || 'unassigned';
        if (!acc[doctorId]) {
          acc[doctorId] = {
            doctor: appointment.doctorId,
            appointments: []
          };
        }
        acc[doctorId].appointments.push(appointment);
        return acc;
      }, {});

      // Convert to array and sort by doctor name
      const queueArray = Object.values(groupedByDoctor).map(group => ({
        ...group,
        appointments: group.appointments.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0))
      })).sort((a, b) => {
        if (!a.doctor) return 1;
        if (!b.doctor) return -1;
        return a.doctor.name.localeCompare(b.doctor.name);
      });

      setQueueData(queueArray);
    } catch (error) {
      console.error('Error fetching queue data:', error);
      setError('Failed to load queue data');
    } finally {
      setLoading(false);
    }
  }, [api, selectedDate]);

  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/receptionist/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Doctor Queue</h1>
            <p className="text-gray-600 text-sm">View scheduled appointments by doctor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="form-input text-sm"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-danger flex items-center mb-4">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
        </div>
      )}

      {/* Queue Display */}
      {!loading && queueData.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-gray-500">No scheduled appointments found for this date</div>
        </div>
      )}

      {!loading && queueData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {queueData.map((queue, index) => (
            <div key={index} className="card">
              <div className="card-header p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {queue.doctor?.name || 'Unassigned'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {queue.appointments.length} patient{queue.appointments.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {queue.appointments.map((appointment, apptIndex) => (
                    <div
                      key={appointment._id}
                      className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 font-bold text-sm">
                            {appointment.queueNumber || apptIndex + 1}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {appointment.patientId?.name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTimeIST(appointment.appointmentDate)}
                        </div>
                      </div>
                      <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Queue;
