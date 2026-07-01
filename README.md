# GCU Library Management System

Welcome to the GCU Library Management System! This is a comprehensive, modern library platform built specifically for Garden City University to handle all library operations including OPAC, Circulation, Book Management, Fine Tracking, and Reservations.

## Features

- **OPAC (Online Public Access Catalog)**: Allows students and faculty to search, filter, and view the entire library catalog.
- **Circulation Management**: Librarians can easily issue, return, and renew books through an intuitive interface.
- **Role-Based Access Control**: Secure login and dashboards for Admins, Librarians, Faculty, and Students.
- **Analytics & Reports**: Real-time charts and data visualizations for tracking book issues, available collection, and overdue records.
- **Overdue & Fine Tracking**: Automated tracking of overdue books and fine calculations.
- **Reservations**: Students and faculty can reserve books when they are out of stock.

## Technology Stack

This project is built with a modern web development stack:

- **Frontend Framework**: React with Vite and TypeScript
- **UI Components**: Tailwind CSS and shadcn-ui for a beautiful, responsive design
- **Backend & Database**: Supabase (PostgreSQL, Auth, and Storage)
- **State Management & Routing**: React Router
- **Icons**: Lucide React

## Local Development Setup

To run this project locally, you must connect the app to your Supabase project.

### 1. Environment Variables
Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 2. Database Schema
Run the SQL schema provided in `supabase_setup.sql` in your Supabase SQL Editor to create the necessary tables, functions, and triggers.

*Note: For the OPAC catalog and book duplicates, additional optimization scripts (like `optimize_opac_catalog.sql`) may be required depending on your dataset.*

### 3. Create Default Admin/Librarian Accounts
You must create the default admin and librarian accounts in Supabase Auth to access the dashboard. Do not run `SELECT auth.create_user(...)` in the SQL Editor. Instead, use the provided seed script:

```sh
npm run seed:users -- <SUPABASE_URL> <SERVICE_ROLE_KEY>
```

Example:
```sh
npm run seed:users -- https://abcxyz.supabase.co eyJ...service_role_key...
```
*(Get the `SERVICE_ROLE_KEY` from Supabase Dashboard -> Project Settings -> API -> `service_role`.)*

Default Credentials:
- Admin: `admin@gcu.edu.in` / `admin123`
- Librarian: `librarian@gcu.edu.in` / `lib123`

### 4. Start the Application
Make sure you have Node.js installed, then run:

```sh
# Install dependencies
npm install

# Start the development server
npm run dev
```
