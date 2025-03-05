// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthContext, AuthProvider } from './AuthContext.jsx';
import Navbar from './Navbar';
import LoginRegister from './LoginRegister';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import LandingPage from './LandingPage';
import FeaturesPage from './FeaturesPage';
import BenefitsPage from './BenefitsPage';
import ContactPage from './ContactPage';
import ReportPage from './ReportPage';
import { useNavigate } from 'react-router-dom';
import Chatbot from './Chatbot.jsx';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Chatbot/>

        <Routes>
          <Route path="/login" element={<LoginRegister />} />
          <Route path="/admin-dashboard" element={<ProtectedRoute component={AdminDashboard} requiredRole="admin" />} />
          <Route path="/employee-dashboard" element={<ProtectedRoute component={EmployeeDashboard} requiredRole="employee" />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/benefits" element={<BenefitsPage />} />
          <Route path="/cta" element={<Navigate to="/" />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/report/:reportId?" element={<ReportPage />} /> {/* Add optional reportId */}
          <Route path="*" element={<div>404 - Page Not Found</div>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const ProtectedRoute = ({ component: Component, requiredRole }) => {
  const { isLoggedIn, role, loading } = React.useContext(AuthContext);
  const navigate = useNavigate();

  if (loading) return <div>Loading...</div>;

  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }

  if (role !== requiredRole) {
    return <Navigate to="/login" />;
  }

  return <Component />;
};

export default App;