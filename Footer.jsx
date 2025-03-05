import React from 'react';
import myLogo from './logo.png'; // Import the logo from src/
import { FaTwitter, FaLinkedin, FaGithub } from 'react-icons/fa'; // Import icons
import './styles.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <img src={myLogo} alt="OfficeOwl Logo" className="logo" />
          <h3 className="logo-text">OfficeOwl</h3>
          <p>Simplifying workforce management.</p>
        </div>
        <div className="footer-nav">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
        <div className="footer-social">
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
            <FaTwitter className="social-icon" />
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
            <FaLinkedin className="social-icon" />
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            <FaGithub className="social-icon" />
          </a>
        </div>
      </div>
      <div className="footer-copyright">
        © 2025 OfficeOwl Solutions. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;