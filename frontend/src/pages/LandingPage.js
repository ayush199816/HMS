import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogIn,
  Activity,
  Stethoscope,
  Shield,
  Users,
  Calendar,
  FileText,
  CreditCard,
  ArrowRight,
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  const container = { maxWidth: 1280, margin: '0 auto', padding: '0 1rem' };

  const features = [
    { Icon: Users, title: 'Patient Management', description: 'Centralize patient records, history, and demographics in one secure place.' },
    { Icon: Calendar, title: 'Appointments & OPD', description: 'Schedule, track, and manage appointments with an intuitive calendar.' },
    { Icon: Stethoscope, title: 'Radiology & Pathology', description: 'Order tests, upload reports, and review diagnostics seamlessly.' },
    { Icon: CreditCard, title: 'Billing & Accounts', description: 'Generate invoices, manage payments, and keep accounts in order.' },
    { Icon: FileText, title: 'Admissions & Wards', description: 'Track bed occupancy, admissions, and discharges in real time.' },
    { Icon: Shield, title: 'Secure & Compliant', description: 'Role-based access and audit trails keep patient data protected.' },
  ];

  const stats = [
    { value: '10K+', label: 'Patients managed' },
    { value: '50+', label: 'Hospitals trust us' },
    { value: '99.9%', label: 'Uptime' },
    { value: '24/7', label: 'Support' },
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <nav className="bg-white border-b" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="flex items-center justify-between py-4" style={container}>
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <div className="inline-flex items-center justify-center p-2 rounded-lg" style={{ backgroundColor: '#2563eb' }}>
              <Activity className="icon text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Carewave360</h1>
          </div>
          <button onClick={() => navigate('/login')} className="btn-primary flex items-center" style={{ gap: '0.5rem' }}>
            <LogIn className="icon-sm" />
            Login
          </button>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gray-50" style={{ padding: '5rem 0' }}>
          <div className="text-center" style={container}>
            <div className="inline-flex items-center mb-6" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '0.375rem 1rem', borderRadius: 9999, gap: '0.5rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563eb' }}></span>
              Healthcare Management Simplified
            </div>
            <h2 className="font-bold text-gray-900" style={{ fontSize: '2.5rem', lineHeight: 1.2, marginBottom: '1.5rem' }}>
              Run your hospital with <span style={{ color: '#2563eb' }}>confidence.</span>
            </h2>
            <p className="text-lg text-gray-600" style={{ maxWidth: 650, margin: '0 auto 2rem' }}>
              One unified platform for patients, appointments, billing, diagnostics, and admissions. Built for modern healthcare teams.
            </p>
            <div className="flex items-center justify-center" style={{ gap: '1rem' }}>
              <button onClick={() => navigate('/login')} className="btn-primary flex items-center" style={{ fontSize: '1.125rem', padding: '0.75rem 2rem', gap: '0.5rem' }}>
                Get Started
                <ArrowRight className="icon" />
              </button>
              <button onClick={() => navigate('/login')} className="font-medium text-gray-700" style={{ padding: '0.75rem 1.5rem' }}>
                View demo
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-white border-b border-t" style={{ padding: '3rem 0' }}>
          <div style={container}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '2rem', textAlign: 'center' }}>
              {stats.map((stat, idx) => (
                <div key={idx}>
                  <div className="font-bold" style={{ fontSize: '1.875rem', color: '#2563eb' }}>{stat.value}</div>
                  <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-white" style={{ padding: '5rem 0' }}>
          <div className="text-center" style={container}>
            <h3 className="font-bold text-gray-900" style={{ fontSize: '1.875rem', marginBottom: '1rem' }}>
              Everything your hospital needs
            </h3>
            <p className="text-lg text-gray-600" style={{ maxWidth: 650, margin: '0 auto 3rem' }}>
              Streamline operations across every department with powerful, easy-to-use modules.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
              {features.map((feature, idx) => (
                <div key={idx} className="card" style={{ marginBottom: 0 }}>
                  <div className="inline-flex items-center justify-center p-4 bg-primary-100 rounded-full mb-4">
                    <feature.Icon className="icon text-primary-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{feature.title}</h4>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ backgroundColor: '#2563eb', color: 'white', padding: '5rem 0' }}>
          <div className="text-center" style={container}>
            <h3 className="font-bold" style={{ fontSize: '1.875rem', marginBottom: '1rem' }}>
              Ready to transform your hospital operations?
            </h3>
            <p className="text-lg" style={{ color: '#dbeafe', marginBottom: '2rem' }}>
              Join the healthcare teams that rely on Carewave360 every day.
            </p>
            <button onClick={() => navigate('/login')} className="btn flex items-center" style={{ backgroundColor: 'white', color: '#2563eb', fontWeight: 600, fontSize: '1.125rem', padding: '0.75rem 2rem', gap: '0.5rem' }}>
              Start now
              <ArrowRight className="icon" />
            </button>
          </div>
        </section>
      </main>

      <footer style={{ backgroundColor: '#111827', color: '#9ca3af', padding: '3rem 0' }}>
        <div style={container}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            <div>
              <div className="flex items-center mb-4" style={{ gap: '0.5rem' }}>
                <Activity className="icon" style={{ color: '#3b82f6' }} />
                <span className="text-xl font-bold" style={{ color: 'white' }}>Carewave360</span>
              </div>
              <p className="text-sm">
                Modern healthcare management for hospitals, clinics, and diagnostic centers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold" style={{ color: 'white', marginBottom: '0.75rem' }}>Modules</h4>
              <ul className="text-sm" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>Patient Management</li>
                <li>Appointments</li>
                <li>Billing & Accounts</li>
                <li>Radiology & Pathology</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold" style={{ color: 'white', marginBottom: '0.75rem' }}>Support</h4>
              <ul className="text-sm" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>Help Center</li>
                <li>Contact Us</li>
                <li>Privacy Policy</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 text-center text-sm" style={{ borderColor: '#374151', paddingTop: '1.5rem' }}>
            © 2026 Carewave360. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
