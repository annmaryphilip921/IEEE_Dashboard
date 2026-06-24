const express const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'jixilann@gmail.com',
        pass: 'agmm yurl nghv reyw'  // Using the working password from email-service.js
    },
    tls: {
        rejectUnauthorized: false
    }
});'express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8888;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Gmail configuration with better error handling
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'jixilann@gmail.com',
        pass: 'xtce vwwn hfgr bpvr'  // Using the working password
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Global variable to track email status
let gmailWorking = false;

// Test Gmail connection
transporter.verify((error, success) => {
    if (error) {
        console.log('⚠️  Gmail connection failed:', error.message);
        console.log('📧 Email service will use simulation mode');
        console.log('💡 To enable real emails:');
        console.log('   1. Enable 2-Factor Authentication on Gmail');
        console.log('   2. Generate App Password in Google Account Settings');
        console.log('   3. Replace password in server with App Password');
        gmailWorking = false;
    } else {
        console.log('✅ Gmail connection successful - Real emails will be sent!');
        gmailWorking = true;
    }
});

// Also test connection periodically
setInterval(() => {
    transporter.verify((error, success) => {
        if (error && gmailWorking) {
            console.log('⚠️  Gmail connection lost, switching to simulation mode');
            gmailWorking = false;
        } else if (success && !gmailWorking) {
            console.log('✅ Gmail connection restored!');
            gmailWorking = true;
        }
    });
}, 30000); // Check every 30 seconds

// Serve static files (HTML, CSS, JS)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/author-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'author-dashboard.html'));
});

// Email API endpoint
app.post('/send-email', async (req, res) => {
    try {
        const { to, subject, html, firstName, lastName, paperTitle, userId, password, authorId } = req.body;
        
        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: to (recipient email)'
            });
        }

        // Determine email type based on request content
        let emailType = 'general';
        if (subject && subject.includes('First Draft')) {
            emailType = 'first-draft-reminder';
        } else if (subject && subject.includes('Invitation')) {
            emailType = 'invitation';
        }

        // Try to send real email first if Gmail is working
        if (gmailWorking) {
            try {
                const mailOptions = {
                    from: 'IEEE PCIC Conference <jixilann@gmail.com>',
                    to: to,
                    subject: subject || `IEEE PCIC Conference - ${emailType}`,
                    html: html || `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #333;">IEEE PCIC Conference</h2>
                            <p>Dear ${firstName || 'Participant'},</p>
                            <p>This is a message from the IEEE PCIC - Mariane Sub-Committee.</p>
                            <p>Best regards,<br>IEEE PCIC Organization Team</p>
                        </div>
                    `
                };

                console.log(`📤 Sending real email to: ${to}`);
                const info = await transporter.sendMail(mailOptions);
                
                console.log(`✅ [${emailType.toUpperCase()}] Real email sent successfully!`);
                console.log(`   📧 To: ${to}`);
                if (firstName && lastName) {
                    console.log(`   👤 Recipient: ${firstName} ${lastName}`);
                }
                console.log(`   📨 Message ID: ${info.messageId}`);
                console.log(`   📍 Response: ${info.response}`);
                
                return res.json({
                    success: true,
                    message: `Email sent successfully via Gmail`,
                    messageId: info.messageId,
                    emailType: emailType,
                    realEmail: true
                });

            } catch (emailError) {
                console.error('❌ Gmail sending failed:', emailError.message);
                console.log('🔄 Falling back to simulation mode');
                gmailWorking = false;
            }
        }

        // Fallback to simulation mode
        console.log(`📧 [${emailType.toUpperCase()}] SIMULATED email (not actually sent)`);
        console.log(`   📧 To: ${to}`);
        if (firstName && lastName) {
            console.log(`   👤 Recipient: ${firstName} ${lastName}`);
        }
        if (subject) {
            console.log(`   📌 Subject: ${subject}`);
        }
        if (paperTitle) {
            console.log(`   📄 Paper: ${paperTitle}`);
        }
        if (userId) {
            console.log(`   🆔 User ID: ${userId}`);
        }
        console.log(`   ⚠️  NOTE: This is SIMULATION - no real email was sent!`);
        
        // Simulate realistic delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

        res.json({
            success: true,
            message: `Email sent successfully (SIMULATED - not real)`,
            messageId: 'simulated-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            emailType: emailType,
            realEmail: false
        });

    } catch (error) {
        console.error('❌ Error in email endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: error.message
        });
    }
});

// Start the integrated server
app.listen(PORT, () => {
    console.log(`🚀 IEEE Dashboard Server running on http://localhost:${PORT}`);
    console.log(`📧 Email service integrated and ready`);
    console.log(`📱 Gmail account: jixilann@gmail.com`);
    console.log(`🌐 Access your application at: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
