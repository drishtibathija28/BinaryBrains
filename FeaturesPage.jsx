import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import './styles.css';

const FeaturesPage = () => {
  return (
    <div className="dashboard">
      <Navbar />
      <section className="features">
        <h1>Our Features</h1>
        <div className="features-container">
          <div className="feature-item">
            <h3>Attendance Tracking</h3>
            <p>Monitor employee attendance in real-time with secure and intuitive tools.</p>
          </div>
          <div className="feature-item">
            <h3>Leave Management</h3>
            <p>Simplify leave requests and approvals with an automated system.</p>
          </div>
          <div className="feature-item">
            <h3>Data Security</h3>
            <p>Protect sensitive employee data with advanced encryption.</p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FeaturesPage;