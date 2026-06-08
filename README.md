# Schedula Backend - Role Based Authentication System

##  Overview

This project is part of the Backend Internship Program (Day 2 Task).  
The goal was to implement a **Role-Based Authentication System** using NestJS, JWT, and PostgreSQL.

The system supports two user roles:
- DOCTOR
- PATIENT

Each role has restricted access to specific protected routes.

---

###  Authentication
- User Signup with role selection (Doctor / Patient)
- User Login with JWT token generation
- Password hashing using bcrypt

---

###  Role-Based Authorization
- Implemented JWT authentication using Passport strategy
- Protected routes using AuthGuard
- Custom RolesGuard for role validation
- Access restriction based on user role

---

##  Doctor Access
- `GET /auth/doctor/profile`
- Only users with role **DOCTOR** can access
- PATIENT users are blocked with custom error message

---

##  Patient Access
- `GET /auth/patient/profile`
- Only users with role **PATIENT** can access
- DOCTOR users are blocked with custom error message

---

##  Authentication Flow

1. User signs up with name, email, password, and role
2. Password is hashed using bcrypt
3. User logs in with email & password
4. JWT token is generated with user role
5. Token is used to access protected routes
6. Role is validated using custom guard

---

##  API Testing

All APIs were tested using:
- Thunder Client
- Postman (optional)

### Tested Scenarios:
- Signup as Doctor
- Signup as Patient
- Login and token generation
- Doctor route access control
- Patient route access control
- Unauthorized access handling

---

## 🛠️ Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT (Passport Strategy)
- bcrypt


