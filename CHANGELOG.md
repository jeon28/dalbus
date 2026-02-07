# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-02-08

### Added
- **Admin Dashboard**:
  - Implemented secure Order History view bypassing RLS safely.
  - Added Member List view (`/admin/members`) to see all registered users.
  - Added Service Management (`/admin/services`) for CRUD operations on Products and Plans.
  - Added Q&A Management (`/admin/qna`) for answering user inquiries.
- **Q&A Feature**:
  - Public Q&A Board (`/public/qna`) accessible to both Members and Guests.
  - Guest support with Name/Password authentication for post management.
  - Secret post functionality (visible only to author and admin).
  - Admin answer capability.
- **Database**:
  - Added `qna` table for storing inquiries and answers.
  - Added RLS policies for `qna` table.
  - Added `supabaseAdmin` client for secure server-side operations.

### Changed
- **Navigation**:
  - Updated Header to include links for Q&A and Admin features.
  - Admin links are conditionally rendered based on admin status.
- **Security**:
  - Removed `localStorage` persistence for Admin login to enhance security (session-based).
- **Fixes**:
  - Fixed CSS regression on landing page.
  - Fixed various build errors and port conflicts.
