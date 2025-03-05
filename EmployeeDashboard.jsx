"use client";

import { useState, useEffect, useContext, useCallback } from "react";
import { db, storage } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import jsPDF from "jspdf";
import "jspdf-autotable";
import CryptoJS from "crypto-js";
import "./styles.css";
import Footer from "./Footer";

const EmployeeDashboard = () => {
  const { isLoggedIn, email, role, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [leaveReason, setLeaveReason] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [animatePie, setAnimatePie] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState("Not Checked In");
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [workHours, setWorkHours] = useState("00:00:00 Hrs");
  const [remark, setRemark] = useState("Absent");
  const [shift, setShift] = useState({ start: "09:00:00", end: "17:00:00" });
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [approvedLeaveCount, setApprovedLeaveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [leaveStats, setLeaveStats] = useState({
    approved: 0,
    pending: 0,
    total: 0,
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const FIXED_IV_BASE64 = "ezTO2mUXkSAvBYJ0vCt2qg==";

  useEffect(() => {
    if (leaveStats) {
      setLastUpdate(new Date());
    }
  }, [leaveStats]);

  const holidays2025 = {
    January: [{ date: "January 26", name: "Republic Day" }],
    February: [{ date: "February 26", name: "Maha Shivaratri" }],
    March: [
      { date: "March 14", name: "Holi" },
      { date: "March 31", name: "Eid al-Fitr (Tentative)" },
    ],
    April: [
      { date: "April 10", name: "Ram Navami" },
      { date: "April 14", name: "Ambedkar Jayanti" },
      { date: "April 18", name: "Good Friday" },
    ],
    May: [{ date: "May 13", name: "Buddha Purnima" }],
    June: [{ date: "June 7", name: "Eid al-Adha (Tentative)" }],
    July: [{ date: "July 26", name: "Muharram (Tentative)" }],
    August: [
      { date: "August 15", name: "Independence Day" },
      { date: "August 16", name: "Krishna Janmashtami (Tentative)" },
    ],
    September: [{ date: "September 5", name: "Milad-un-Nabi (Tentative)" }],
    October: [
      { date: "October 2", name: "Gandhi Jayanti" },
      { date: "October 2", name: "Dussehra (Tentative)" },
      { date: "October 20", name: "Diwali (Deepavali)" },
    ],
    November: [{ date: "November 5", name: "Guru Nanak Jayanti" }],
    December: [{ date: "December 25", name: "Christmas" }],
  };

  const calculateWorkHours = useCallback((checkInTime, checkOutTime) => {
    if (!checkInTime) return "00:00:00 Hrs";
    const checkIn = new Date(checkInTime);
    const checkOut = checkOutTime ? new Date(checkOutTime) : new Date();
    const diffMs = checkOut - checkIn;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")} Hrs`;
  }, []);

  useEffect(() => {
    let intervalId = null;
    if (attendanceStatus === "Checked In" && checkInTime) {
      intervalId = setInterval(() => {
        setWorkHours(calculateWorkHours(checkInTime));
      }, 1000);
    } else if (checkInTime && checkOutTime) {
      setWorkHours(calculateWorkHours(checkInTime, checkOutTime));
    } else {
      setWorkHours("00:00:00 Hrs");
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [attendanceStatus, checkInTime, checkOutTime, calculateWorkHours]);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate("/login");
    }
  }, [isLoggedIn, loading, navigate]);

  useEffect(() => {
    if (isLoggedIn) {
      setTimeout(() => setAnimatePie(true), 100);
      fetchAttendanceStatus();
      fetchLeaveCounts();
      fetchShiftDetails();
      fetchLeaveStats();
    }
  }, [isLoggedIn]);

  const fetchLeaveStats = useCallback(() => {
    if (!email) return;

    const leaveQuery = query(
      collection(db, "leaveRequests"),
      where("userEmail", "==", email)
    );
    const unsubscribe = onSnapshot(
      leaveQuery,
      (snapshot) => {
        const leaveData = snapshot.docs.map((doc) => doc.data());
        const approved = leaveData.filter(
          (leave) => leave.status === "approved"
        ).length;
        const pending = leaveData.filter(
          (leave) => leave.status === "pending"
        ).length;
        const total = leaveData.length;
        setLeaveStats({ approved, pending, total });
      },
      (error) => {
        console.error("Error fetching leave stats:", error);
        toast.error("Failed to fetch leave stats.");
      }
    );

    return () => unsubscribe();
  }, [email]);

  useEffect(() => {
    if (isLoggedIn && email) {
      const unsubscribe = fetchLeaveStats();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [isLoggedIn, email, fetchLeaveStats]);

  const fetchShiftDetails = async () => {
    try {
      const userDocRef = doc(db, "users", email);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setShift(userData.shift || { start: "09:00:00", end: "17:00:00" });
      }
    } catch (error) {
      console.error("Error fetching shift details:", error);
      toast.error("Failed to fetch shift details.");
    }
  };

  const fetchAttendanceStatus = async () => {
    if (!email) return;
    try {
      const docRef = doc(db, "attendance", email);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAttendanceStatus(data.status || "Not Checked In");
        const checkInTime = data.checkInTime
          ? new Date(data.checkInTime.toDate())
          : null;
        const checkOutTime = data.checkOutTime
          ? new Date(data.checkOutTime.toDate())
          : null;
        setLastCheckIn(checkInTime ? checkInTime.toLocaleTimeString() : "N/A");
        setCheckInTime(checkInTime);
        setCheckOutTime(checkOutTime);

        const today = new Date();
        const checkInDate = checkInTime
          ? checkInTime.toLocaleDateString()
          : null;
        const todayString = today.toLocaleDateString();
        const currentTime = today.toLocaleTimeString("en-US", {
          hour12: false,
        });

        const [shiftStartHour, shiftStartMinute, shiftStartSecond] = shift.start
          .split(":")
          .map(Number);
        const [shiftEndHour, shiftEndMinute, shiftEndSecond] = shift.end
          .split(":")
          .map(Number);
        const [currentHour, currentMinute, currentSecond] = currentTime
          .split(":")
          .map(Number);

        const shiftStartTime = new Date(today);
        shiftStartTime.setHours(
          shiftStartHour,
          shiftStartMinute,
          shiftStartSecond
        );
        const shiftEndTime = new Date(today);
        shiftEndTime.setHours(shiftEndHour, shiftEndMinute, shiftEndSecond);
        const currentDateTime = new Date(today);
        currentDateTime.setHours(currentHour, currentMinute, currentSecond);

        if (checkInDate === todayString && data.status === "Checked In") {
          setRemark("Present");
        } else if (
          currentDateTime > shiftEndTime &&
          (!checkInTime || checkInDate !== todayString)
        ) {
          setRemark("Absent");
        } else {
          setRemark("Pending");
        }
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Failed to fetch attendance status.");
    }
  };

  const fetchLeaveCounts = async () => {
    try {
      const leaveQuery = query(
        collection(db, "leaveRequests"),
        where("userEmail", "==", email)
      );
      const leaveSnapshot = await getDocs(leaveQuery);
      const leaveData = leaveSnapshot.docs.map((doc) => doc.data());
      const pending = leaveData.filter(
        (leave) => leave.status === "pending"
      ).length;
      const approved = leaveData.filter(
        (leave) => leave.status === "approved"
      ).length;
      setPendingLeaveCount(pending);
      setApprovedLeaveCount(approved);
    } catch (error) {
      console.error("Error fetching leave counts:", error);
      toast.error("Failed to fetch leave counts.");
    }
  };

  const handleCheckInOut = async () => {
    if (!email || role !== "employee") return;
    setIsLoading(true);
    try {
      const docRef = doc(db, "attendance", email);
      const docSnap = await getDoc(docRef);
      const today = new Date();
      const todayDateString = today.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
      const currentMonth = today.getMonth();

      if (docSnap.exists()) {
        const data = docSnap.data();
        let daysPresent = data.daysPresent || 0;
        let lastCheckOutDate = data.lastCheckOutDate || null;
        let lastCheckOutMonth = data.lastCheckOutMonth || null;

        // Reset daysPresent if we're in a new month
        if (lastCheckOutMonth !== null && lastCheckOutMonth !== currentMonth) {
          daysPresent = 0;
        }

        if (data.status === "Checked In" && !data.checkOutTime) {
          // Check out
          if (lastCheckOutDate !== todayDateString) {
            daysPresent = Math.min(daysPresent + 1, calculateWorkingDays(new Date(today.getFullYear(), today.getMonth(), 1), today));
          }

          await updateDoc(docRef, {
            checkOutTime: serverTimestamp(),
            status: "Checked Out",
            lastCheckOutDate: todayDateString,
            lastCheckOutMonth: currentMonth,
            daysPresent: daysPresent,
          });
          setAttendanceStatus("Checked Out");
          setCheckInTime(null);
          setCheckOutTime(new Date());
          toast.success("Checked out successfully!");
        } else {
          // Check in
          await setDoc(
            docRef,
            {
              checkInTime: serverTimestamp(),
              checkOutTime: null,
              role: role,
              status: "Checked In",
              userEmail: email,
              daysPresent: daysPresent,
              lastCheckOutDate: lastCheckOutDate,
              lastCheckOutMonth: lastCheckOutMonth,
            },
            { merge: true }
          );
          setAttendanceStatus("Checked In");
          setCheckInTime(new Date());
          setCheckOutTime(null);
          toast.success("Checked in successfully!");
        }
      } else {
        // First time checking in
        await setDoc(docRef, {
          checkInTime: serverTimestamp(),
          checkOutTime: null,
          role: role,
          status: "Checked In",
          userEmail: email,
          daysPresent: 0,
          lastCheckOutDate: null,
          lastCheckOutMonth: null,
        });
        setAttendanceStatus("Checked In");
        setCheckInTime(new Date());
        setCheckOutTime(null);
        toast.success("Checked in successfully!");
      }
      setTimeout(fetchAttendanceStatus, 1000);
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast.error("Failed to update attendance: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!email || role !== "employee" || !leaveReason || !fromDate || !toDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    setSubmissionMessage("");

    try {
      const leaveStatus = leaveReason.toLowerCase().includes("vacation")
        ? "approved"
        : "pending";
      const leaveId = `${email}_${Date.now()}`;
      const leaveDocRef = doc(db, "leaveRequests", leaveId);

      let pdfDownloadUrl = null;
      let encryptionKey = null;
      if (pdfFile) {
        try {
          const fileSizeMB = pdfFile.size / (1024 * 1024);
          console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);

          const reader = new FileReader();
          const fileData = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(pdfFile);
          });

          const wordArray = CryptoJS.lib.WordArray.create(
            new Uint8Array(fileData)
          );
          encryptionKey = CryptoJS.lib.WordArray.random(32);
          const iv = CryptoJS.enc.Base64.parse(FIXED_IV_BASE64);

          const encrypted = CryptoJS.AES.encrypt(wordArray, encryptionKey, {
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
            iv: iv,
          });

          const encryptedBytes = encrypted.ciphertext;
          const byteArray = new Uint8Array(encryptedBytes.words.length * 4);
          for (let i = 0; i < encryptedBytes.words.length; i++) {
            const word = encryptedBytes.words[i];
            byteArray[i * 4] = (word >> 24) & 0xff;
            byteArray[i * 4 + 1] = (word >> 16) & 0xff;
            byteArray[i * 4 + 2] = (word >> 8) & 0xff;
            byteArray[i * 4 + 3] = word & 0xff;
          }

          const encryptedBlob = new Blob([byteArray], {
            type: "application/octet-stream",
          });

          const storageRef = ref(
            storage,
            `leave-pdfs/${email}/${leaveId}/encrypted_${pdfFile.name}`
          );
          await uploadBytes(storageRef, encryptedBlob);
          pdfDownloadUrl = await getDownloadURL(storageRef);

          const keyForStorage = encryptionKey.toString(CryptoJS.enc.Base64);
          encryptionKey = keyForStorage;
        } catch (uploadError) {
          console.error("Error uploading encrypted PDF:", uploadError);
          setSubmissionMessage(
            "Leave request submitted, but failed to upload PDF: " +
              uploadError.message
          );
        }
      }

      await setDoc(leaveDocRef, {
        userEmail: email,
        role: role,
        reason: leaveReason,
        fromDate: fromDate,
        toDate: toDate,
        status: leaveStatus,
        submittedAt: serverTimestamp(),
        pdfUrl: pdfDownloadUrl,
        encryptionKey: encryptionKey,
      });

      if (!pdfFile || pdfDownloadUrl) {
        setSubmissionMessage("Leave request submitted successfully!");
        toast.success("Leave request submitted successfully!");
      }
      setLeaveReason("");
      setFromDate("");
      setToDate("");
      setPdfFile(null);
    } catch (error) {
      console.error("Error submitting leave request:", error);
      setSubmissionMessage("Failed to submit leave request: " + error.message);
      toast.error("Failed to submit leave request: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async () => {
    if (!email) return;
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
          currentStatus: attendanceStatus || "N/A",
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
      pdf.text(`• Current Status: ${attendanceStatus}`, 20, 133);
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
    const currentDate = new Date(startDate);
    const monthName = currentDate.toLocaleString("default", { month: "long" });
    const holidays = holidays2025[monthName] || [];

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dateString = currentDate.toLocaleString("default", {
        month: "long",
        day: "numeric",
      });
      const isHoliday = holidays.some((h) => h.date === dateString);

      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(currentMonth.getMonth() + 1);
    setCurrentMonth(nextMonth);
  };

  const handlePrevMonth = () => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(currentMonth.getMonth() - 1);
    setCurrentMonth(prevMonth);
  };

  const getCurrentMonthHolidays = () => {
    const monthName = currentMonth.toLocaleString("default", { month: "long" });
    return holidays2025[monthName] || [];
  };

  if (loading) return <div>Loading...</div>;
  if (!isLoggedIn) return null;

  const today = new Date();
  const currentDate = today.toLocaleDateString("default", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="dashboard">
      <ToastContainer />
      <header className="dashboard-header">
        <h1>Employee Dashboard</h1>
        <p>Welcome, {email.split("@")[0]}</p>
      </header>

      <section className="dashboard-pie-chart">
        <h2>Leave Requests Overview</h2>
        <svg
          className="bar-chart"
          width="400"
          height="250"
          viewBox="0 0 400 250"
        >
          <line
            x1="50"
            y1="20"
            x2="50"
            y2="200"
            stroke="#e0e0e0"
            strokeWidth="1"
          />
          <line
            x1="150"
            y1="20"
            x2="150"
            y2="200"
            stroke="#e0e0e0"
            strokeWidth="1"
          />
          <line
            x1="250"
            y1="20"
            x2="250"
            y2="200"
            stroke="#e0e0e0"
            strokeWidth="1"
          />
          <line
            x1="350"
            y1="20"
            x2="350"
            y2="200"
            stroke="#e0e0e0"
            strokeWidth="1"
          />
          <line
            x1="50"
            y1="50"
            x2="350"
            y2="50"
            stroke="#e0e0e0"
            strokeWidth="1"
          />
          <line
            x1="50"
            y1="100"
            x2="350"
            y2="100"
            stroke="#e0e0e0"
            strokeWidth="1"
          />
          <line
            x1="50"
            y1="150"
            x2="350"
            y2="150"
            stroke="#e0e0e0"
            strokeWidth="1"
          />
          <line
            x1="50"
            y1="200"
            x2="350"
            y2="200"
            stroke="#000000"
            strokeWidth="2"
          />
          <line
            x1="50"
            y1="20"
            x2="50"
            y2="200"
            stroke="#000000"
            strokeWidth="2"
          />
          {animatePie && (
            <>
              <rect
                x="100"
                y={
                  200 -
                  (leaveStats.approved / Math.max(leaveStats.total, 1)) * 150
                }
                width="50"
                height={
                  (leaveStats.approved / Math.max(leaveStats.total, 1)) * 150
                }
                fill="#000000"
                className="bar-segment"
              />
              <rect
                x="200"
                y={
                  200 -
                  (leaveStats.pending / Math.max(leaveStats.total, 1)) * 150
                }
                width="50"
                height={
                  (leaveStats.pending / Math.max(leaveStats.total, 1)) * 150
                }
                fill="#666666"
                className="bar-segment"
              />
              <rect
                x="300"
                y={
                  200 - (leaveStats.total / Math.max(leaveStats.total, 1)) * 150
                }
                width="50"
                height={
                  (leaveStats.total / Math.max(leaveStats.total, 1)) * 150
                }
                fill="#333333"
                className="bar-segment"
              />
              <text
                x="125"
                y="220"
                textAnchor="middle"
                fill="#000000"
                fontSize="14"
                fontWeight="bold"
              >
                Approved
              </text>
              <text
                x="125"
                y="235"
                textAnchor="middle"
                fill="#000000"
                fontSize="14"
              >
                {leaveStats.approved}
              </text>
              <text
                x="225"
                y="220"
                textAnchor="middle"
                fill="#000000"
                fontSize="14"
                fontWeight="bold"
              >
                Pending
              </text>
              <text
                x="225"
                y="235"
                textAnchor="middle"
                fill="#000000"
                fontSize="14"
              >
                {leaveStats.pending}
              </text>
              <text
                x="325"
                y="220"
                textAnchor="middle"
                fill="#000000"
                fontSize="14"
                fontWeight="bold"
              >
                Total
              </text>
              <text
                x="325"
                y="235"
                textAnchor="middle"
                fill="#000000"
                fontSize="14"
              >
                {leaveStats.total}
              </text>
              <text
                x="45"
                y="200"
                textAnchor="end"
                fill="#000000"
                fontSize="12"
              >
                0
              </text>
              <text
                x="45"
                y="150"
                textAnchor="end"
                fill="#000000"
                fontSize="12"
              >
                25%
              </text>
              <text
                x="45"
                y="100"
                textAnchor="end"
                fill="#000000"
                fontSize="12"
              >
                50%
              </text>
              <text x="45" y="50" textAnchor="end" fill="#000000" fontSize="12">
                75%
              </text>
              <text x="45" y="20" textAnchor="end" fill="#000000" fontSize="12">
                100%
              </text>
            </>
          )}
        </svg>
      </section>

      <main className="dashboard-content">
        <section className="dashboard-section attendance">
          <h2>Attendance Tracking</h2>
          <div className="attendance-info">
            <p>Date: {currentDate}</p>
            <p>
              Today's Status: <span className="status">{attendanceStatus}</span>
            </p>
            <p>Last Check-In: {lastCheckIn}</p>
            <p>Work Hours: {workHours}</p>
            <p>Remark: {remark}</p>
            <p>
              Shift: {shift.start} - {shift.end}
            </p>
            <button
              className="dashboard-button"
              onClick={handleCheckInOut}
              disabled={isLoading || role !== "employee"}
              aria-label={
                attendanceStatus === "Checked In" ? "Check Out" : "Check In"
              }
            >
              {isLoading
                ? "Updating..."
                : attendanceStatus === "Checked In"
                ? "Check Out"
                : "Check In"}
            </button>
          </div>
        </section>

        <section className="dashboard-section leave-request">
          <h2>Submit Leave Request</h2>
          <form onSubmit={handleLeaveSubmit} className="leave-form">
            <label htmlFor="reason">Reason:</label>
            <input
              type="text"
              id="reason"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="e.g., Vacation, Sick Leave"
              required
              disabled={role !== "employee" || isLoading}
            />
            <label htmlFor="from-date">From Date:</label>
            <input
              type="date"
              id="from-date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
              disabled={role !== "employee" || isLoading}
            />
            <label htmlFor="to-date">To Date:</label>
            <input
              type="date"
              id="to-date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
              disabled={role !== "employee" || isLoading}
            />
            <label htmlFor="pdf-upload">Upload PDF Form (Max 2MB):</label>
            <input
              type="file"
              id="pdf-upload"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files[0])}
              disabled={role !== "employee" || isLoading}
            />
            <button
              type="submit"
              className="dashboard-button"
              disabled={role !== "employee" || isLoading}
            >
              {isLoading ? "Submitting..." : "Submit Request"}
            </button>
          </form>
          {submissionMessage && (
            <p className="submission-message">{submissionMessage}</p>
          )}
          <div className="leave-status">
            <p>Pending Requests: {pendingLeaveCount}</p>
            <p>Approved Requests: {approvedLeaveCount}</p>
            <p>Denied Requests: {leaveStats.total-(leaveStats.approved+leaveStats.pending)}</p>
          </div>
        </section>

        <section className="dashboard-section holidays">
          <h2>
            Upcoming Holidays -{" "}
            {currentMonth.toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="holidays-content">
            {getCurrentMonthHolidays().length > 0 ? (
              <ul>
                {getCurrentMonthHolidays().map((holiday, index) => (
                  <li key={index}>
                    {holiday.date}: {holiday.name}{" "}
                    {holiday.name.includes("(Tentative)") ? "(Tentative)" : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No holidays this month.</p>
            )}
            <div className="month-navigation">
              <button
                className="dashboard-button"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
              >
                Previous Month
              </button>
              <button
                className="dashboard-button"
                onClick={handleNextMonth}
                aria-label="Next Month"
              >
                Next Month
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-section reports">
          <h2>Reports Generation</h2>
          <div className="reports-content">
            <button
              className="dashboard-button"
              onClick={generateReport}
              disabled={isLoading}
              aria-label="Generate My Report"
            >
              {isLoading ? "Generating..." : "Generate My Report"}
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EmployeeDashboard;