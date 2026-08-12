import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';

const Login = () => {
  const { login, loading, error } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const result = await login(formData.email, formData.password);
    if (!result.success) {
      setFormError(result.error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)' }}>
      <div style={{ width: '100%', maxWidth: '320px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ margin: '0 auto', height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: '#dbeafe', marginBottom: '8px' }}>
              <Building style={{ height: '20px', width: '20px', color: '#2563eb' }} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
              Hospital Management System
            </h2>
            <p style={{ fontSize: '12px', color: '#4b5563' }}>
              Sign in to your account
            </p>
          </div>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} onSubmit={handleSubmit}>
            {(formError || error) && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                <AlertCircle style={{ height: '16px', width: '16px', marginRight: '8px', flexShrink: 0 }} />
                <span>{formError || error}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', height: '16px', width: '16px', color: '#9ca3af' }} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    style={{ width: '100%', paddingTop: '8px', paddingBottom: '8px', paddingLeft: '40px', paddingRight: '16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', height: '16px', width: '16px', color: '#9ca3af' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    style={{ width: '100%', paddingTop: '8px', paddingBottom: '8px', paddingLeft: '40px', paddingRight: '40px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                  >
                    {showPassword ? <EyeOff style={{ height: '16px', width: '16px' }} /> : <Eye style={{ height: '16px', width: '16px' }} />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', backgroundColor: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '500', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ animation: 'spin 1s linear infinite', height: '16px', width: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', marginRight: '8px' }}></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
