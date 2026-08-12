# Hospital Management System (HMS)

A comprehensive Hospital Management System built with the MERN stack (MongoDB, Express.js, React, Node.js) and deployed on Vercel.

## Features

### Multi-Role System
- **Super Admin**: Creates hospitals and hospital admins
- **Hospital Admin**: Manages departments and staff
- **Receptionist**: Manages patient registration and billing
- **Doctors, Nurses, Pathologists, Pharmacists, Billing Staff**: Various medical roles

### Core Functionality

#### Patient Management
- OPD and Emergency patient registration
- Complete patient profiles with medical history
- Doctor assignment and consultation tracking
- Patient status management (registered, in consultation, treatment complete, discharged)

#### Billing System
- Automated bill generation
- Multiple payment methods (Cash, UPI, Card, Online)
- UTR number tracking for payments
- Real-time payment status updates
- Patient billing history

#### Staff Management
- Comprehensive staff profiles with specializations
- Doctor-specific features (fees, commission, specialities)
- Department-based organization
- Role-based access control

#### Hospital Administration
- Hospital creation and management
- Department setup and categorization
- Staff assignment to departments
- Hospital statistics and reporting

## Technology Stack

### Frontend
- React 18
- React Router for navigation
- Tailwind CSS for styling
- Lucide React for icons
- Axios for API communication

### Backend
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JWT for authentication
- bcryptjs for password hashing
- Express validation for input validation

### Deployment
- Vercel for frontend and serverless functions
- MongoDB Atlas for database

## Installation and Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hospital-management-system
   ```

2. **Install dependencies**
   ```bash
   npm run install-deps
   ```

3. **Environment Setup**
   
   Backend:
   ```bash
   cd backend
   cp .env.example .env
   # Update .env with your MongoDB URI and JWT secret
   ```

   Frontend:
   ```bash
   cd frontend
   cp .env.example .env
   # Update .env with your API URL
   ```

4. **Start the development servers**
   ```bash
   # From root directory
   npm run dev
   ```
   This will start both frontend (port 3000) and backend (port 5000) concurrently.

### Environment Variables

#### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hospital_management
JWT_SECRET=your_jwt_secret_key_here_change_in_production
NODE_ENV=development
```

#### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Usage

### Initial Setup

1. **Create Super Admin**
   - Navigate to the login page
   - Click "Create Super Admin (Initial Setup)"
   - Fill in the super admin details
   - This creates the first user with system-wide access

2. **Create Hospital**
   - Login as Super Admin
   - Create a new hospital with all required details
   - A hospital admin is automatically created with default credentials

3. **Setup Departments**
   - Login as Hospital Admin
   - Create departments (Medical, Diagnostic, Pharmacy, Billing, etc.)
   - Assign department types and descriptions

4. **Add Staff**
   - Create staff members for each department
   - For doctors, add specialities, fees, and other professional details
   - Assign appropriate roles to staff members

5. **Patient Registration**
   - Login as Receptionist
   - Register new patients (OPD or Emergency)
   - Assign doctors and collect patient information

6. **Billing Management**
   - Create bills for patients
   - Process payments with UTR numbers
   - Track payment status and history

### Dummy Login Credentials

For testing purposes, the following dummy credentials are available on the login page:

- **Super Admin**: `superadmin@hms.com` / `admin123`
- **Hospital Admin**: `admin@hospital.com` / `admin123`
- **Receptionist**: `receptionist@hospital.com` / `recep123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/create-super-admin` - Create super admin
- `POST /api/auth/create-hospital-admin` - Create hospital admin
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/change-password` - Change password

### Hospitals
- `GET /api/hospitals` - Get all hospitals (Super Admin only)
- `POST /api/hospitals` - Create hospital (Super Admin only)
- `GET /api/hospitals/:id` - Get hospital by ID
- `PUT /api/hospitals/:id` - Update hospital
- `DELETE /api/hospitals/:id` - Deactivate hospital

### Departments
- `GET /api/departments/hospital/:hospitalId` - Get hospital departments
- `POST /api/departments` - Create department
- `GET /api/departments/:id` - Get department by ID
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Deactivate department

### Staff
- `GET /api/staff/hospital/:hospitalId` - Get hospital staff
- `POST /api/staff` - Create staff member
- `GET /api/staff/:id` - Get staff by ID
- `PUT /api/staff/:id` - Update staff
- `DELETE /api/staff/:id` - Deactivate staff
- `GET /api/staff/doctors/available` - Get available doctors

### Patients
- `GET /api/patients/hospital/:hospitalId` - Get hospital patients
- `POST /api/patients` - Create patient
- `GET /api/patients/:id` - Get patient by ID
- `PUT /api/patients/:id` - Update patient
- `GET /api/patients/search/hospital/:hospitalId` - Search patients

### Billing
- `POST /api/billing/patient/:patientId` - Create bill for patient
- `POST /api/billing/bill/:billId/pay` - Mark bill as paid
- `GET /api/billing/hospital/:hospitalId` - Get hospital bills
- `GET /api/billing/patient/:patientId/history` - Get patient payment history
- `POST /api/billing/bill/:billId/cancel` - Cancel bill

## Database Schema

### User Model
- Basic user information (name, email, phone)
- Role-based access (super_admin, hospital_admin, doctor, etc.)
- Hospital and department associations
- Doctor-specific fields (specialities, fees, education, etc.)

### Hospital Model
- Hospital details (name, contact, address)
- Registration and emergency information
- Associated departments and staff

### Department Model
- Department information and type
- Hospital association
- Staff assignments

### Patient Model
- Comprehensive patient information
- Medical history and current issues
- Assigned doctor and visit details
- Billing information and payment status

## Security Features

- JWT-based authentication
- Role-based authorization
- Password hashing with bcryptjs
- Input validation and sanitization
- CORS configuration
- Protected API routes

## Deployment

### Vercel Deployment
The application is configured for Vercel deployment:

1. **Automatic Deployment**
   - Connect your GitHub repository to Vercel
   - Vercel automatically builds and deploys both frontend and backend

2. **Environment Variables**
   - Set production environment variables in Vercel dashboard
   - Include MongoDB URI and JWT secret

3. **Database Setup**
   - Use MongoDB Atlas for production database
   - Update connection string in environment variables

### Manual Deployment
For manual deployment:

1. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm start
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the repository or contact the development team.

---

**Note**: This is a comprehensive hospital management system designed for demonstration purposes. In production, additional security measures, testing, and compliance requirements should be implemented.
