# IEEE Dashboard - Automatic Email System

## 🚀 Quick Start

Your dashboard now sends emails **automatically** using your Gmail credentials!

## Stable Long-Term URL (Recommended: Render)

Use Render to host this app with a persistent HTTPS URL that your colleagues can open anytime.

### 1) Push this project to GitHub

1. Create a new repository on GitHub.
2. Push this project code to that repository.
3. Keep `.env` private (it is already ignored by `.gitignore`).

### 2) Create a Render Web Service

1. Log in to Render.
2. Click `New +` -> `Blueprint`.
3. Select your GitHub repository.
4. Render detects `render.yaml` and creates the web service.

### 3) Set required environment variables in Render

Set these variables in Render dashboard for the service:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `GMAIL_USER` (if using Gmail)
- `GMAIL_PASS` (if using Gmail app password)
- `SESSION_SECRET`

Optional:

- `MALWARE_SCAN_REQUIRED=false`
- `S3_SIGNED_URL_EXPIRY=3600`

### 4) Deploy

1. Trigger deployment from Render.
2. Wait until health check `/health` is green.
3. Use the generated Render URL (for example, `https://ieee-dashboard.onrender.com`).

### 5) Share with colleagues

Share the Render URL directly. This is stable and does not depend on your laptop being online.

### How to Start the System

1. **Open a terminal** in this folder
2. **Install dependencies** (one-time setup):
   ```
   npm install
   ```
3. **Start the email service**:
   ```
   npm start
   ```
4. **Open `dashboard.html`** in your browser

### ✅ What Works Now

- **Automatic Email Sending**: No more manual Gmail login required!
- **Real Email Delivery**: Emails are sent directly from jixilann@gmail.com
- **Progress Tracking**: Status automatically updates when emails are sent
- **Professional Email Content**: Includes login credentials and conference details

### 📧 Email Service Details

- **Service Port**: http://localhost:3001
- **Gmail Account**: jixilann@gmail.com  
- **Authentication**: Uses your app password automatically
- **Email Template**: Professional IEEE PCIC invitation with login credentials

### 🎯 How to Send Emails

1. Go to **Send Invitation** in your dashboard
2. Select an author and click **Send Email**
3. Confirm the sending
4. **That's it!** The email is sent automatically

### ✨ Email Features

- **Professional Subject**: "IEEE PCIC- Invitation"
- **Personalized Content**: Uses author's name and paper title
- **Login Credentials**: Includes Paper ID, Username, and Password
- **Conference Details**: Submission guidelines and deadlines
- **Contact Information**: Support email and website

### 🔧 Troubleshooting

If emails don't send:

1. **Check if service is running**: 
   - You should see "IEEE Email Service running on http://localhost:3001"
   
2. **Test the service**: 
   - Visit http://localhost:3001/health in your browser
   - Should show: `{"status":"running","service":"IEEE Email Service","gmail":"jixilann@gmail.com"}`

3. **Restart if needed**:
   ```
   npm start
   ```

## Admin Credentials

Use any of these credentials to log in:

### Admin 1 (Super Admin)
- **Username**: `admin1`
- **Password**: `admin123`
- **Full Name**: John Administrator
- **Role**: Super Admin

### Admin 2 (Project Manager)
- **Username**: `admin2`
- **Password**: `secure456`
- **Full Name**: Sarah Manager
- **Role**: Project Manager

### Admin 3 (Supervisor)
- **Username**: `admin3`
- **Password**: `password789`
- **Full Name**: Mike Supervisor
- **Role**: Supervisor

### Technical Admin
- **Username**: `techAdmin`
- **Password**: `tech2024`
- **Full Name**: Alex Technical
- **Role**: Technical Admin

### IEEE Admin
- **Username**: `ieeeadmin`
- **Password**: `ieee@2024`
- **Full Name**: IEEE Administrator
- **Role**: IEEE Admin

## File Structure

```
IEEE-Project-New-Dashboard/
├── index.html              # Login page
├── dashboard.html          # Main dashboard
├── style.css              # Login page styles
├── dashboard-style.css    # Dashboard styles
├── script.js              # Login functionality
├── dashboard.js           # Dashboard functionality
├── database.js            # Admin database and authentication
└── README.md              # This file
```

## Dashboard Features

- **Statistics Overview**: View key metrics and project statistics
- **Project Management**: Manage active, completed, and pending projects
- **User Management**: View all admin users and their roles
- **Analytics**: Performance metrics and data visualization
- **Settings**: Profile management and system settings
- **Responsive Navigation**: Mobile-friendly sidebar menu
- **Session Management**: Automatic logout and session handling

## Security Features

- **Session Management**: Secure session handling with expiration
- **Authentication Check**: Automatic redirection for unauthorized access
- **Logout Protection**: Confirmation before logout
- **Form Validation**: Client-side validation with visual feedback

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## Technical Details

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Database**: In-memory JavaScript array (for demo purposes)
- **Session Storage**: localStorage for session management
- **Icons**: Font Awesome 6.0.0
- **Responsive**: CSS Grid and Flexbox

## Demo Notes

This is a demonstration project. In a production environment, you should:

1. Use a proper backend database (PostgreSQL, MongoDB, etc.)
2. Implement proper password hashing (bcrypt)
3. Use secure session management (JWT tokens)
4. Add HTTPS encryption
5. Implement proper user roles and permissions
6. Add input sanitization and validation
7. Use environment variables for sensitive data

## Customization

You can easily customize:

- Colors and themes in the CSS files
- Add new admin users in `database.js`
- Modify dashboard sections in `dashboard.js`
- Add new features and pages as needed

---

**Note**: Remember to use the provided admin credentials to test the login functionality!
