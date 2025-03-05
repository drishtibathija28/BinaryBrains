import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

// Hardcoded announcements data
const announcementsData = [
  {
    id: 1,
    title: "Office Closed for Holi",
    message: "The office will be closed on March 14th for Holi celebrations. Enjoy the festival with your loved ones!",
    createdAt: new Date("2025-03-04T10:30:00"),
    priority: "high",
  },
  {
    id: 2,
    title: "Monthly Team Meeting",
    message: "The monthly team meeting is scheduled for March 10th at 10 AM in the main conference room.",
    createdAt: new Date("2025-03-03T09:00:00"),
    priority: "medium",
  },
  {
    id: 3,
    title: "Reminder: Submit Timesheets",
    message: "Please submit your timesheets by the end of the week to ensure timely payroll processing.",
    createdAt: new Date("2025-03-02T14:00:00"),
    priority: "low",
  },
  {
    id: 4,
    title: "New Employee Onboarding Session",
    message: "A new employee onboarding session will be held on March 15th at 9 AM for all recent hires.",
    createdAt: new Date("2025-03-01T11:00:00"),
    priority: "medium",
  },
];

const AnnouncementsPage = () => {
  return (
    <div className="dashboard">
      <Navbar />
      <section className="announcements">
        <h1>Important Announcements</h1>
        <div className="announcements-list">
          {announcementsData.length === 0 ? (
            <p>No announcements available at the moment.</p>
          ) : (
            announcementsData.map((announcement) => (
              <div
                key={announcement.id}
                className={`announcement-item priority-${announcement.priority}`}
              >
                <h3>{announcement.title}</h3>
                <p className="announcement-message">{announcement.message}</p>
                <p className="announcement-meta">
                  Posted on: {announcement.createdAt.toLocaleString()}
                </p>
                <p className="announcement-priority">
                  Priority: {announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
      <Footer />

      {/* Inline CSS for styling */}
      <style jsx>{`
        .announcements {
          padding: 40px 20px;
          max-width: 900px;
          margin: 0 auto;
        }

        .announcements h1 {
          text-align: center;
          font-size: 2.5rem;
          margin-bottom: 30px;
          color: #333;
        }

        .announcements-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .announcement-item {
          background-color: #f9f9f9;
          border-left: 5px solid;
          padding: 20px;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease;
        }

        .announcement-item:hover {
          transform: translateY(-3px);
        }

        /* Priority-based border colors */
        .announcement-item.priority-high {
          border-left-color: #e74c3c; /* Red for high priority */
        }

        .announcement-item.priority-medium {
          border-left-color: #f39c12; /* Orange for medium priority */
        }

        .announcement-item.priority-low {
          border-left-color: #3498db; /* Blue for low priority */
        }

        .announcement-item h3 {
          font-size: 1.5rem;
          margin-bottom: 10px;
          color: #222;
        }

        .announcement-message {
          font-size: 1rem;
          color: #555;
          margin-bottom: 10px;
          line-height: 1.6;
        }

        .announcement-meta {
          font-size: 0.9rem;
          color: #888;
          margin-bottom: 5px;
        }

        .announcement-priority {
          font-size: 0.9rem;
          font-style: italic;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default AnnouncementsPage;