// Email Service for IEEE Dashboard  
// This service handles automatic email sending using Gmail SMTP

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// Gmail configuration
const GMAIL_USER = 'jixilann@gmail.com';
const GMAIL_APP_PASSWORD = 'agmm yurl nghv reyw';

// Create Gmail transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
    }
});

// Verify connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('Gmail connection error:', error);
    } else {
        console.log('Gmail connection successful');
    }
});

// Email sending endpoint
app.post('/send-email', async (req, res) => {
    try {
        const { to, firstName, lastName, paperTitle, userId, password, authorId } = req.body;

        if (!to || !firstName || !lastName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: to, firstName, lastName' 
            });
        }

        const subject = 'IEEE PCIC- Invitation';
        const emailBody = `Hi ${firstName},

We hope this email finds you well. We are pleased to invite you to participate in the IEEE PCIC (Petroleum and Chemical Industry Committee) conference.

Your paper titled "${paperTitle || 'Your Submitted Paper'}" has been selected for review and we would like to invite you to submit your full manuscript for consideration.

Your Login Credentials:
Paper ID: IEEE-${authorId ? authorId.toString().padStart(4, '0') : '0001'}
Username: ${userId || firstName.toLowerCase() + '.' + lastName.toLowerCase()}
Password: ${password || 'default123'}

Please use these credentials to access our submission portal and upload your final manuscript. The submission deadline is September 30, 2025.

Important Information:
- Ensure your paper follows IEEE formatting guidelines
- Maximum paper length: 8 pages
- Include author biographies and photographs
- Submit both PDF and Word document versions

If you have any questions or need technical assistance, please don't hesitate to contact our support team.

We look forward to your participation in IEEE PCIC.

Best regards,
IEEE PCIC Conference Committee
Email: support@ieeepcic.org
Website: www.ieeepcic.org`;

        const mailOptions = {
            from: GMAIL_USER,
            to: to,
            subject: subject,
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
        };

        const result = await transporter.sendMail(mailOptions);
        
        console.log('Email sent successfully:', result.messageId);
        res.json({ 
            success: true, 
            messageId: result.messageId,
            message: `Email sent successfully to ${to}` 
        });

    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// First Draft Reminder email endpoint
app.post('/send-first-draft-reminder', async (req, res) => {
    try {
        const { to, firstName, lastName, paperTitle, userId, password, authorId } = req.body;

        if (!to || !firstName || !lastName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: to, firstName, lastName' 
            });
        }

        const subject = 'First Draft Submission Reminder - IEEE PCIC Conference';
        const emailBody = `Dear ${firstName} ${lastName},

We hope this message finds you well. This is a friendly reminder regarding your paper submission for the IEEE PCIC Conference.

Paper Details:
Title: ${paperTitle || 'Your Submitted Paper'}
Author ID: IEEE-${authorId ? authorId.toString().padStart(4, '0') : '0001'}
Username: ${userId || firstName.toLowerCase() + '.' + lastName.toLowerCase()}

What's Next:
Please prepare and upload your first draft by the specified deadline. You can access your dashboard using your login credentials.

Submission Guidelines:
• Submit your paper in PDF format
• Follow IEEE conference formatting guidelines
• Ensure all references are properly cited
• Include author information and affiliations
• Maximum page limit: 6 pages (including references)

Important: Late submissions may not be considered for review. Please ensure timely submission.

If you have any questions or need assistance with the submission process, please don't hesitate to contact us.

Best regards,
IEEE PCIC - Mariane Sub-Committee
Email: support@ieeepcic.org
Website: www.ieeepcic.org`;

        const mailOptions = {
            from: GMAIL_USER,
            to: to,
            subject: subject,
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
        };

        const result = await transporter.sendMail(mailOptions);
        
        console.log('First Draft Reminder sent successfully:', result.messageId);
        res.json({ 
            success: true, 
            messageId: result.messageId,
            message: `First Draft Reminder sent successfully to ${to}` 
        });

    } catch (error) {
        console.error('First Draft Reminder sending error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'running', 
        service: 'IEEE Email Service',
        gmail: GMAIL_USER 
    });
});

// Default route to serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/dashboard.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`IEEE Email Service running on http://localhost:${PORT}`);
    console.log(`Gmail account: ${GMAIL_USER}`);
    console.log('Ready to send emails automatically!');
});
