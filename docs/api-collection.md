# Schedula API Collection

## Base URL
- Local: http://localhost:3001
- Production: https://schedula-backend-production-d6f8.up.railway.app

---

## 🔐 Authentication

### Signup
POST /auth/signup
Body:
```json
{
  "name": "Dr. Sara",
  "email": "sara@test.com",
  "password": "password123",
  "role": "DOCTOR"
}
```

### Login
POST /auth/login
Body:
```json
{
  "email": "sara@test.com",
  "password": "password123"
}
```

---

## 👨‍⚕️ Doctor Profile

### Create Doctor Profile
POST /doctor/profile
Auth: Bearer Token
Body:
```json
{
  "fullName": "Dr. Sara",
  "specialization": "Dermatologist",
  "experience": 8,
  "qualification": "MBBS, MD",
  "consultationFee": 400,
  "availability": "Mon-Fri",
  "isAvailable": true
}
```

### Get Doctor Profile
GET /doctor/profile
Auth: Bearer Token

### Update Doctor Profile
PATCH /doctor/profile
Auth: Bearer Token
Body:
```json
{
  "consultationFee": 500
}
```

---

## 🔍 Doctor Discovery

### Get All Doctors
GET /doctor

### Filter by Specialization
GET /doctor?specialization=Cardiologist

### Search by Name
GET /doctor?search=sara

### Pagination
GET /doctor?page=1&limit=5

### Get Doctor by ID
GET /doctor/1

---

## 📅 Doctor Availability

### Create Recurring Availability
POST /doctor/availability
Auth: Bearer Token
Body:
```json
{
  "dayOfWeek": "Monday",
  "startTime": "10:00",
  "endTime": "12:00"
}
```

### Get Recurring Availability
GET /doctor/availability
Auth: Bearer Token

### Update Availability
PATCH /doctor/availability/1
Auth: Bearer Token
Body:
```json
{
  "dayOfWeek": "Monday",
  "startTime": "09:00",
  "endTime": "12:00"
}
```

### Delete Availability
DELETE /doctor/availability/1
Auth: Bearer Token

### Custom Date Override
POST /doctor/availability/override
Auth: Bearer Token
Body:
```json
{
  "date": "2026-06-22",
  "startTime": "14:00",
  "endTime": "16:00"
}
```

### Get Availability by Date
GET /doctor/availability/date?date=2026-06-22
Auth: Bearer Token

---

## ⏰ Slot Generation

### Get Stream Slots
GET /doctor/1/stream-slots?date=2026-06-22&duration=30

### Get Wave Slots
GET /doctor/1/wave-slots?date=2026-06-22

---

## 🌊 Wave Scheduling

### Set Scheduling Type
PATCH /doctor/scheduling-type
Auth: Bearer Token
Body:
```json
{
  "schedulingType": "WAVE"
}
```

### Create Wave Schedule
POST /doctor/wave-schedule
Auth: Bearer Token
Body:
```json
{
  "dayOfWeek": "Monday",
  "startTime": "10:00",
  "endTime": "11:00",
  "maxPatients": 5
}
```

### Get Wave Schedule
GET /doctor/wave-schedule
Auth: Bearer Token

---

## 🧑‍🤝‍🧑 Patient Profile

### Create Patient Profile
POST /patient/profile
Auth: Bearer Token
Body:
```json
{
  "fullName": "Geetha",
  "age": 30,
  "gender": "Female",
  "contactDetails": "9876543210",
  "address": "Madurai, Tamil Nadu"
}
```

### Get Patient Profile
GET /patient/profile
Auth: Bearer Token

### Update Patient Profile
PATCH /patient/profile
Auth: Bearer Token
Body:
```json
{
  "address": "Chennai, Tamil Nadu"
}
```

---

## 📋 Appointments

### Book Appointment
POST /appointment
Auth: Bearer Token (Patient)
Body:
```json
{
  "doctorId": 1,
  "date": "2026-06-22",
  "startTime": "10:00",
  "endTime": "10:30"
}
```

### Get My Appointments
GET /appointment/my
Auth: Bearer Token (Patient)

### Cancel Appointment
PATCH /appointment/1/cancel
Auth: Bearer Token (Patient)

### Reschedule Appointment
PATCH /appointment/1/reschedule
Auth: Bearer Token (Patient)
Body:
```json
{
  "doctorId": 1,
  "date": "2026-06-29",
  "startTime": "11:00",
  "endTime": "11:30"
}
```

### Doctor View Appointments
GET /doctor/appointments
Auth: Bearer Token (Doctor)