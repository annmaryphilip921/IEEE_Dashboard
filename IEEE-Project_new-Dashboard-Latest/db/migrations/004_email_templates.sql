-- Migration: Add Email Templates Table
-- This table stores customizable email templates for invitation, first reminder, and second reminder emails

CREATE TABLE IF NOT EXISTS email_templates (
    id              SERIAL PRIMARY KEY,
    template_type   VARCHAR(50) NOT NULL UNIQUE
                    CHECK (template_type IN ('invitation', 'rejection', 'first-reminder', 'second-reminder')),
    subject         TEXT NOT NULL,
    body_html       TEXT NOT NULL,
    body_plain      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by      INTEGER REFERENCES admins(id)
);

-- Insert default email templates if they don't exist
INSERT INTO email_templates (template_type, subject, body_html, body_plain, updated_at)
VALUES 
(
    'invitation',
    'IEEE PCIC - Conference Invitation',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><p>Hi <strong>{AUTHOR_FIRST_NAME}</strong>,</p><p>We are pleased to invite you to participate in the <strong>IEEE PCIC (Petroleum and Chemical Industry Committee)</strong> conference.</p><p>Your paper titled "<strong>{PAPER_TITLE}</strong>" has been selected for review.</p><div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #4299e1; margin: 20px 0;"><h4>Your Login Credentials:</h4><p><strong>Paper ID:</strong> {PAPER_ID}</p><p><strong>Username:</strong> {USERNAME}</p><p><strong>Password:</strong> {PASSWORD}</p></div><p>Please use these credentials to access our submission portal. The submission deadline is <strong>[INSERT DEADLINE DATE]</strong>.</p><p>If you have any questions, please contact our support team.</p><p>Best regards,<br><strong>IEEE PCIC Conference Committee</strong><br>Email: support@ieeepcic.org</p></div>',
    'Hi {AUTHOR_FIRST_NAME},\n\nWe are pleased to invite you to participate in the IEEE PCIC (Petroleum and Chemical Industry Committee) conference.\n\nYour paper titled "{PAPER_TITLE}" has been selected for review.\n\nYour Login Credentials:\nPaper ID: {PAPER_ID}\nUsername: {USERNAME}\nPassword: {PASSWORD}\n\nPlease use these credentials to access our submission portal. The submission deadline is [INSERT DEADLINE DATE].\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nIEEE PCIC Conference Committee\nEmail: support@ieeepcic.org',
    NOW()
),
(
    'first-reminder',
    'First Draft Submission Reminder - IEEE PCIC',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><p>Hi <strong>{AUTHOR_FIRST_NAME}</strong>,</p><p>This is a friendly reminder that the <strong>first draft submission deadline</strong> is approaching.</p><p>Paper: <strong>{PAPER_TITLE}</strong></p><div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;"><p><strong>⏰ Important Deadline:</strong> Please submit your first draft by <strong>[INSERT DEADLINE DATE]</strong>.</p></div><p>If you have already submitted your draft, thank you! Please disregard this reminder.</p><p>To submit or update your draft, please log in using your credentials and upload your paper.</p><p>Best regards,<br><strong>IEEE PCIC Conference Committee</strong></p></div>',
    'Hi {AUTHOR_FIRST_NAME},\n\nThis is a friendly reminder that the first draft submission deadline is approaching.\n\nPaper: {PAPER_TITLE}\n\n⏰ Important Deadline: Please submit your first draft by [INSERT DEADLINE DATE].\n\nIf you have already submitted your draft, thank you! Please disregard this reminder.\n\nTo submit or update your draft, please log in using your credentials and upload your paper.\n\nBest regards,\nIEEE PCIC Conference Committee',
    NOW()
),
(
    'second-reminder',
    'Final Reminder - Paper Submission Deadline - IEEE PCIC',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><p>Hi <strong>{AUTHOR_FIRST_NAME}</strong>,</p><p>This is a <strong>final reminder</strong> that the submission deadline is <strong>URGENT</strong>.</p><p>Paper: <strong>{PAPER_TITLE}</strong></p><div style="background: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;"><p><strong>🚨 URGENT - FINAL DEADLINE:</strong> Please submit your paper by <strong>[INSERT DEADLINE DATE]</strong>. Time is running out!</p></div><p>If you have not yet submitted your paper, please do so immediately to avoid missing the deadline.</p><p>Your submission is essential for the conference review process. Please ensure your paper meets all IEEE guidelines and formatting requirements.</p><p>For any technical issues with submissions, please contact our support team immediately.</p><p>Best regards,<br><strong>IEEE PCIC Conference Committee</strong></p></div>',
    'Hi {AUTHOR_FIRST_NAME},\n\nThis is a FINAL REMINDER that the submission deadline is URGENT.\n\nPaper: {PAPER_TITLE}\n\n🚨 URGENT - FINAL DEADLINE: Please submit your paper by [INSERT DEADLINE DATE]. Time is running out!\n\nIf you have not yet submitted your paper, please do so immediately to avoid missing the deadline.\n\nYour submission is essential for the conference review process. Please ensure your paper meets all IEEE guidelines and formatting requirement.\n\nBest regards,\nIEEE PCIC Conference Committee',
    NOW()
),
(
    'rejection',
    'IEEE PCIC - Paper Decision Notification',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><p>Dear <strong>{AUTHOR_FIRST_NAME}</strong>,</p><p>Thank you for submitting your paper titled <strong>{PAPER_TITLE}</strong> (Paper ID: <strong>{PAPER_ID}</strong>).</p><p>After review, we regret to inform you that your submission has not been selected for this cycle.</p><p>We appreciate your effort and encourage you to submit future work to upcoming IEEE PCIC conferences.</p><p>Best regards,<br><strong>IEEE PCIC Conference Committee</strong></p></div>',
    'Dear {AUTHOR_FIRST_NAME},\n\nThank you for submitting your paper titled {PAPER_TITLE} (Paper ID: {PAPER_ID}).\n\nAfter review, we regret to inform you that your submission has not been selected for this cycle.\n\nWe appreciate your effort and encourage you to submit future work to upcoming IEEE PCIC conferences.\n\nBest regards,\nIEEE PCIC Conference Committee',
    NOW()
)
ON CONFLICT (template_type) DO NOTHING;
