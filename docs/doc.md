# Gym Offline React Native Application

## 1. Project Overview

A basic **offline Gym Management mobile application** built using React Native and Expo.

The application will work without an internet connection and store all gym data locally using SQLite.

### Main Purpose

The application will allow the gym administrator to:

- Login to the application
- Add gym members
- Store member personal details
- Capture/select member profile image
- View member details
- Edit member details
- Delete members
- Search members
- List all members
- Track membership start and end dates
- Identify active and expired memberships

---

# 2. Technology Stack

| Technology        | Purpose                          |
| ----------------- | -------------------------------- |
| React Native      | Mobile application               |
| Expo              | Development and testing          |
| TypeScript        | Application language             |
| Expo SQLite       | Offline local database           |
| Expo Image Picker | Member image selection/camera    |
| Expo File System  | Local image storage              |
| React Navigation  | Application navigation           |
| Zustand           | Authentication/application state |
| React Hook Form   | Form management                  |
| Zod               | Form validation                  |

### Development

The application can initially be tested using:

```bash
npx expo start
```

and **Expo Go** on an Android phone.

Android Studio is not required for the initial development/testing workflow.

---

# 3. Application Architecture

```text
                    GYM MOBILE APP
                          |
              +-----------+-----------+
              |                       |
            Login                  Dashboard
                                      |
                                      |
                                Member Management
                                      |
                  +-------------------+-------------------+
                  |                   |                   |
               Add Member        Member List        Member Details
                  |                   |                   |
                  |                   |              Edit / Delete
                  |                   |
                  +--------- SQLite --+
                              |
                       Local Database
                              |
                    +---------+---------+
                    |                   |
                  users              members
                    |
              Local Images
```

---

# 4. Offline Requirement

The application must work without internet access.

## Offline Operations

The following operations must work completely offline:

- Login
- Add member
- View member
- Edit member
- Delete member
- Search member
- Member listing
- Member image viewing
- Membership status calculation
- Dashboard member statistics

No API or backend is required for V1.

## Membership Expiry Notifications

On Android and iOS, the app uses local notifications so expiry reminders work offline:

- Notify the administrator at 9:00 AM, seven days before a member's end date.
- Notify the administrator at 9:00 AM, the day after a member's end date.
- If a member is already expiring soon or expired, show one summary notification per day when the app is opened or returns to the foreground.
- Tapping a reminder opens the relevant member details or member list.

The app requests notification permission on startup. Notifications require a native app build; remote push notifications and a notification server are not part of this offline V1.

## WhatsApp Membership Reminders

The member list provides a WhatsApp reminder action for expired memberships and memberships expiring within seven days. Before opening WhatsApp, the administrator can edit the prefilled renewal message. The administrator reviews and sends it manually. Ten-digit local Indian mobile numbers are sent with the `+91` country code. Other international numbers should include their country code.

## Data Backup and Restore

The dashboard can save a JSON backup containing all member records and their profile photos to a user-selected device folder on Android, or open the system save/share sheet on iOS. A separate Share Backup action lets the administrator send or store the backup elsewhere.

Restore accepts GymApp backup files and validates the complete file before making changes. After reviewing the member count, the administrator must confirm replacement. Restore replaces all current member records and profile photos, while preserving the local admin login. A database transaction protects the existing records if the import fails.

---

# 5. Login Module

## Requirement

There will be only **one admin login** initially.

### Default Admin

```text
Username: admin
Password: admin123
```

The user account will be stored in SQLite.

## Login Flow

```text
Application Start
       |
       v
Initialize SQLite
       |
       v
Check Admin User
       |
       v
Login Screen
       |
       +---- Invalid ----> Error Message
       |
       +---- Valid ------> Dashboard
```

## Login Fields

### Username

```text
Required
```

### Password

```text
Required
```

## Validation

- Username cannot be empty
- Password cannot be empty
- Invalid credentials should show an error
- Successful login opens Dashboard

---

# 6. Dashboard

The dashboard will provide a basic overview.

## Dashboard Information

```text
Total Members
Active Members
Expired Members
Expiring Soon
```

Example:

```text
+-------------------+  +-------------------+
|   Total Members   |  |   Active Members  |
|        125        |  |         98        |
+-------------------+  +-------------------+

+-------------------+  +-------------------+
|     Expired       |  |   Expiring Soon   |
|        27         |  |          8        |
+-------------------+  +-------------------+

             + Add Member
```

All statistics will be calculated from SQLite.

---

# 7. Member Management

The main feature of the application is member management.

The administrator must be able to:

```text
Create Member
View Member
Edit Member
Delete Member
Search Member
List Members
```

---

# 8. Member Details

Each member should contain the following information.

## Required Fields

| Field           | Required |
| --------------- | -------- |
| Member Code     | Yes      |
| Full Name       | Yes      |
| Mobile Number   | Yes      |
| Membership Plan | Yes      |
| Start Date      | Yes      |
| End Date        | Yes      |

## Optional Fields

| Field             | Required |
| ----------------- | -------- |
| Profile Image     | No       |
| Email             | No       |
| Gender            | No       |
| Date of Birth     | No       |
| Height (cm)       | No       |
| Weight (kg)       | No       |
| Blood Group       | No       |
| Address           | No       |
| Amount            | No       |
| Emergency Contact | No       |
| Notes             | No       |

---

# 9. Member Form

The Add Member screen should contain:

```text
+--------------------------------+
|          Add Member            |
+--------------------------------+

          [ Profile Image ]

          [ Add Photo ]

Member Name *
+------------------------------+
|                              |
+------------------------------+

Mobile Number *
+------------------------------+
|                              |
+------------------------------+

Email
+------------------------------+
|                              |
+------------------------------+

Gender
+------------------------------+
| Male                    ▼    |
+------------------------------+

Date of Birth
+------------------------------+
| DD/MM/YYYY                   |
+------------------------------+

Membership Plan *
+------------------------------+
| Monthly / Quarterly / Yearly |
+------------------------------+

Start Date *
+------------------------------+
| DD/MM/YYYY                   |
+------------------------------+

End Date *
+------------------------------+
| DD/MM/YYYY                   |
+------------------------------+

Amount
+------------------------------+
|                              |
+------------------------------+

Emergency Contact
+------------------------------+
|                              |
+------------------------------+

Address
+------------------------------+
|                              |
|                              |
+------------------------------+

Notes
+------------------------------+
|                              |
|                              |
+------------------------------+

          [ SAVE MEMBER ]
```

---

# 10. Member Profile Image

Each member can have a profile image.

## Image Options

The user should be able to:

```text
Add Photo
   |
   +---- Camera
   |
   +---- Gallery
```

The application will use:

```text
expo-image-picker
```

---

# 11. Image Storage

The actual image should **not** be stored inside SQLite.

Instead:

```text
Phone Storage
     |
     +-- gym/
          |
          +-- members/
               |
               +-- GYM0001.jpg
               +-- GYM0002.jpg
               +-- GYM0003.jpg
```

SQLite stores only the path:

```text
image_path
```

Example:

```text
gym/members/GYM0001.jpg
```

## Image Flow

```text
User selects image
        |
        v
Image Picker
        |
        v
Copy image to application storage
        |
        v
Save image path in SQLite
        |
        v
Display image in Member List/Details
```

---

# 12. Member Code

Every member should have a unique member code.

Example:

```text
GYM0001
GYM0002
GYM0003
GYM0004
```

The application should automatically generate the next member code.

Example:

```text
Existing Members: 25

Next Member:
GYM0026
```

---

# 13. SQLite Database

Database name:

```text
gym.db
```

---

# 14. Users Table

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TEXT NOT NULL
);
```

Example:

```text
id: 1
username: admin
password: admin123
name: Gym Admin
role: admin
```

> Plain-text password storage is acceptable only for the initial prototype. Production authentication should use secure password handling.

---

# 15. Members Table

```sql
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    member_code TEXT UNIQUE NOT NULL,

    name TEXT NOT NULL,

    phone TEXT NOT NULL,

    email TEXT,

    gender TEXT,

    date_of_birth TEXT,

    address TEXT,

    membership_plan TEXT,

    start_date TEXT,

    end_date TEXT,

    amount REAL DEFAULT 0,

    emergency_contact TEXT,

    image_path TEXT,

    notes TEXT,

    created_at TEXT NOT NULL,

    updated_at TEXT NOT NULL
);
```

---

# 16. Member TypeScript Interface

```typescript
export interface Member {
  id: number;

  member_code: string;

  name: string;

  phone: string;

  email?: string;

  gender?: string;

  date_of_birth?: string;

  address?: string;

  membership_plan?: string;

  start_date?: string;

  end_date?: string;

  amount: number;

  emergency_contact?: string;

  image_path?: string;

  notes?: string;

  created_at: string;

  updated_at: string;
}
```

---

# 17. Member List

The Member List screen should show all members.

Example:

```text
Members                              [+]

[ Search members... ]

---------------------------------------

[PHOTO]  Ajay Kumar
         9876543210
         Monthly
         Active

---------------------------------------

[PHOTO]  Rahul Patil
         9988776655
         Quarterly
         Active

---------------------------------------

[PHOTO]  Suresh Kumar
         8877665544
         Monthly
         Expired

---------------------------------------
```

---

# 18. Member Card

Each member card should display:

```text
Profile Image
Member Name
Mobile Number
Membership Plan
Membership Status
End Date
```

Example:

```text
+------------------------------------+
| [PHOTO]  Ajay Kumar                |
|          GYM0001                   |
|          9876543210                |
|          Monthly                   |
|          Active                    |
|          Ends: 31 Oct 2026         |
+------------------------------------+
```

---

# 19. Member Search

Search should work offline using SQLite.

Search by:

```text
Member Name
Mobile Number
Member Code
```

Example:

```text
Search: Ajay

Result:

Ajay Kumar
Ajay Patil
Ajay Sharma
```

---

# 20. Member Details Screen

When the administrator taps a member:

```text
+--------------------------------+
|          Member Details        |
+--------------------------------+

             [ PHOTO ]

          Ajay Kumar
            GYM0001

--------------------------------

Mobile
9876543210

Email
ajay@example.com

Gender
Male

Date of Birth
15/05/1998

Membership
Monthly

Start Date
01/10/2026

End Date
31/10/2026

Amount
₹1500

Emergency Contact
9876500000

Address
Belgaum

Notes
Regular member

--------------------------------

[ EDIT MEMBER ]

[ DELETE MEMBER ]
```

---

# 21. Edit Member

The Edit Member screen should use the same fields as Add Member.

Flow:

```text
Member Details
      |
      v
Edit Member
      |
      v
Update Form
      |
      v
Validate
      |
      v
SQLite UPDATE
      |
      v
Member Details
```

---

# 22. Delete Member

When deleting a member, show confirmation:

```text
Delete Member?

Are you sure you want to delete Ajay Kumar?

[ Cancel ]       [ Delete ]
```

If confirmed:

```text
SQLite DELETE
      |
      v
Delete local profile image
      |
      v
Refresh member list
```

---

# 23. Membership Status

Membership status should be calculated from `end_date`.

## Active

```text
Current Date <= End Date
```

Result:

```text
ACTIVE
```

## Expired

```text
Current Date > End Date
```

Result:

```text
EXPIRED
```

The status does not need to be stored in SQLite.

This prevents incorrect status values.

---

# 24. Expiring Soon

The dashboard can identify memberships that will expire soon.

Example rule:

```text
End date within next 7 days
```

Example:

```text
Today: 08 Oct 2026

Member End Date: 12 Oct 2026

Remaining: 4 days

Status:
EXPIRING SOON
```

---

# 25. Repository Architecture

SQL queries should not be written directly inside React screens.

Use:

```text
Screen
   |
   v
Service
   |
   v
Repository
   |
   v
SQLite
```

Example:

```text
MemberListScreen
       |
       v
memberService
       |
       v
memberRepository
       |
       v
SQLite
```

---

# 26. Member Repository Functions

Create:

```typescript
createMember();
```

Create a new member.

```typescript
getMembers();
```

Get all members.

```typescript
getMemberById();
```

Get one member.

```typescript
updateMember();
```

Update member information.

```typescript
deleteMember();
```

Delete member.

```typescript
searchMembers();
```

Search members.

---

# 27. Recommended Folder Structure

```text
gym-app/
│
├── App.tsx
│
├── src/
│   │
│   ├── components/
│   │   ├── AppButton.tsx
│   │   ├── AppInput.tsx
│   │   ├── MemberCard.tsx
│   │   └── SearchBar.tsx
│   │
│   ├── database/
│   │   ├── database.ts
│   │   ├── userRepository.ts
│   │   └── memberRepository.ts
│   │
│   ├── navigation/
│   │   ├── index.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── AppNavigator.tsx
│   │
│   ├── screens/
│   │   │
│   │   ├── Login/
│   │   │   └── LoginScreen.tsx
│   │   │
│   │   ├── Dashboard/
│   │   │   └── DashboardScreen.tsx
│   │   │
│   │   └── Members/
│   │       ├── MemberListScreen.tsx
│   │       ├── AddMemberScreen.tsx
│   │       ├── MemberDetailsScreen.tsx
│   │       └── EditMemberScreen.tsx
│   │
│   ├── services/
│   │   └── memberService.ts
│   │
│   ├── store/
│   │   └── authStore.ts
│   │
│   ├── types/
│   │   └── member.ts
│   │
│   ├── utils/
│   │   ├── date.ts
│   │   ├── image.ts
│   │   └── memberCode.ts
│   │
│   └── constants/
│       └── app.ts
│
├── assets/
│
├── app.json
├── package.json
└── tsconfig.json
```

---

# 28. Required Packages

```bash
npx expo install expo-sqlite
```

```bash
npx expo install expo-image-picker
```

```bash
npx expo install expo-file-system
```

```bash
npm install @react-navigation/native @react-navigation/native-stack
```

```bash
npx expo install react-native-screens react-native-safe-area-context
```

```bash
npm install zustand
```

```bash
npm install react-hook-form zod @hookform/resolvers
```

---

# 29. Development Phases

## Phase 1 — Project Setup

- Create Expo project
- Configure TypeScript
- Install packages
- Test using Expo Go

## Phase 2 — Authentication

- SQLite initialization
- Users table
- Admin user
- Login screen
- Login validation
- Logout

## Phase 3 — Member Database

- Members table
- Member TypeScript interface
- Member repository
- Create member
- Read member
- Update member
- Delete member

## Phase 4 — Member UI

- Member List
- Member Card
- Add Member
- Member Details
- Edit Member
- Delete Member
- Search

## Phase 5 — Images

- Camera
- Gallery
- Local image storage
- Image path in SQLite
- Display member image

## Phase 6 — Dashboard

- Total members
- Active members
- Expired members
- Expiring soon

## Phase 7 — Testing

- Offline testing
- SQLite persistence
- Image persistence
- Add/Edit/Delete testing
- Search testing
- Date/status testing
- App restart testing

---

# 30. V1 Feature Checklist

## Authentication

- [ ] Login screen
- [ ] Username
- [ ] Password
- [ ] SQLite users table
- [ ] Admin user
- [ ] Login validation
- [ ] Logout

## Dashboard

- [ ] Total members
- [ ] Active members
- [ ] Expired members
- [ ] Expiring soon
- [ ] Add Member button

## Member

- [ ] Member code
- [ ] Name
- [ ] Mobile
- [ ] Email
- [ ] Gender
- [ ] Date of birth
- [ ] Address
- [ ] Membership plan
- [ ] Start date
- [ ] End date
- [ ] Amount
- [ ] Emergency contact
- [ ] Notes
- [ ] Profile image

## Member Operations

- [ ] Add
- [ ] List
- [ ] Search
- [ ] View details
- [ ] Edit
- [ ] Delete

## Offline

- [ ] SQLite database
- [ ] Local member data
- [ ] Local images
- [ ] Works without internet
- [ ] Data remains after app restart

---

# 31. Future Features

These should **not be implemented in V1**, but the architecture should allow them later.

```text
Members
   |
   +── Membership Plans
   |
   +── Payments
   |
   +── Renewals
   |
   +── Attendance
   |
   +── Workout Plans
   |
   +── Trainer
   |
   +── Body Measurements
   |
   +── Notifications
   |
   +── Reports
   |
   +── Backup
   |
   └── Cloud Synchronization
```

---

# 32. Future Database

Later the database can contain:

```text
users
members
membership_plans
payments
attendance
renewals
measurements
trainers
workout_plans
```

For V1, keep the database simple:

```text
users
members
```

---

# 33. Final V1 Flow

```text
                    START APP
                       |
                       v
                Initialize SQLite
                       |
                       v
                    LOGIN
                       |
                 Valid Login
                       |
                       v
                  DASHBOARD
                       |
             +---------+---------+
             |                   |
             v                   v
       MEMBER LIST           STATISTICS
             |
       +-----+-----+
       |           |
       v           v
     ADD        MEMBER DETAILS
       |           |
       v       +---+---+
     SAVE      |       |
       |       v       v
       |      EDIT   DELETE
       |       |
       +-------+
           |
           v
         SQLite
           |
           v
      Local Storage
           |
           v
      Member Images
```

---

# 34. V1 Goal

The first working version should provide:

> **A simple, fast, completely offline gym member management application where the admin can log in, add a member with a profile image and membership details, store the information in SQLite, search/list members, view details, edit members, and delete members.**

No backend, API, cloud database, payment gateway, or online authentication is required for V1.
