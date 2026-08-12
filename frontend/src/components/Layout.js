import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  Building, 
  Users, 
  ClipboardList,
  User,
  LogOut,
  Menu,
  X,
  Wallet,
  FileText,
  CreditCard,
  Bed
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getNavigationItems = () => {
    switch (user?.role) {
      case 'super_admin':
        return [
          { name: 'Dashboard', href: '/', icon: Home },
          { name: 'Hospitals', href: '/hospitals', icon: Building },
          { name: 'Accounts', href: '/accounts/purchases', icon: Wallet },
        ];
      case 'hospital_admin':
        return [
          { name: 'Dashboard', href: '/', icon: Home },
          { name: 'Departments', href: '/departments', icon: Building },
          { name: 'Staff', href: '/staff', icon: Users },
          { name: 'Patients', href: '/receptionist/patients', icon: ClipboardList },
          { name: 'Admissions', href: '/receptionist/admission', icon: Bed },
          { name: 'Reception', href: '/receptionist/dashboard', icon: Users },
          { name: 'Billing', href: '/hospital-admin/billing-dashboard', icon: CreditCard },
          { name: 'Accounts & Purchases', href: '/accounts/purchases', icon: Wallet },
          { name: 'Statement', href: '/accounts/statement', icon: FileText },
          { name: 'Nurse', href: '/hospital-admin/nurse-dashboard', icon: User },
        ];
      case 'receptionist':
        return [
          { name: 'Dashboard', href: '/', icon: Home },
          { name: 'Patients', href: '/receptionist/patients', icon: ClipboardList },
          { name: 'Appointments', href: '/receptionist/appointments', icon: Users },
          { name: 'Admissions', href: '/receptionist/admission', icon: Bed },
        ];
      case 'accounts':
        return [
          { name: 'Billing Dashboard', href: '/', icon: CreditCard },
          { name: 'Admissions', href: '/receptionist/admission', icon: Bed },
          { name: 'Accounts & Purchases', href: '/accounts/purchases', icon: Wallet },
          { name: 'Statement', href: '/accounts/statement', icon: FileText },
        ];
      case 'billing_staff':
        return [
          { name: 'Billing Dashboard', href: '/', icon: CreditCard },
          { name: 'Accounts & Purchases', href: '/accounts/purchases', icon: Wallet },
        ];
      case 'doctor':
        return [
          { name: 'Dashboard', href: '/', icon: Home },
          { name: 'My Queue', href: '/doctor/queue', icon: Users },
        ];
      default:
        return [];
    }
  };

  const navigation = getNavigationItems();

  return (
    <div className="layout">
      {/* Mobile sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} mobile-sidebar`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">HMS</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="nav-sidebar">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="nav-sidebar-item"
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </a>
          ))}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="sidebar sidebar-open desktop-sidebar">
        <div className="flex items-center justify-center p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-primary-600">HMS</h1>
        </div>
        <nav className="nav-sidebar">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="nav-sidebar-item"
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </a>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="main-content">
        {/* Top navigation */}
        <nav className="navbar">
          <div className="navbar-content">
            <div className="navbar-left">
              <button
                onClick={() => setSidebarOpen(true)}
                className="mobile-menu-btn lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="navbar-title">
                Hospital Management System
              </h1>
            </div>
            <div className="navbar-right">
              <div className="navbar-user">
                <User className="h-8 w-8 text-gray-400" />
                <div className="navbar-user-info">
                  <p className="navbar-user-name">{user?.name}</p>
                  <p className="navbar-user-role">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="navbar-logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
