"use client";

import React, { useState, useEffect, useContext } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import jsPDF from "jspdf";
import "jspdf-autotable";
import CryptoJS from "crypto-js";
import "./styles.css";
import Footer from "./Footer";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const AdminDashboard = () => {
  const { isLoggedIn, email, role, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [animateGraphs, setAnimateGraphs] = useState(false);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveStats, setLeaveStats] = useState({
    pending: 0,
    approved: 0,
    denied: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [employeeEmail, setEmployeeEmail] = useState("");
  const FIXED_IV_BASE64 = "ezTO2mUXkSAvBYJ0vCt2qg==";
  useEffect(() => {
    if (!loading && (!isLoggedIn || role !== "admin")) {
      navigate("/login");
    }
  }, [isLoggedIn, role, loading, navigate]);

  useEffect(() => {
    if (isLoggedIn && role === "admin") {
      setTimeout(() => setAnimateGraphs(true), 100);
      fetchAdminDashboardData();
    }
  }, [isLoggedIn, role]);

  const fetchAdminDashboardData = async () => {
    setIsLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setTotalEmployees(usersSnapshot.size);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const attendanceQuery = query(
        collection(db, "attendance"),
        where("checkInTime", ">=", today),
        where("checkInTime", "<", tomorrow),
        where("status", "==", "Checked In")
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      setPresentToday(attendanceSnapshot.size);

      const leaveQuery = query(collection(db, "leaveRequests"));
      const leaveSnapshot = await getDocs(leaveQuery);
      const leaveData = leaveSnapshot.docs.map((doc) => doc.data());

      const pendingLeaves = leaveData.filter(
        (leave) => leave.status === "pending"
      ).length;
      const approvedLeaves = leaveData.filter(
        (leave) => leave.status === "approved"
      ).length;
      const deniedLeaves = leaveData.filter(
        (leave) => leave.status === "denied"
      ).length;

      setLeaveStats({
        pending: pendingLeaves,
        approved: approvedLeaves,
        denied: deniedLeaves,
      });

      const pendingLeaveQuery = query(
        collection(db, "leaveRequests"),
        where("status", "==", "pending")
      );
      const unsubscribe = onSnapshot(pendingLeaveQuery, async (snapshot) => {
        const requestsData = await Promise.all(
          snapshot.docs.map(async (reqDoc) => {
            const reqData = reqDoc.data();
            const userIdentifier = reqData.userEmail;
            let employeeName = userIdentifier;

            try {
              const userRef = doc(db, "users", userIdentifier);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                employeeName = userDoc.data().fullName || userIdentifier;
              }
            } catch (err) {
              console.error(`Error fetching user ${userIdentifier}:`, err);
            }

            return {
              id: reqDoc.id,
              employee: employeeName,
              reason: reqData.reason || "No reason provided",
              pdfUrl: reqData.pdfUrl || null,
              encryptionKey: reqData.encryptionKey || null,
            };
          })
        );

        setLeaveRequests(requestsData);
        setPendingRequests(requestsData.length);
        toast.info(`${requestsData.length} pending leave requests`);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching admin dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };
  const handleDecryptPDF = async (requestId, pdfUrl, encryptionKey) => {
    try {
      if (!pdfUrl || !encryptionKey) {
        toast.error("No PDF or encryption key available");
        return;
      }

      const response = await fetch(pdfUrl);
      const encryptedArrayBuffer = await response.arrayBuffer();

      const encryptedWordArray = CryptoJS.lib.WordArray.create(
        new Uint8Array(encryptedArrayBuffer)
      );

      const iv = CryptoJS.enc.Base64.parse(FIXED_IV_BASE64);
      const keyWordArray = CryptoJS.enc.Base64.parse(encryptionKey);

      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: encryptedWordArray },
        keyWordArray,
        {
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
          iv: iv,
        }
      );

      const decryptedWords = decrypted.words;
      const decryptedByteArray = new Uint8Array(decryptedWords.length * 4);
      for (let i = 0; i < decryptedWords.length; i++) {
        const word = decryptedWords[i];
        decryptedByteArray[i * 4] = (word >> 24) & 0xff;
        decryptedByteArray[i * 4 + 1] = (word >> 16) & 0xff;
        decryptedByteArray[i * 4 + 2] = (word >> 8) & 0xff;
        decryptedByteArray[i * 4 + 3] = word & 0xff;
      }

      const blob = new Blob([decryptedByteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `decrypted_${requestId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("PDF Decryption Error:", error);
      toast.error(
        "Failed to decrypt PDF: " + (error.message || "Unknown error")
      );
    }
  };
  

  const handleApprove = async (requestId) => {
    try {
      await setDoc(
        doc(db, "leaveRequests", requestId),
        {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: email,
        },
        { merge: true }
      );
      toast.success("Leave request approved");
    } catch (error) {
      console.error("Approval Error:", error);
      toast.error("Failed to approve leave request");
    }
  };

  const handleDeny = async (requestId) => {
    try {
      await setDoc(
        doc(db, "leaveRequests", requestId),
        {
          status: "denied",
          deniedAt: new Date(),
          deniedBy: email,
        },
        { merge: true }
      );
      toast.success("Leave request denied");
    } catch (error) {
      console.error("Denial Error:", error);
      toast.error("Failed to deny leave request");
    }
  };
  const generateAdminReport = async () => {
    setIsLoading(true);
    try {
      const pdf = new jsPDF();
      const currentDate = new Date().toLocaleDateString();
      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFontSize(20);
      pdf.text("OfficeOwl Admin Report", pageWidth / 2, 20, {
        align: "center",
      });

      pdf.setFontSize(12);
      pdf.text(`Generated: ${currentDate}`, 14, 30);
      pdf.text(`Admin: ${email}`, 14, 37);

      pdf.setFontSize(14);
      pdf.text("Employee Overview", 14, 50);
      pdf.setFontSize(11);
      pdf.text(`Total Employees: ${totalEmployees}`, 20, 58);
      pdf.text(`Employees Present Today: ${presentToday}`, 20, 65);

      pdf.setFontSize(14);
      pdf.text("Leave Statistics", 14, 80);
      pdf.setFontSize(11);
      pdf.text(`Pending Leaves: ${leaveStats.pending}`, 20, 88);
      pdf.text(`Approved Leaves: ${leaveStats.approved}`, 20, 95);
      pdf.text(`Denied Leaves: ${leaveStats.denied}`, 20, 102);

      pdf.save(`AdminReport_${currentDate.replace(/\//g, "-")}.pdf`);

      toast.success("Report generated successfully");
    } catch (error) {
      console.error("Report Generation Error:", error);
      toast.error("Failed to generate report");
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async (email) => {
    if (!email) {
      toast.error("Please enter an employee email.");
      return;
    }
    setIsLoading(true);

    try {
      const leaveQuery = query(
        collection(db, "leaveRequests"),
        where("userEmail", "==", email)
      );
      const leaveSnapshot = await getDocs(leaveQuery);

      const attendanceRef = doc(db, "attendance", email);
      const attendanceSnap = await getDoc(attendanceRef);

      const leaveData = leaveSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate().toLocaleDateString(),
      }));

      const pendingLeaves = leaveData.filter(
        (leave) => leave.status === "pending"
      ).length;
      const approvedLeaves = leaveData.filter(
        (leave) => leave.status === "approved"
      ).length;
      const totalLeaves = leaveData.length;

      const attendanceData = attendanceSnap.exists()
        ? attendanceSnap.data()
        : {};
      const lastCheckInDate = attendanceData.checkInTime
        ?.toDate()
        .toLocaleString();
      const lastCheckOutDate = attendanceData.checkOutTime
        ?.toDate()
        .toLocaleString();

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const workingDays = calculateWorkingDays(monthStart, today);

      let daysPresent = attendanceData.daysPresent || 0;

      // Ensure daysPresent doesn't exceed workingDays for the current month
      daysPresent = Math.min(daysPresent, workingDays);

      const attendanceRate =
        workingDays > 0
          ? Math.min(((daysPresent / workingDays) * 100), 100).toFixed(2)
          : "0.00";
      const leaveUtilization =
        totalLeaves > 0 ? ((approvedLeaves / 20) * 100).toFixed(2) : "0.00";

      const report = {
        employeeEmail: email,
        generatedAt: new Date().toLocaleString(),
        leaveStats: {
          total: totalLeaves,
          pending: pendingLeaves,
          approved: approvedLeaves,
          recentLeaves: leaveData.slice(0, 5).map((leave) => ({
            id: leave.id,
            submittedAt: leave.submittedAt || "N/A",
            reason: leave.reason || "N/A",
            status: leave.status || "N/A",
          })),
        },
        attendance: {
          currentStatus: attendanceData.status || "N/A",
          lastCheckIn: lastCheckInDate || "N/A",
          lastCheckOut: lastCheckOutDate || "N/A",
          monthlyWorkingDays: workingDays || 0,
          daysPresent: daysPresent || 0,
        },
        performance: {
          attendanceRate: attendanceRate,
          leaveUtilization: leaveUtilization,
        },
        reportType: "employee",
      };

      const reportId = `${email}_${Date.now()}`;
      await setDoc(doc(db, "reports", reportId), {
        ...report,
        createdAt: serverTimestamp(),
      });

      const userName = email.split("@")[0];
      const pdf = new jsPDF();
      const currentDate = new Date().toLocaleDateString();
      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text("OfficeOwl", pageWidth / 2, 15, { align: "center" });

      pdf.setFontSize(16);
      pdf.text("Employee Attendance & Leave Report", pageWidth / 2, 25, {
        align: "center",
      });

      pdf.setFontSize(12);
      pdf.setTextColor(50, 50, 50);
      pdf.text(`Generated: ${currentDate}`, 14, 35);
      pdf.text(`Employee: ${userName} (${email})`, 14, 42);

      pdf.setDrawColor(200, 200, 200);
      pdf.line(14, 45, pageWidth - 14, 45);

      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Leave Statistics", 14, 55);

      pdf.setFontSize(11);
      pdf.text(`• Total Requests: ${totalLeaves}`, 20, 63);
      pdf.text(`• Pending: ${pendingLeaves}`, 20, 70);
      pdf.text(`• Approved: ${approvedLeaves}`, 20, 77);

      pdf.setFontSize(14);
      pdf.text("Recent Leave Requests:", 14, 87);

      if (leaveData.length > 0) {
        const recentLeaves = leaveData.slice(0, 5);
        let y = 95;

        recentLeaves.forEach((leave, index) => {
          pdf.setFontSize(11);
          pdf.text(
            `• ${leave.submittedAt || "N/A"} - ${leave.reason || "N/A"} (${
              leave.status || "N/A"
            })`,
            20,
            y
          );
          y += 7;
        });
      } else {
        pdf.setFontSize(11);
        pdf.text("• No leave requests found", 20, 95);
      }

      pdf.setFontSize(14);
      pdf.text("Attendance Details", 14, 125);

      pdf.setFontSize(11);
      pdf.text(`• Current Status: ${attendanceData.status || "N/A"}`, 20, 133);
      pdf.text(`• Last Check-In: ${lastCheckInDate || "N/A"}`, 20, 140);
      pdf.text(`• Last Check-Out: ${lastCheckOutDate || "N/A"}`, 20, 147);
      pdf.text(`• Working Days This Month: ${workingDays}`, 20, 154);
      pdf.text(`• Days Present: ${daysPresent}`, 20, 161);

      pdf.setFontSize(14);
      pdf.text("Performance Metrics", 14, 171);

      pdf.setFontSize(11);
      pdf.text(`• Attendance Rate: ${attendanceRate}%`, 20, 179);
      pdf.text(`• Leave Utilization: ${leaveUtilization}%`, 20, 186);

      const footerY = pdf.internal.pageSize.getHeight() - 10;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text("OfficeOwl Employee Management System", pageWidth / 2, footerY, {
        align: "center",
      });

      pdf.save(
        `${userName}_attendance_report_${currentDate.replace(/\//g, "-")}.pdf`
      );

      toast.success("Report generated and downloaded successfully!");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateWorkingDays = (startDate, endDate) => {
    let count = 0;
    const curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      curDate.setDate(curDate.getDate() + 1);
    }
    return count;
  };

  const barChartData = {
    labels: ["Pending", "Approved", "Denied"],
    datasets: [
      {
        label: "Leave Requests",
        data: [leaveStats.pending, leaveStats.approved, leaveStats.denied],
        backgroundColor: [
          "rgba(0, 0, 0, 0.6)", // Black for Pending
          "rgba(128, 128, 128, 0.6)", // Grey for Approved
          "rgba(169, 169, 169, 0.6)", // Light Grey for Denied
        ],
        borderColor: [
          "rgba(0, 0, 0, 1)", // Black border for Pending
          "rgba(128, 128, 128, 1)", // Grey border for Approved
          "rgba(169, 169, 169, 1)", // Light Grey border for Denied
        ],
        borderWidth: 1,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#000000", // Black text for legend
        },
      },
      title: {
        display: true,
        text: "Leave Request Statistics",
        color: "#000000", // Black text for title
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Requests",
          color: "#000000", // Black text for y-axis title
        },
        grid: {
          color: "rgba(128, 128, 128, 0.1)", // Light grey grid lines
        },
        ticks: {
          color: "#000000", // Black text for y-axis ticks
        },
      },
      x: {
        grid: {
          color: "rgba(128, 128, 128, 0.1)", // Light grey grid lines
        },
        ticks: {
          color: "#000000", // Black text for x-axis ticks
        },
      },
    },
  };

  if (loading) return <div>Loading...</div>;
  if (!isLoggedIn || role !== "admin") return null;

  return (
    <div className="dashboard admin-dashboard">
      <ToastContainer />

      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Manage Teams Securely - Logged in as {email}</p>
      </header>

      <section className="dashboard-metrics">
        <div className="metric-card">
          <h3>Total Employees</h3>
          <p>{totalEmployees}</p>
        </div>
        <div className="metric-card">
          <h3>Present Today</h3>
          <p>{presentToday}</p>
        </div>
        <div className="metric-card">
          <h3>Pending Requests</h3>
          <p>{pendingRequests}</p>
        </div>
      </section>

      <section className="dashboard-section chart-section">
  <h2>Leave Statistics</h2>
  <div className="chart-container">
    <Bar data={barChartData} options={barChartOptions} />
  </div>
</section>
      <section className="dashboard-section leave-requests">
        <h2>Pending Leave Requests</h2>
        {leaveRequests.length === 0 ? (
          <p>No pending leave requests at this time.</p>
        ) : (
          <div className="requests-table">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Reason</th>
                  <th>PDF</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.employee}</td>
                    <td>{request.reason}</td>
                    <td>
                      {request.pdfUrl && request.encryptionKey ? (
                        <button
                          className="dashboard-button"
                          onClick={() =>
                            handleDecryptPDF(
                              request.id,
                              request.pdfUrl,
                              request.encryptionKey
                            )
                          }
                        >
                          View PDF
                        </button>
                      ) : (
                        "No PDF"
                      )}
                    </td>
                    <td>
                      <button
                        className="dashboard-button approve"
                        onClick={() => handleApprove(request.id)}
                      >
                        Approve
                      </button>
                      <button
                        className="dashboard-button deny"
                        onClick={() => handleDeny(request.id)}
                      >
                        Deny
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-section reports">
        <h2>Generate Reports</h2>
        <div>
          <input
            type="email"
            placeholder="Enter employee email"
            value={employeeEmail}
            onChange={(e) => setEmployeeEmail(e.target.value)}
          />
          <button
            className="dashboard-button"
            onClick={() => generateReport(employeeEmail)}
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Generate Employee Report"}
          </button>
        </div>
        <button
          className="dashboard-button"
          onClick={generateAdminReport}
          disabled={isLoading}
        >
          {isLoading ? "Generating..." : "Export Admin Report"}
        </button>
      </section>

      <Footer />
    </div>
  );
};

export default AdminDashboard;