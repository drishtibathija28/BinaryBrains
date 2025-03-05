import React, { useState, useContext, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext.jsx";
import "./styles.css";

const LoginRegister = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [verificationId, setVerificationId] = useState(null);
  const [resolver, setResolver] = useState(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaPhoneNumber, setMfaPhoneNumber] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaStep, setMfaStep] = useState(1);
  const [mfaUser, setMfaUser] = useState(null);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const recaptchaVerifierRef = useRef(null);

  // Load reCAPTCHA script and initialize verifier
  useEffect(() => {
    const loadRecaptcha = () => {
      return new Promise((resolve, reject) => {
        if (window.grecaptcha) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = `https://www.google.com/recaptcha/api.js?render=${
          import.meta.env.VITE_SITE_KEY
        }`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Failed to load reCAPTCHA script"));
        document.head.appendChild(script);
      });
    };

    const initializeRecaptcha = async () => {
      try {
        // Wait for the reCAPTCHA script to load
        await loadRecaptcha();

        if (!recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current = new RecaptchaVerifier(
            auth,
            "recaptcha-container",
            {
              size: "invisible",
              callback: () => {
                console.log("reCAPTCHA verified successfully");
              },
              "expired-callback": () => {
                setError("reCAPTCHA expired. Please refresh the page.");
                recaptchaVerifierRef.current = null;
              },
              "error-callback": (err) => {
                console.error("reCAPTCHA error:", err);
                setError("reCAPTCHA failed to load. Please refresh the page.");
                recaptchaVerifierRef.current = null;
              },
            }
          );

          const widgetId = await recaptchaVerifierRef.current.render();
          console.log("reCAPTCHA initialized with widget ID:", widgetId);
        }
      } catch (err) {
        console.error("reCAPTCHA initialization error:", err);
        setError(
          "Security check failed to initialize. Please check your network and refresh the page."
        );
        recaptchaVerifierRef.current = null;
      }
    };

    initializeRecaptcha();

    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!recaptchaVerifierRef.current) {
      throw new Error("Security check not ready. Please refresh the page.");
    }
    return recaptchaVerifierRef.current;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const verifier = setupRecaptcha();
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        await completeLogin(userCredential);
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          email,
          role,
          createdAt: new Date(),
        });

        setMfaUser(user);
        setShowMfaModal(true);
      }
    } catch (err) {
      if (err.code === "auth/multi-factor-auth-required") {
        const mfaResolver = getMultiFactorResolver(auth, err);
        const phoneHint = mfaResolver.hints.find(
          (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID
        );
        if (phoneHint) {
          const phoneAuthProvider = new PhoneAuthProvider(auth);
          const vid = await phoneAuthProvider.verifyPhoneNumber(
            { multiFactorHint: phoneHint, session: mfaResolver.session },
            setupRecaptcha()
          );
          setVerificationId(vid);
          setResolver(mfaResolver);
          setShowMfaInput(true);
        } else {
          setError("Phone-based MFA not available for this account.");
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cred = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      const userCredential = await resolver.resolveSignIn(multiFactorAssertion);
      await completeLogin(userCredential);
    } catch (err) {
      setError("Invalid SMS code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (userCredential) => {
    const user = userCredential.user;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      throw new Error("User not found in database. Please register.");
    }

    const userRole = userDoc.data().role;
    if (!["admin", "employee"].includes(userRole)) {
      throw new Error("Invalid role assigned to this account.");
    }

    login(email, userRole);
    navigate(userRole === "admin" ? "/admin-dashboard" : "/employee-dashboard");
  };

  const handleMfaEnrollment = async () => {
    setLoading(true);
    if (mfaStep === 1) {
      if (!mfaPhoneNumber.startsWith("+") || mfaPhoneNumber.length < 10) {
        setError(
          "Please enter a valid phone number with country code (e.g., +911234567890)."
        );
        setLoading(false);
        return;
      }

      try {
        const verifier = setupRecaptcha();
        const phoneAuthProvider = new PhoneAuthProvider(auth);
        const vid = await phoneAuthProvider.verifyPhoneNumber(
          { phoneNumber: mfaPhoneNumber },
          verifier
        );
        setVerificationId(vid);
        setMfaStep(2);
      } catch (err) {
        setError("Failed to send SMS: " + err.message);
      }
    } else {
      try {
        const cred = PhoneAuthProvider.credential(verificationId, mfaCode);
        const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
        await multiFactor(mfaUser).enroll(multiFactorAssertion, "Phone");
        setShowMfaModal(false);
        login(email, role);
        navigate(role === "admin" ? "/admin-dashboard" : "/employee-dashboard");
      } catch (err) {
        setError("Invalid SMS code or enrollment failed: " + err.message);
      }
    }
    setLoading(false);
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setError("");
    setEmail("");
    setPassword("");
    setRole("employee");
    setShowMfaInput(false);
    setVerificationCode("");
    setShowMfaModal(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>{isLogin ? "Login" : "Register"}</h1>
        <p className="auth-subtitle">
          {isLogin
            ? "Sign in to manage your team"
            : "Create an account to get started"}
        </p>
        {!isLogin && !showMfaModal && (
          <div className="role-selection">
            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="employee"
                checked={role === "employee"}
                onChange={(e) => setRole(e.target.value)}
              />
              Employee
            </label>
            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="admin"
                checked={role === "admin"}
                onChange={(e) => setRole(e.target.value)}
              />
              Admin
            </label>
          </div>
        )}

        {!showMfaInput && !showMfaModal ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Processing..." : isLogin ? "Login" : "Register"}
            </button>
          </form>
        ) : showMfaInput ? (
          <form className="auth-form" onSubmit={handleMfaSubmit}>
            <div className="form-group">
              <label htmlFor="verificationCode">SMS Verification Code</label>
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter the SMS code"
                required
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        ) : null}

        {showMfaModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Enable Two-Factor Authentication</h2>
              {mfaStep === 1 ? (
                <>
                  <p>
                    Enter your phone number with country code (e.g.,
                    +911234567890).
                  </p>
                  <div className="form-group">
                    <label htmlFor="mfaPhone">Phone Number</label>
                    <input
                      type="text"
                      id="mfaPhone"
                      value={mfaPhoneNumber}
                      onChange={(e) => setMfaPhoneNumber(e.target.value)}
                      placeholder="Enter phone with country code"
                      required
                    />
                  </div>
                  {error && <p className="auth-error">{error}</p>}
                  <div className="modal-actions">
                    <button
                      className="auth-button"
                      onClick={handleMfaEnrollment}
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send SMS Code"}
                    </button>
                    <button
                      className="auth-button"
                      onClick={() => {
                        setShowMfaModal(false);
                        login(email, role);
                        navigate(
                          role === "admin"
                            ? "/admin-dashboard"
                            : "/employee-dashboard"
                        );
                      }}
                      disabled={loading}
                    >
                      Skip for Now
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>Enter the SMS code sent to {mfaPhoneNumber}.</p>
                  <div className="form-group">
                    <label htmlFor="mfaCode">SMS Code</label>
                    <input
                      type="text"
                      id="mfaCode"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      required
                    />
                  </div>
                  {error && <p className="auth-error">{error}</p>}
                  <div className="modal-actions">
                    <button
                      className="auth-button"
                      onClick={handleMfaEnrollment}
                      disabled={loading}
                    >
                      {loading ? "Verifying..." : "Verify Code"}
                    </button>
                    <button
                      className="auth-button"
                      onClick={() => setMfaStep(1)}
                      disabled={loading}
                    >
                      Back
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div id="recaptcha-container" style={{ display: "none" }}></div>
        {!showMfaModal && (
          <p className="auth-toggle">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span onClick={toggleForm} className="toggle-link">
              {isLogin ? "Register" : "Login"}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

export default LoginRegister;