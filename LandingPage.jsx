import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from './Footer';
import Navbar from './Navbar';
import { AuthContext } from './AuthContext'; // Import AuthContext
import './styles.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, role, loading } = useContext(AuthContext); // Access AuthContext

  // Handle Dashboard button click
  const handleDashboardClick = () => {
    if (loading) {
      // While loading, do nothing or show a loading state
      return;
    }

    if (isLoggedIn) {
      // Redirect based on role
      if (role === 'admin') {
        navigate('/admin-dashboard');
      } else if (role === 'employee') {
        navigate('/employee-dashboard');
      } else {
        // Fallback in case role is undefined or unexpected
        navigate('/login');
      }
    } else {
      // Redirect to login if not logged in
      navigate('/login');
    }
  };

  return (
    <div>
      <Navbar />
      <section className="hero">
        <div className="hero-content">
          <h1>Secure HR Simplified</h1>
          <p>Effortless attendance tracking and leave management for modern teams.</p>
          <button className="hero-button" onClick={() => navigate('/login')}>
            Get Started
          </button>
        </div>
      </section>
      <section className="features">
        <h2>Core Features</h2>
        <div className="features-container">
          <div className="feature-item">
            <h3>Attendance Tracking</h3>
            <p>Real-time monitoring with secure, intuitive tools.</p>
          </div>
          <div className="feature-item">
            <h3>Leave Management</h3>
            <p>Automate time-off requests with ease.</p>
          </div>
          <div className="feature-item">
            <h3>Data Security</h3>
            <p>Protect employee info with top-tier encryption.</p>
          </div>
        </div>
      </section>
      <section className="cta">
        <h2>Ready to Transform HR?</h2>
        <p>Join today and streamline your workforce management.</p>
        <button
          className="cta-button"
          onClick={handleDashboardClick}
          disabled={loading} // Disable button while loading
        >
          {loading ? 'Loading...' : 'Dashboard'}
        </button>
      </section>
      <Footer />
    </div>
  );
};

export default LandingPage;