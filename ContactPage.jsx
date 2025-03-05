import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import './styles.css';

const ContactPage = () => {
  return (
    <div className="dashboard">
      <Navbar />
      <section className="contact">
        <h1>Contact Us</h1>
        <div className="contact-content">
          <p>Email: support@officeowl.com</p>
          <p>Phone: +91 123-456-7890</p>
          <p>Address: 123 HR Street, Tech City, India</p>
          <form className="contact-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input type="text" id="name" placeholder="Your Name" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" placeholder="Your Email" required />
            </div>
            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea id="message" placeholder="Your Message" rows="5" required></textarea>
            </div>
            <button type="submit" className="dashboard-button">Send Message</button>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ContactPage;