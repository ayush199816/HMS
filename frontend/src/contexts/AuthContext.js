import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth context
const AuthContext = createContext();

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: {
          ...action.payload.user,
          hospitalId: action.payload.user.hospitalId?._id || action.payload.user.hospitalId,
          departmentId: action.payload.user.departmentId?._id || action.payload.user.departmentId,
        },
        token: action.payload.token,
        loading: false,
        error: null,
        isAuthenticated: true,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: null,
        isAuthenticated: false,
      };
    case 'SET_USER':
      return {
        ...state,
        user: {
          ...action.payload,
          hospitalId: action.payload.hospitalId?._id || action.payload.hospitalId,
          departmentId: action.payload.departmentId?._id || action.payload.departmentId,
        },
        loading: false,
        isAuthenticated: true,
      };
    case 'AUTH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    default:
      return state;
  }
};

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  loading: true,
  error: null,
  isAuthenticated: false,
};

// Auth provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          const response = await api.get('/auth/me');
          const currentUser = response.data.user;
          
          // Check if the stored user matches the current user from API
          const parsedStoredUser = JSON.parse(storedUser);
          if (parsedStoredUser.email !== currentUser.email) {
            // User has changed, clear everything and reload
            console.log('User changed detected, clearing auth state');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            dispatch({ type: 'LOGOUT' });
            window.location.href = '/login';
            return;
          }
          
          dispatch({
            type: 'SET_USER',
            payload: currentUser,
          });
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          dispatch({
            type: 'AUTH_ERROR',
            payload: 'Session expired',
          });
        }
      } else {
        dispatch({
          type: 'AUTH_ERROR',
          payload: null,
        });
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      const response = await api.post('/auth/login', { email, password });
      
      const { token, user } = response.data;
      
      // Clear any existing auth data first
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
      
      // Store new auth data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('lastActiveUser', user.email);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token, user },
      });
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: message,
      });
      return { success: false, error: message };
    }
  };

  // Logout function
  const logout = () => {
    // Clear all auth data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear any other potential cached data
    localStorage.removeItem('lastActiveUser');
    sessionStorage.clear();
    
    // Dispatch logout action
    dispatch({ type: 'LOGOUT' });
    
    // Force redirect to login page
    window.location.href = '/login';
  };

  // Create super admin function
  const createSuperAdmin = async (adminData) => {
    try {
      const response = await api.post('/auth/create-super-admin', adminData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token, user },
      });
      
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create super admin';
      return { success: false, error: message };
    }
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to change password';
      return { success: false, error: message };
    }
  };

  const value = {
    ...state,
    login,
    logout,
    createSuperAdmin,
    changePassword,
    api,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
