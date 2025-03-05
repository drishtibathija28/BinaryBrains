import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { AuthContext } from './AuthContext'; // Import AuthContext
import myLogo from './myLogo.png';
import './styles.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { isLoggedIn } = useContext(AuthContext); // Access isLoggedIn from AuthContext

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('User logged out successfully');
      navigate('/'); // Redirect to landing page after logout
    } catch (err) {
      console.error('Error logging out:', err.message);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Brand/Logo */}
        <div className="navbar-brand">
          <Link to="/" className="navbar-logo">
            <img src={myLogo} alt="OfficeOwl Logo" className="logo" />
            <span className="playwrite-it-moderna-officeowl">OfficeOwl</span>
          </Link>
        </div>

        {/* Hamburger Menu (Mobile) */}
        <div className="navbar-toggle" onClick={toggleMenu}>
          <span className="navbar-toggle-bar"></span>
          <span className="navbar-toggle-bar"></span>
          <span className="navbar-toggle-bar"></span>
        </div>

        {/* Navigation Links */}
        <ul className={`navbar-menu ${isOpen ? 'active' : ''}`}>
          <li className="navbar-item">
            <Link to="/features" className="navbar-link">Features</Link>
          </li>
          <li className="navbar-item">
            <Link to="/benefits" className="navbar-link">Announcements</Link>
          </li>
          <li className="navbar-item">
            <Link to="/login" className="navbar-link">Get Started</Link>
          </li>
          <li className="navbar-item">
            <Link to="/contact" className="navbar-link">Contact</Link>
          </li>
          {/* Conditionally render Logout button */}
          {isLoggedIn && (
            <li className="navbar-item">
              <button className="navbar-link logout-button" onClick={handleLogout}>
                Logout
              </button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;