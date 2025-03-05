// src/ReportPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Footer from './Footer';

const ReportPage = () => {
  const { reportId } = useParams();
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) {
        setError('No report ID provided in the URL.');
        setLoading(false);
        return;
      }

      try {
        const reportRef = doc(db, 'reports', reportId);
        const reportSnap = await getDoc(reportRef);

        if (reportSnap.exists()) {
          const data = reportSnap.data();
          console.log("Fetched report from Firestore:", data);
          setReportData(data);
        } else {
          setError('Report not found in Firestore.');
        }
      } catch (err) {
        console.error("Error fetching report from Firestore:", err);
        setError('Error fetching report: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="report-page">
        <header className="report-header">
          <h1>Loading...</h1>
        </header>
        <main className="report-content">
          <p>Loading report data...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-page">
        <header className="report-header">
          <h1>Error</h1>
        </header>
        <main className="report-content">
          <p>{error}</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="report-page">
        <header className="report-header">
          <h1>No Report Available</h1>
        </header>
        <main className="report-content">
          <p>No report data available. Please generate a report first.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const isAdminReport = reportData.reportType === 'admin';
  console.log("Rendering report, isAdminReport:", isAdminReport);

  return (
    <div className="report-page">
      <header className="report-header">
        <h1>Generated Report</h1>
      </header>
      <main className="report-content">
        <div className="report-details">
          <h3>{isAdminReport ? 'Admin Report' : 'Employee Report'}</h3>
          <p><strong>Generated:</strong> {reportData.generatedAt || 'N/A'}</p>
          <p><strong>Email:</strong> {reportData.employeeEmail || 'N/A'}</p>
          
          {isAdminReport ? (
            <>
              <h4>Admin Metrics</h4>
              <p>Total Employees: {reportData.totalEmployees || 0}</p>
              <p>Present Today: {reportData.presentToday || 0}</p>
              
              <h4>Leave Statistics</h4>
              <p>Pending Requests: {reportData.leaveStats?.pending || 0}</p>
              <p>Approved Requests: {reportData.leaveStats?.approved || 0}</p>
              <p>Denied Requests: {reportData.leaveStats?.denied || 0}</p>
              <h5>Recent Leave Requests:</h5>
              {reportData.leaveStats && reportData.leaveStats.recentLeaves && reportData.leaveStats.recentLeaves.length > 0 ? (
                <ul>
                  {reportData.leaveStats.recentLeaves.map(request => (
                    <li key={request.id}>
                      {request.employee || 'N/A'} - {request.reason || 'N/A'} ({request.status || 'N/A'})
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No recent leave requests</p>
              )}

              <h4>Office Occupancy Trends (Week)</h4>
              {reportData.occupancyTrends ? (
                <ul>
                  {Object.entries(reportData.occupancyTrends).map(([day, percentage]) => (
                    <li key={day}>{day}: {percentage}%</li>
                  ))}
                </ul>
              ) : (
                <p>No occupancy trends available</p>
              )}
            </>
          ) : (
            <>
              <h4>Leave Statistics</h4>
              <p>Total Requests: {reportData.leaveStats?.total || 0}</p>
              <p>Pending: {reportData.leaveStats?.pending || 0}</p>
              <p>Approved: {reportData.leaveStats?.approved || 0}</p>
              <h5>Recent Leave Requests:</h5>
              {reportData.leaveStats && reportData.leaveStats.recentLeaves && reportData.leaveStats.recentLeaves.length > 0 ? (
                <ul>
                  {reportData.leaveStats.recentLeaves.map(leave => (
                    <li key={leave.id}>
                      {leave.submittedAt || 'N/A'} - {leave.reason || 'N/A'} ({leave.status || 'N/A'})
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No recent leave requests</p>
              )}

              <h4>Attendance Details</h4>
              <p>Current Status: {reportData.attendance?.currentStatus || 'N/A'}</p>
              <p>Last Check-In: {reportData.attendance?.lastCheckIn || 'N/A'}</p>
              <p>Last Check-Out: {reportData.attendance?.lastCheckOut || 'N/A'}</p>
              <p>Working Days This Month: {reportData.attendance?.monthlyWorkingDays || 0}</p>
              <p>Days Present: {reportData.attendance?.daysPresent || 0}</p>

              <h4>Performance Metrics</h4>
              <p>Attendance Rate: {reportData.performance?.attendanceRate || '0.00'}%</p>
              <p>Leave Utilization: {reportData.performance?.leaveUtilization || '0.00'}%</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ReportPage;