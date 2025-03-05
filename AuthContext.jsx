// src/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsLoggedIn(true);
          setEmail(userData.email);
          setRole(userData.role);
        } else {
          setIsLoggedIn(false);
          setEmail('');
          setRole('');
        }
      } else {
        setIsLoggedIn(false);
        setEmail('');
        setRole('');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = (userEmail, userRole) => {
    setIsLoggedIn(true);
    setEmail(userEmail);
    setRole(userRole);
  };

  const logout = () => {
    auth.signOut();
    setIsLoggedIn(false);
    setEmail('');
    setRole('');
  };

  const value = {
    isLoggedIn,
    email,
    role,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};