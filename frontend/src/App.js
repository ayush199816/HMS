import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import HospitalAdminDashboard from './pages/HospitalAdminDashboard';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import NurseDashboard from './pages/NurseDashboard';
import BillingDashboard from './pages/BillingDashboard';
import BillDetailsPage from './pages/BillDetailsPage';
import AdmissionBillingPage from './pages/AdmissionBillingPage';
import PatientVitals from './pages/PatientVitals';
import PathologyLabDashboard from './pages/PathologyLabDashboard';
import PathologyTestManagement from './pages/PathologyTestManagement';
import PathologyTestBooking from './pages/PathologyTestBooking';
import RadiologyDashboard from './pages/RadiologyDashboard';
import RadiologyTestManagement from './pages/RadiologyTestManagement';
import RadiologyTestBooking from './pages/RadiologyTestBooking';
import RadiologyBookingDetail from './pages/RadiologyBookingDetail';
import ConsultationPage from './pages/ConsultationPage';
import AccountsPage from './pages/AccountsPage';
import StatementPage from './pages/StatementPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailsPage from './pages/PatientDetailsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import Queue from './pages/Queue';
import AdmissionForm from './pages/AdmissionForm';
import AdmissionsList from './pages/AdmissionsList';
import BedManagement from './pages/BedManagement';
import Layout from './components/Layout';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const getDashboard = () => {
    console.log('Frontend: User role:', user.role);
    console.log('Frontend: User data:', user);

    switch (user.role) {
      case 'super_admin':
        return <SuperAdminDashboard />;
      case 'hospital_admin':
        return <HospitalAdminDashboard />;
      case 'receptionist':
        return <ReceptionistDashboard />;
      case 'doctor':
        return <DoctorDashboard />;
      case 'nurse':
        return <NurseDashboard />;
      case 'billing_staff':
        return <BillingDashboard />;
      case 'accounts':
        return <BillingDashboard />;
      case 'pathologist':
        return <PathologyLabDashboard />;
      case 'diagnostic':
        return <RadiologyDashboard />;
      default:
        console.log('Frontend: Unknown role, redirecting to login');
        return <Navigate to="/login" replace />;
    }
  };

  return (
    <Layout>
      <Routes>
        <Route path="/" element={getDashboard()} />
        <Route path="/dashboard" element={getDashboard()} />
        <Route path="/receptionist/dashboard" element={<ReceptionistDashboard />} />
        <Route path="/receptionist/patients" element={<PatientsPage />} />
        <Route path="/receptionist/patients/:id" element={<PatientDetailsPage />} />
        <Route path="/receptionist/appointments" element={<AppointmentsPage />} />
        <Route path="/receptionist/queue" element={<Queue />} />
        <Route path="/receptionist/admission" element={<AdmissionsList />} />
        <Route path="/receptionist/admission/new" element={<AdmissionForm />} />
        <Route path="/hospital-admin/billing-dashboard" element={<BillingDashboard />} />
        <Route path="/hospital-admin/nurse-dashboard" element={<NurseDashboard />} />
        <Route path="/hospital-admin/bed-management" element={<BedManagement />} />
        <Route path="/nurse/vitals/:admissionId" element={<PatientVitals />} />
        <Route path="/doctor/consultation/:appointmentId" element={<ConsultationPage />} />
        <Route path="/billing/bill/:billId" element={<BillDetailsPage />} />
        <Route path="/billing/admission/:admissionId" element={<AdmissionBillingPage />} />
        <Route path="/pathology/test-management" element={<PathologyTestManagement />} />
        <Route path="/pathology/test-booking" element={<PathologyTestBooking />} />
        <Route path="/radiology/test-management" element={<RadiologyTestManagement />} />
        <Route path="/radiology/test-booking" element={<RadiologyTestBooking />} />
        <Route path="/radiology/booking/:id" element={<RadiologyBookingDetail />} />
        <Route path="/accounts/purchases" element={<AccountsPage />} />
        <Route path="/accounts/statement" element={<StatementPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
