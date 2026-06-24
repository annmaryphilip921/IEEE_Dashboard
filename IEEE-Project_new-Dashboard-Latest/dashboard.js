// Dashboard JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    // Load user information
    loadUserInfo();
    
    // Initialize dashboard functionality
    initializeDashboard();
});

function loadUserInfo() {
    const session = getSession();
    if (session && session.user) {
        const user = session.user;
        
        // Update user name in sidebar
        const userNameElement = document.getElementById('userName');
        const userRoleElement = document.getElementById('userRole');
        const headerUserNameElement = document.getElementById('headerUserName');
        
        if (userNameElement) {
            userNameElement.textContent = user.fullName;
        }
        
        if (userRoleElement) {
            userRoleElement.textContent = user.role;
        }
        
        if (headerUserNameElement) {
            headerUserNameElement.textContent = user.fullName.split(' ')[0]; // First name only
        }
        
        // Update page title
        document.title = `Dashboard - ${user.fullName}`;
        
        // Show welcome message
        showWelcomeMessage(user.fullName);
    }
}

async function checkAuthorChatUnreadStatus(authorId, buttonElement) {
    try {
        const res = await fetch(`/chat/unread-count/author/${authorId}`);
        const data = await res.json();
        
        if (data.success && data.unreadCount > 0) {
            buttonElement.classList.remove('chat-no-unread');
            buttonElement.classList.add('chat-has-unread');
            buttonElement.title = `${data.unreadCount} unread message${data.unreadCount !== 1 ? 's' : ''}`;
        } else {
            buttonElement.classList.remove('chat-has-unread');
            buttonElement.classList.add('chat-no-unread');
            buttonElement.title = 'No new messages';
        }
    } catch (err) {
        console.error('Error checking author chat status:', err);
    }
}

function initializeDashboard() {
    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Navbar navigation
    initializeNavbarNavigation();
    
    // Load dashboard data
    loadDashboardData();
}

function initializeNavbarNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Get the section from href
            const section = this.getAttribute('href').substring(1);
            loadSection(section);
        });
    });
}

function loadSection(section) {
    const content = document.querySelector('.content');
    
    switch(section) {
        case 'dashboard':
            loadDashboardContent();
            break;
        case 'projects':
            loadProjectsContent();
            break;
        case 'documents':
            loadDocumentsContent();
            break;
        case 'users':
            loadUsersContent();
            break;
        case 'analytics':
            loadAnalyticsContent();
            break;
        case 'settings':
            loadSettingsContent();
            break;
        case 'email-templates':
            loadEmailTemplatesContent();
            break;
        default:
            loadDashboardContent(); // Default to dashboard
    }
}

function loadDashboardContent() {
    const content = document.querySelector('.content');
    content.innerHTML = `
        <div class="page-header">
            <h2>Dashboard Overview</h2>
        </div>
        
        <!-- Timeline Section -->
        <div class="timeline-section">
            <h3>Project Timeline</h3>
            <div class="timeline-container horizontal">
                <div class="timeline-item pending" data-timeline="logins-created">
                    <div class="timeline-dot">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-title">Logins Created</div>
                        <div class="timeline-date">Pending</div>
                    </div>
                    <div class="timeline-connector"></div>
                </div>
                
                <div class="timeline-item pending" data-timeline="invitation-send">
                    <div class="timeline-dot">
                        <i class="fas fa-paper-plane"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-title">Invitation Send</div>
                        <div class="timeline-date">Pending</div>
                    </div>
                    <div class="timeline-connector"></div>
                </div>
                
                <div class="timeline-item pending" data-timeline="first-draft-reminder">
                    <div class="timeline-dot">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-title">First Draft Reminder</div>
                        <div class="timeline-date">Pending</div>
                    </div>
                    <div class="timeline-connector"></div>
                </div>
                
                <div class="timeline-item pending" data-timeline="paper-submission">
                    <div class="timeline-dot">
                        <i class="fas fa-file-upload"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-title">Completed Paper Submission</div>
                        <div class="timeline-date">Pending</div>
                    </div>
                    <div class="timeline-connector"></div>
                </div>
                
                <div class="timeline-item pending" data-timeline="review-in-progress">
                    <div class="timeline-dot">
                        <i class="fas fa-search"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-title">Review in Progress</div>
                        <div class="timeline-date">Pending</div>
                    </div>
                    <div class="timeline-connector"></div>
                </div>
            </div>
        </div>
        
        <!-- Dynamic Content Area -->
        <div class="timeline-content-area" id="timelineContentArea">
            <!-- Timeline-specific content will be loaded here -->
        </div>
    `;
    
    // Add timeline click handlers after content is loaded
    addTimelineClickHandlers();
    loadWorkflowDatesFromDatabase();
}

function formatWorkflowDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleString([], {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function upsertWorkflowDateLabel(item, text) {
    const content = item.querySelector('.timeline-content');
    if (!content) return;

    let label = content.querySelector('.timeline-schedule');
    if (!label) {
        label = document.createElement('div');
        label.className = 'timeline-schedule';
        label.style.fontSize = '11px';
        label.style.color = '#475569';
        label.style.marginTop = '6px';
        label.style.lineHeight = '1.35';
        label.style.fontWeight = '500';
        content.appendChild(label);
    }

    label.textContent = text;
}

function applyWorkflowDatesToTimelineCards(schedules) {
    const scheduleMap = {};
    (schedules || []).forEach((schedule) => {
        scheduleMap[schedule.stage] = schedule;
    });

    const timelineItems = document.querySelectorAll('.timeline-item[data-timeline]');
    timelineItems.forEach((item) => {
        const stage = item.getAttribute('data-timeline');
        const schedule = scheduleMap[stage];

        if (!schedule || (!schedule.start_time && !schedule.end_time)) {
            upsertWorkflowDateLabel(item, 'Dates not set');
            return;
        }

        const formattedStart = formatWorkflowDateTime(schedule.start_time);
        const formattedEnd = formatWorkflowDateTime(schedule.end_time);

        if (formattedStart && formattedEnd) {
            upsertWorkflowDateLabel(item, `${formattedStart} - ${formattedEnd}`);
        } else if (formattedStart) {
            upsertWorkflowDateLabel(item, `Start: ${formattedStart}`);
        } else if (formattedEnd) {
            upsertWorkflowDateLabel(item, `End: ${formattedEnd}`);
        }
    });
}

async function loadWorkflowDatesFromDatabase() {
    try {
        const response = await fetch(`/timeline-schedules?_=${Date.now()}`);
        const data = await response.json();
        if (response.ok && data.success && Array.isArray(data.schedules)) {
            applyWorkflowDatesToTimelineCards(data.schedules);
        }
    } catch (err) {
        console.error('Error loading workflow date ranges:', err);
    }
}

function addTimelineClickHandlers() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    timelineItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all timeline items
            timelineItems.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Get timeline type and load specific content
            const timelineType = this.getAttribute('data-timeline');
            loadTimelineSpecificContent(timelineType);
        });
    });
}

function loadTimelineSpecificContent(timelineType) {
    const contentArea = document.getElementById('timelineContentArea');
    
    switch(timelineType) {
        case 'logins-created':
            contentArea.innerHTML = `
                <div class="timeline-dashboard">
                    <div class="dashboard-header">
                        <h3><i class="fas fa-user-plus"></i> User Management Dashboard</h3>
                        <p>Manage user accounts and access credentials</p>
                    </div>
                    <div class="dashboard-actions">
                        <button class="btn-primary create-users-btn" onclick="openCreateUsersModal()">
                            <i class="fas fa-plus"></i> Create Users
                        </button>
                        <button class="btn-secondary manage-credentials-btn" onclick="openManageCredentialsModal()">
                            <i class="fas fa-users-cog"></i> Manage Login Credentials
                        </button>
                        <button class="btn-warning" onclick="openDatesModal()">
                            <i class="fas fa-calendar-alt"></i> Dates
                        </button>
                    </div>
                    <div class="submit-section">
                        <button class="btn-submit" onclick="submitLoginsCreated()">
                            <i class="fas fa-check"></i> Submit
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 'invitation-send':
            contentArea.innerHTML = `
                <div class="timeline-dashboard">
                    <div class="dashboard-header">
                        <h3><i class="fas fa-paper-plane"></i> Invitation Management</h3>
                        <p>Send invitations to participants and reviewers</p>
                    </div>
                    <div class="dashboard-actions">
                        <button class="btn-primary" onclick="openSendInvitationModal()">
                            <i class="fas fa-envelope"></i> Send Invitations
                        </button>
                        <button class="btn-info track-progress-btn" onclick="openProgressTrackingModal('invitation-send')">
                            <i class="fas fa-chart-line"></i> Track Progress
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 'first-draft-reminder':
            contentArea.innerHTML = `
                <div class="timeline-dashboard">
                    <div class="dashboard-header">
                        <h3><i class="fas fa-bell"></i> First Draft Reminder</h3>
                        <p>Send initial reminders for paper submission deadline</p>
                    </div>
                    <div class="dashboard-actions">
                        <button class="btn-primary" onclick="sendFirstDraftReminders()">
                            <i class="fas fa-bell"></i> Send Reminders
                        </button>
                        <button class="btn-info track-progress-btn" onclick="openProgressTrackingModal('first-draft-reminder')">
                            <i class="fas fa-chart-line"></i> Track Progress
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 'paper-submission':
            contentArea.innerHTML = `
                <div class="timeline-dashboard">
                    <div class="dashboard-header">
                        <h3><i class="fas fa-file-upload"></i> Paper Submission</h3>
                        <p>Manage completed paper submissions</p>
                    </div>
                    <div class="dashboard-actions">
                        <button class="btn-primary" onclick="sendFinalPaperSubmissionEmails()">
                            <i class="fas fa-paper-plane"></i> Send Final Paper Submission Email
                        </button>
                        <button class="btn-info track-progress-btn" onclick="openProgressTrackingModal('paper-submission')">
                            <i class="fas fa-chart-line"></i> Track Progress
                        </button>
                    </div>
                </div>
            `;
            break;
            
        
        case 'review-in-progress':
            contentArea.innerHTML = `
                <div class="timeline-dashboard">
                    <div class="dashboard-header">
                        <h3><i class="fas fa-search"></i> Review Progress</h3>
                        <p>Monitor ongoing paper review process</p>
                    </div>
                    <div class="dashboard-actions">
                        <button class="btn-primary">
                            <i class="fas fa-eye"></i> View Reviews
                        </button>
                        <button class="btn-info track-progress-btn" onclick="openProgressTrackingModal('review-in-progress')">
                            <i class="fas fa-chart-line"></i> Track Progress
                        </button>
                    </div>
                </div>
            `;
            break;
            
        default:
            contentArea.innerHTML = `
                <div class="timeline-dashboard">
                    <div class="dashboard-header">
                        <h3>Select a timeline item</h3>
                        <p>Click on any timeline point above to view its specific dashboard</p>
                    </div>
                </div>
            `;
    }
}

function openCreateUsersModal() {
    // Create modal HTML
    const modalHTML = `
        <div class="modal-overlay" id="createUserModal">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> Create New Author</h3>
                    <button class="modal-close" onclick="closeCreateUsersModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="bulk-upload-panel">
                        <h4><i class="fas fa-file-excel"></i> Bulk Upload From Excel</h4>
                        <div class="bulk-upload-controls">
                            <input type="file" id="authorsExcelFile" accept=".xlsx,.xls">
                            <button type="button" class="btn-secondary bulk-upload-btn" id="bulkUploadBtn" onclick="uploadAuthorsFromExcel()">
                                <i class="fas fa-upload"></i> Upload Excel
                            </button>
                        </div>
                        <div id="bulkUploadResult" class="bulk-upload-result" style="display:none;"></div>
                    </div>

                    <div class="bulk-upload-divider"><span>OR</span></div>

                    <form id="createAuthorForm" onsubmit="submitAuthorForm(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="firstName">Author First Name *</label>
                                <input type="text" id="firstName" name="firstName" required>
                            </div>
                            <div class="form-group">
                                <label for="lastName">Author Last Name *</label>
                                <input type="text" id="lastName" name="lastName" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="email">Email *</label>
                                <input type="email" id="email" name="email" required>
                            </div>
                            <div class="form-group">
                                <label for="phone">Phone</label>
                                <input type="tel" id="phone" name="phone">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="company">Company *</label>
                            <input type="text" id="company" name="company" required>
                        </div>
                        <div class="form-group">
                            <label for="paperTitle">Paper Title *</label>
                            <input type="text" id="paperTitle" name="paperTitle" required>
                        </div>
                        <div class="form-group">
                            <label for="abstractInfo">Abstract Info *</label>
                            <textarea id="abstractInfo" name="abstractInfo" rows="4" required></textarea>
                        </div>
                        <div class="form-group">
                            <label for="paperId">Paper ID *</label>
                            <input type="text" id="paperId" name="paperId" required placeholder="e.g., IEEE-2025-001">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="closeCreateUsersModal()">Cancel</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Submit
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal with animation
    setTimeout(() => {
        document.getElementById('createUserModal').classList.add('active');
    }, 10);
}

function closeCreateUsersModal() {
    const modal = document.getElementById('createUserModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function showBulkUploadResult(message, isError = false) {
    const resultBox = document.getElementById('bulkUploadResult');
    if (!resultBox) return;

    resultBox.style.display = 'block';
    resultBox.className = `bulk-upload-result ${isError ? 'error' : 'success'}`;
    resultBox.innerHTML = message;
}

async function uploadAuthorsFromExcel() {
    const fileInput = document.getElementById('authorsExcelFile');
    const uploadBtn = document.getElementById('bulkUploadBtn');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!file) {
        showBulkUploadResult('Please select an Excel file (.xlsx or .xls) first.', true);
        return;
    }

    const session = typeof getSession === 'function' ? getSession() : null;
    const createdByAdminId = session && session.user ? session.user.id : null;
    if (!createdByAdminId) {
        showBulkUploadResult('Session expired. Please log in again.', true);
        return;
    }

    const payload = new FormData();
    payload.append('authorsFile', file);
    payload.append('createdByAdminId', String(createdByAdminId));

    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    }

    try {
        const response = await fetch('/authors/bulk-upload', {
            method: 'POST',
            body: payload
        });

        const contentType = response.headers.get('content-type') || '';
        const rawBody = await response.text();
        let result = null;
        if (contentType.includes('application/json')) {
            try {
                result = JSON.parse(rawBody);
            } catch (_err) {
                result = null;
            }
        }

        if (!result) {
            const likelyServerNotRestarted = response.status === 404 || rawBody.trim().startsWith('<');
            if (likelyServerNotRestarted) {
                showBulkUploadResult('Bulk upload API is not available yet. Please restart the server and try again.', true);
                return;
            }
            showBulkUploadResult(`Bulk upload failed: Unexpected server response (HTTP ${response.status}).`, true);
            return;
        }

        if (!response.ok || !result.success) {
            showBulkUploadResult(`Bulk upload failed: ${result.message || 'Unknown error'}`, true);
            return;
        }

        const summary = result.summary || {};
        showBulkUploadResult(
            `
            <strong>Bulk upload completed.</strong><br>
            Total rows: ${summary.totalRowsInFile || 0}<br>
            Processed rows: ${summary.processedRows || 0}<br>
            Created: ${summary.created || 0}<br>
            Updated (same Paper ID): ${summary.updated || 0}<br>
            Duplicates removed by Abstract Number: ${summary.duplicatesRemovedByPaperId || 0}<br>
            Skipped (missing Abstract Number): ${summary.skippedMissingPaperId || 0}<br>
            Skipped (missing required mapped fields): ${summary.skippedMissingRequired || 0}<br>
            Processing time: ${summary.durationMs ? `${(summary.durationMs / 1000).toFixed(2)}s` : 'N/A'}
            `,
            false
        );

        invalidateAuthorsCache();

        if (fileInput) fileInput.value = '';
    } catch (error) {
        showBulkUploadResult(`Bulk upload failed: ${error.message}`, true);
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Excel';
        }
    }
}

async function submitAuthorForm(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(event.target);
    const authorData = {
        firstName: formData.get('firstName').trim(),
        lastName: formData.get('lastName').trim(),
        email: formData.get('email').trim(),
        phone: formData.get('phone').trim(),
        company: formData.get('company').trim(),
        paperTitle: formData.get('paperTitle').trim(),
        abstractInfo: formData.get('abstractInfo').trim(),
        paperId: formData.get('paperId').trim()
    };
    
    // Validate required fields
    if (!authorData.firstName || !authorData.lastName || !authorData.email || 
        !authorData.company || !authorData.paperTitle || !authorData.abstractInfo || 
        !authorData.paperId) {
        alert('Please fill in all required fields marked with *');
        return;
    }

    // Get current admin ID from session
    const session = typeof getSession === 'function' ? getSession() : null;
    const createdByAdminId = session && session.user ? session.user.id : null;
    if (!createdByAdminId) {
        alert('Session expired. Please log in again.');
        return;
    }

    // Disable submit button during request
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating...'; }

    try {
        const response = await fetch('/authors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...authorData, createdByAdminId })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            alert('Error creating author: ' + (result.message || 'Unknown error'));
            return;
        }

        // Show success message with generated credentials
        showAuthorCreatedMessage(result.author);

        // Close modal
        closeCreateUsersModal();

        invalidateAuthorsCache();

        console.log('New author created in RDS:', result.author);

    } catch (error) {
        alert('Network error creating author: ' + error.message);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Author'; }
    }
}

function showAuthorCreatedMessage(author) {
    const messageHTML = `
        <div class="success-modal-overlay" id="successModal">
            <div class="success-modal-container">
                <div class="success-header">
                    <i class="fas fa-check-circle"></i>
                    <h3>Author Created Successfully!</h3>
                </div>
                <div class="success-body">
                    <p><strong>Author:</strong> ${author.firstName} ${author.lastName}</p>
                    <p><strong>Email:</strong> ${author.email}</p>
                    <div class="credentials-box">
                        <h4>Generated Login Credentials:</h4>
                        <p><strong>Login Email:</strong> <span class="credential">${author.email}</span></p>
                        <p><strong>Password:</strong> <span class="credential">${author.password}</span></p>
                    </div>
                    <p class="note">Please save these credentials and share them with the author.</p>
                </div>
                <div class="success-actions">
                    <button class="btn-primary" onclick="closeSuccessModal()">OK</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', messageHTML);
    
    setTimeout(() => {
        document.getElementById('successModal').classList.add('active');
    }, 10);
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Manage Credentials Modal Functions
async function openManageCredentialsModal() {
    // Insert modal immediately with loading state
    const loadingHTML = `
        <div class="modal-overlay manage-credentials-modal" id="manageCredentialsModal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-users-cog"></i> Manage Login Credentials</h3>
                    <button class="modal-close" onclick="closeManageCredentialsModal()">&times;</button>
                </div>
                <div class="modal-body" id="credentialsModalBody">
                    <p style="text-align:center;padding:40px;color:#64748b;">Loading authors...</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeManageCredentialsModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
    setTimeout(() => { document.getElementById('manageCredentialsModal').classList.add('active'); }, 10);

    // Fetch authors from RDS via API
    let authorsData = [];
    try {
        const response = await fetch('/authors');
        const result = await response.json();
        if (result.success) authorsData = result.authors || [];
    } catch (err) {
        console.error('Failed to load authors from API:', err);
    }

    // Generate table rows
    let tableRows = '';
    if (authorsData.length > 0) {
        tableRows = authorsData.map(author => {
            return `
            <tr class="author-row" data-author-id="${author.id}">
                <td>
                    <input type="checkbox" class="author-checkbox" value="${author.id}" onchange="toggleBulkActions()">
                </td>
                <td>${author.firstName || 'N/A'}</td>
                <td>${author.lastName || 'N/A'}</td>
                <td>${author.email || 'N/A'}</td>
                <td class="paper-title" title="${author.paperTitle || 'N/A'}">${author.paperTitle || 'N/A'}</td>
                <td>${author.paperId || 'N/A'}</td>
                <td class="user-id">${author.userId || 'N/A'}</td>
                <td class="password">${author.password || '—'}</td>
            </tr>`;
        }).join('');
    }

    // Update modal header count
    const header = document.querySelector('#manageCredentialsModal .modal-header h3');
    if (header) header.innerHTML = `<i class="fas fa-users-cog"></i> Manage Login Credentials (${authorsData.length} authors)`;

    const bodyContent = authorsData.length > 0 ? `
        <div class="credentials-controls">
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" id="authorSearch" placeholder="Search authors..." onkeyup="filterAuthors()">
            </div>
            <div class="bulk-actions" id="bulkActions" style="display: none;">
                <button class="btn-danger" onclick="deleteSelectedAuthors()">
                    <i class="fas fa-trash"></i> Delete Selected
                </button>
                <button class="btn-secondary" onclick="modifySelectedAuthor()">
                    <i class="fas fa-edit"></i> Modify Selected
                </button>
            </div>
        </div>
        <div class="credentials-table-container">
            <table class="credentials-table" id="credentialsTable">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"></th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Email (Login)</th>
                        <th>Paper Title</th>
                        <th>Paper ID</th>
                        <th>User ID</th>
                        <th>Password</th>
                    </tr>
                </thead>
                <tbody id="credentialsTableBody">${tableRows}</tbody>
            </table>
        </div>` : `
        <div class="no-data">
            <i class="fas fa-users" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
            <h4>No Authors Found</h4>
            <p>Create some users first using the "Create Users" button.</p>
            <button class="btn-primary" onclick="closeManageCredentialsModal(); openCreateUsersModal();">
                <i class="fas fa-plus"></i> Create First User
            </button>
        </div>`;

    const bodyEl = document.getElementById('credentialsModalBody');
    if (bodyEl) bodyEl.innerHTML = bodyContent;
}

function closeManageCredentialsModal() {
    const modal = document.getElementById('manageCredentialsModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function filterAuthors() {
    const searchTerm = document.getElementById('authorSearch').value.toLowerCase();
    const rows = document.querySelectorAll('.author-row');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const authorCheckboxes = document.querySelectorAll('.author-checkbox');
    
    authorCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    toggleBulkActions();
}

function toggleBulkActions() {
    const selectedCheckboxes = document.querySelectorAll('.author-checkbox:checked');
    const bulkActions = document.getElementById('bulkActions');
    
    if (selectedCheckboxes.length > 0) {
        bulkActions.style.display = 'flex';
    } else {
        bulkActions.style.display = 'none';
    }
}

function deleteSelectedAuthors() {
    const selectedCheckboxes = document.querySelectorAll('.author-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert('Please select authors to delete.');
        return;
    }

    const confirmed = confirm(`Are you sure you want to delete ${selectedCheckboxes.length} selected author(s)? This will permanently remove them from the database.`);
    if (!confirmed) return;

    const selectedIds = Array.from(selectedCheckboxes)
        .map((cb) => {
            const rawValue = String(cb.value || '').trim();
            const fallbackValue = cb.closest('tr')?.getAttribute('data-author-id') || '';
            const parsed = parseInt(rawValue || fallbackValue, 10);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        })
        .filter((id) => id !== null);

    if (selectedIds.length === 0) {
        alert('No valid author IDs were selected. Please refresh and try again.');
        return;
    }

    fetch('/authors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const deletedCount = Array.isArray(data.deleted) ? data.deleted.length : 0;
            if (deletedCount > 0) {
                alert(`${deletedCount} author(s) deleted successfully.`);
            } else {
                alert('No authors were deleted in RDS for the selected IDs. Please refresh and try again.');
            }
            refreshCredentialsTable();
        } else {
            alert('Delete failed: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(err => {
        console.error('Delete error:', err);
        alert('Network error while deleting. Please try again.');
    });
}

// Comprehensive user cleanup function
function performCompleteUserCleanup(author) {
    const cleanupResults = {
        success: true,
        errors: [],
        cleanedItems: []
    };
    
    try {
        const userEmail = author.email;
        const userId = author.userId;
        
        console.log(`🧹 Starting comprehensive cleanup for: ${author.firstName} ${author.lastName}`);
        
        // 1. Clean up submissions data
        try {
            localStorage.removeItem(`submissions_${userEmail}`);
            cleanupResults.cleanedItems.push('submissions');
            console.log(`✅ Removed submissions for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove submissions: ${error.message}`);
        }
        
        // 2. Clean up chat data (multiple possible chat keys)
        try {
            // Chat with admin (user as key)
            localStorage.removeItem(`chat_${userEmail}`);
            localStorage.removeItem(`chat_${userEmail}_admin`);
            localStorage.removeItem(`chat_${userId}`);
            localStorage.removeItem(`chat_${userId}_admin`);
            
            // Chat messages (alternative storage patterns)
            localStorage.removeItem(`chat_messages_${userEmail}`);
            localStorage.removeItem(`chat_messages_${userId}`);
            
            cleanupResults.cleanedItems.push('chat_data');
            console.log(`✅ Removed chat data for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove chat data: ${error.message}`);
        }
        
        // 3. Clean up progress tracking data
        try {
            localStorage.removeItem(`progress_${userEmail}`);
            localStorage.removeItem(`progress_${userId}`);
            cleanupResults.cleanedItems.push('progress');
            console.log(`✅ Removed progress data for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove progress data: ${error.message}`);
        }
        
        // 4. Clean up session data if it belongs to this user
        try {
            const session = sessionStorage.getItem('adminSession') || localStorage.getItem('adminSession');
            if (session) {
                const sessionData = JSON.parse(session);
                if (sessionData.user && sessionData.user.email === userEmail) {
                    sessionStorage.removeItem('adminSession');
                    localStorage.removeItem('adminSession');
                    cleanupResults.cleanedItems.push('session');
                    console.log(`✅ Removed session data for ${userEmail}`);
                }
            }
        } catch (error) {
            cleanupResults.errors.push(`Failed to check/remove session data: ${error.message}`);
        }
        
        // 5. Clean up first draft reminder data
        try {
            localStorage.removeItem(`firstDraftRemindLater_${userEmail}`);
            localStorage.removeItem(`firstDraftPopupShown_${userEmail}`);
            cleanupResults.cleanedItems.push('reminder_data');
            console.log(`✅ Removed reminder data for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove reminder data: ${error.message}`);
        }
        
        // 6. Clean up any notification data
        try {
            localStorage.removeItem(`notifications_${userEmail}`);
            localStorage.removeItem(`notifications_${userId}`);
            cleanupResults.cleanedItems.push('notifications');
            console.log(`✅ Removed notification data for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove notification data: ${error.message}`);
        }
        
        // 7. Clean up any cached user data
        try {
            localStorage.removeItem(`userCache_${userEmail}`);
            localStorage.removeItem(`userCache_${userId}`);
            localStorage.removeItem(`authorData_${userEmail}`);
            cleanupResults.cleanedItems.push('cached_data');
            console.log(`✅ Removed cached data for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove cached data: ${error.message}`);
        }
        
        // 8. Scan for any other localStorage keys that might contain user data
        try {
            const allKeys = Object.keys(localStorage);
            const userRelatedKeys = allKeys.filter(key => 
                key.includes(userEmail) || 
                key.includes(userId) || 
                key.includes(author.firstName.toLowerCase()) ||
                key.includes(author.lastName.toLowerCase())
            );
            
            userRelatedKeys.forEach(key => {
                localStorage.removeItem(key);
                console.log(`✅ Removed additional user data: ${key}`);
            });
            
            if (userRelatedKeys.length > 0) {
                cleanupResults.cleanedItems.push(`additional_keys_${userRelatedKeys.length}`);
            }
        } catch (error) {
            cleanupResults.errors.push(`Failed to scan for additional user data: ${error.message}`);
        }
        
        console.log(`🎉 Cleanup completed for ${author.firstName} ${author.lastName}. Cleaned: ${cleanupResults.cleanedItems.join(', ')}`);
        
        if (cleanupResults.errors.length > 0) {
            cleanupResults.success = false;
            console.warn(`⚠️ Some cleanup operations failed:`, cleanupResults.errors);
        }
        
    } catch (error) {
        cleanupResults.success = false;
        cleanupResults.errors.push(`General cleanup error: ${error.message}`);
        console.error(`❌ Critical error during cleanup:`, error);
    }
    
    return cleanupResults;
}

async function modifySelectedAuthor() {
    const selectedCheckboxes = document.querySelectorAll('.author-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('Please select an author to modify.');
        return;
    }
    
    if (selectedCheckboxes.length > 1) {
        alert('Please select only one author to modify.');
        return;
    }
    
    const authorId = parseInt(selectedCheckboxes[0].value);
    console.log('Modify selected - authorId from checkbox:', authorId, typeof authorId);
    
    try {
        // Fetch fresh author data from database by ID
        const response = await fetch('/authors');
        const data = await response.json();
        
        if (!data.success || !data.authors) {
            throw new Error('Failed to fetch authors');
        }
        
        const author = data.authors.find(a => a.id === authorId);
        console.log('Found author from fresh fetch:', author);
        
        if (author && author.id) {
            console.log('Opening modify modal for author ID:', author.id);
            openModifyAuthorModal(author);
        } else {
            alert('Author not found in database.');
        }
    } catch (error) {
        console.error('Error fetching author for modification:', error);
        alert('Failed to load author details. Please try again.');
    }
}

function refreshCredentialsTable() {
    fetch('/authors')
        .then(res => res.json())
        .then(data => {
            const authorsData = data.success ? data.authors : [];
            window.authors = authorsData;
            const bodyEl = document.getElementById('credentialsModalBody');
            const tableBody = document.getElementById('credentialsTableBody');

            console.log('Refreshing table with', authorsData.length, 'authors');

            if (authorsData.length === 0 && bodyEl) {
                bodyEl.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-users" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
                        <h4>No Authors Found</h4>
                        <p>Create some users first using the "Create Users" button.</p>
                        <button class="btn-primary" onclick="closeManageCredentialsModal(); openCreateUsersModal();">
                            <i class="fas fa-plus"></i> Create First User
                        </button>
                    </div>`;
            } else if (tableBody) {
                tableBody.innerHTML = authorsData.map(author => `
                    <tr class="author-row" data-author-id="${author.id}">
                        <td><input type="checkbox" class="author-checkbox" value="${author.id}" onchange="toggleBulkActions()"></td>
                        <td>${author.firstName || 'N/A'}</td>
                        <td>${author.lastName || 'N/A'}</td>
                        <td>${author.email || 'N/A'}</td>
                        <td class="paper-title" title="${author.paperTitle || 'N/A'}">${author.paperTitle || 'N/A'}</td>
                        <td>${author.paperId || 'N/A'}</td>
                        <td class="user-id">${author.userId || 'N/A'}</td>
                        <td class="password">${author.password || 'N/A'}</td>
                    </tr>`).join('');
            }

            const header = document.querySelector('.modal-header h3');
            if (header) {
                header.innerHTML = `<i class="fas fa-users-cog"></i> Manage Login Credentials (${authorsData.length} authors)`;
            }

            const selectAllCheckbox = document.getElementById('selectAll');
            const bulkActions = document.getElementById('bulkActions');
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            if (bulkActions) bulkActions.style.display = 'none';
        })
        .catch(err => {
            console.error('refreshCredentialsTable error:', err);
        });
}

// Cache authors data with 30 second TTL
let authorsCacheData = null;
let authorsCacheTime = 0;

async function fetchAuthorsFromApi() {
    const now = Date.now();
    // Return cached data if available and fresh
    if (authorsCacheData && (now - authorsCacheTime) < 30000) {
        return authorsCacheData;
    }
    
    try {
        const response = await fetch('/authors');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch authors');
        }

        const authorsData = data.authors || [];
        authorsCacheData = authorsData;
        authorsCacheTime = now;
        window.authors = authorsData;
        return authorsData;
    } catch (error) {
        console.error('fetchAuthorsFromApi error:', error);
        // Return cached or local copy on error
        return authorsCacheData || window.authors || [];
    }
}

// Clear cache when authors are modified
function invalidateAuthorsCache() {
    authorsCacheData = null;
}

function openModifyAuthorModal(author) {
    const modalHTML = `
        <div class="modal-overlay" id="modifyAuthorModal">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Modify Author Details</h3>
                    <button class="modal-close" onclick="closeModifyAuthorModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="modifyAuthorForm" onsubmit="submitModifyAuthorForm(event, ${author.id})">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="modifyFirstName">Author First Name *</label>
                                <input type="text" id="modifyFirstName" name="firstName" value="${author.firstName}" required>
                            </div>
                            <div class="form-group">
                                <label for="modifyLastName">Author Last Name *</label>
                                <input type="text" id="modifyLastName" name="lastName" value="${author.lastName}" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="modifyEmail">Email *</label>
                                <input type="email" id="modifyEmail" name="email" value="${author.email}" required>
                            </div>
                            <div class="form-group">
                                <label for="modifyPhone">Phone</label>
                                <input type="tel" id="modifyPhone" name="phone" value="${author.phone || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="modifyCompany">Company *</label>
                            <input type="text" id="modifyCompany" name="company" value="${author.company}" required>
                        </div>
                        <div class="form-group">
                            <label for="modifyPaperTitle">Paper Title *</label>
                            <input type="text" id="modifyPaperTitle" name="paperTitle" value="${author.paperTitle}" required>
                        </div>
                        <div class="form-group">
                            <label for="modifyAbstractInfo">Abstract Info *</label>
                            <textarea id="modifyAbstractInfo" name="abstractInfo" rows="4" required>${author.abstractInfo}</textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="modifyPaperId">Paper ID *</label>
                                <input type="text" id="modifyPaperId" name="paperId" value="${author.paperId}" required>
                            </div>
                            <div class="form-group">
                                <label for="modifyUserId">User ID *</label>
                                <input type="text" id="modifyUserId" name="userId" value="${author.userId}" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="modifyPassword">Password *</label>
                            <div class="password-input-group">
                                <input type="text" id="modifyPassword" name="password" value="${author.password}" required>
                                <button type="button" class="btn-generate-password" onclick="generateNewPassword()">
                                    <i class="fas fa-refresh"></i> Generate New
                                </button>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="closeModifyAuthorModal()">Cancel</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        document.getElementById('modifyAuthorModal').classList.add('active');
    }, 10);
}

function closeModifyAuthorModal() {
    const modal = document.getElementById('modifyAuthorModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function generateNewPassword() {
    const passwordField = document.getElementById('modifyPassword');
    passwordField.value = generateRandomPassword();
}

async function submitModifyAuthorForm(event, authorId) {
    event.preventDefault();
    
    console.log('submitModifyAuthorForm called with authorId:', authorId, typeof authorId);
    
    const formData = new FormData(event.target);
    const updatedData = {
        firstName: formData.get('firstName').trim(),
        lastName: formData.get('lastName').trim(),
        email: formData.get('email').trim(),
        phone: formData.get('phone').trim(),
        company: formData.get('company').trim(),
        paperTitle: formData.get('paperTitle').trim(),
        abstractInfo: formData.get('abstractInfo').trim(),
        paperId: formData.get('paperId').trim(),
        userId: formData.get('userId').trim(),
        password: formData.get('password').trim()
    };
    
    const url = `/authors/${authorId}`;
    console.log('Sending PUT to URL:', url, 'with data:', updatedData);
    
    try {
        // Send update to backend
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        console.log('PUT response status:', response.status);
        const result = await response.json();
        console.log('PUT response:', result);
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to update author');
        }
        
        // Update local client-side cache with response data
        let authorsArray;
        try {
            authorsArray = getAllAuthors();
        } catch (error) {
            if (typeof window.authors !== 'undefined' && window.authors) {
                authorsArray = window.authors;
            } else if (typeof authors !== 'undefined' && authors) {
                authorsArray = authors;
            }
        }
        
        if (authorsArray) {
            const authorIndex = authorsArray.findIndex(a => a.id === authorId);
            if (authorIndex > -1) {
                // Update with normalized field names
                authorsArray[authorIndex] = {
                    ...authorsArray[authorIndex],
                    firstName: result.author.firstName,
                    lastName: result.author.lastName,
                    email: result.author.email,
                    phone: result.author.phone,
                    company: result.author.company,
                    paperTitle: result.author.paperTitle,
                    abstractInfo: result.author.abstractInfo,
                    paperId: result.author.paperId,
                    userId: result.author.userId,
                    password: result.author.password
                };
            }

            // Keep duplicate-email credentials in sync in the current UI state
            if (updatedData.password) {
                authorsArray.forEach((authorRow) => {
                    if (
                        String(authorRow.email || '').trim().toLowerCase() ===
                        String(result.author.email || '').trim().toLowerCase()
                    ) {
                        authorRow.password = result.author.password;
                    }
                });
            }
        }
        
        // Close modify modal
        closeModifyAuthorModal();
        
        // Refresh the credentials table
        refreshCredentialsTable();
        
        alert('Author details updated successfully!');
    } catch (error) {
        console.error('Error updating author:', error);
        alert(`Failed to update author: ${error.message}`);
    }
}

// Submit Logins Created Function
function submitLoginsCreated() {
    // Get current authors data
    let authorsData = [];
    if (typeof window.authors !== 'undefined' && window.authors) {
        authorsData = window.authors;
    } else if (typeof authors !== 'undefined' && authors) {
        authorsData = authors;
    }
    
    if (authorsData.length === 0) {
        alert('No users have been created yet. Please create some users before submitting.');
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to submit the "Logins Created" stage with ${authorsData.length} user(s)?`);
    
    if (confirmed) {
        // Mark the timeline item as completed
        const timelineItem = document.querySelector('.timeline-item[data-timeline="logins-created"]');
        if (timelineItem) {
            timelineItem.classList.remove('pending');
            timelineItem.classList.add('completed');
            
            // Update the status text
            const statusElement = timelineItem.querySelector('.timeline-date');
            if (statusElement) {
                statusElement.textContent = 'Completed';
            }
        }
        
        // Show success message
        alert(`Successfully submitted "Logins Created" stage with ${authorsData.length} user(s). This stage is now marked as completed.`);
        
        // Clear the timeline content area
        const contentArea = document.getElementById('timelineContentArea');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="timeline-dashboard">
                    <div class="dashboard-header">
                        <h3><i class="fas fa-check-circle" style="color: #059669;"></i> Logins Created - Completed</h3>
                        <p>This stage has been successfully submitted with ${authorsData.length} user(s).</p>
                    </div>
                    <div class="completion-info">
                        <div class="completion-stats">
                            <div class="stat-item">
                                <i class="fas fa-users"></i>
                                <span class="stat-number">${authorsData.length}</span>
                                <span class="stat-label">Users Created</span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-calendar"></i>
                                <span class="stat-number">${new Date().toLocaleDateString()}</span>
                                <span class="stat-label">Completed On</span>
                            </div>
                        </div>
                        <button class="btn-secondary" onclick="openManageCredentialsModal()">
                            <i class="fas fa-eye"></i> View Created Users
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

// Progress Tracking Modal Functions
function getAuthorAcknowledgementLabel(response) {
    const labels = {
        yes_on_time: 'Yes, will submit on time',
        no: 'No',
        other_responses: 'Other Response'
    };

    return labels[response] || 'Not acknowledged';
}

function formatProgressDisplayDate(value) {
    if (!value) return '-';

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return `${month}/${day}/${year}`;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleDateString();
}

function getFirstDraftReminderStatus(author) {
    const uploaded = Boolean(author.firstDraftSubmitted || author.firstDraftSubmittedAt);
    const acknowledged = Boolean(author.acknowledgementResponse);

    if (uploaded) {
        return {
            statusClass: 'completed',
            statusIcon: '<i class="fas fa-check-circle" style="color: #1d4fc3;"></i>',
            statusText: 'Uploaded',
            summaryBucket: 'completed'
        };
    }

    if (acknowledged) {
        return {
            statusClass: 'in-progress',
            statusIcon: '<i class="fas fa-clock" style="color: #3967e6;"></i>',
            statusText: 'Awaiting Upload',
            summaryBucket: 'in-progress'
        };
    }

    return {
        statusClass: 'pending',
        statusIcon: '<i class="fas fa-circle" style="color: #8ba3e8;"></i>',
        statusText: 'Pending Response',
        summaryBucket: 'pending'
    };
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatUploadDateTime(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString();
}

function renderFirstDraftDownloadCell(author) {
    if (!(author.firstDraftSubmitted || author.firstDraftSubmittedAt)) {
        return '<span class="muted-text">Not uploaded</span>';
    }

    const safePaperId = encodeURIComponent(author.paperId || '');
    const safeEmail = encodeURIComponent(author.email || '');
    const fileName = author.firstDraftFileName || `first-draft-${author.paperId || author.id}.pdf`;
    const safeFileName = escapeHtml(fileName);
    const uploadDateTime = formatUploadDateTime(author.firstDraftSubmittedAt);

    return `<div style="display:flex; flex-direction:column; gap:6px;">
                <button class="btn-chat" onclick="downloadFirstDraftForAdmin('${safePaperId}', '${safeEmail}', '${safeFileName}')" title="Download submitted draft">
                    <i class="fas fa-download"></i> ${safeFileName}
                </button>
                <span style="font-size:0.85em; color:#6b7280; font-weight:500;">${uploadDateTime}</span>
            </div>`;
}

async function downloadFirstDraftForAdmin(encodedPaperId, encodedEmail, fallbackFileName) {
    try {
        const endpoint = `/author/download-first-draft/${encodedPaperId}?email=${encodedEmail}`;
        const response = await fetch(endpoint);

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || `Download failed (HTTP ${response.status})`);
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
            const payload = await response.json();
            if (!payload.success || !payload.downloadUrl) {
                throw new Error(payload.message || 'Download URL unavailable.');
            }
            window.open(payload.downloadUrl, '_blank');
            return;
        }

        // Local fallback returns binary directly; force browser download.
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = fallbackFileName || 'first-draft';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('Failed to download first draft:', error);
        alert(`Unable to download draft: ${error.message}`);
    }
}

function inferSubmissionExtension(submission) {
    const fileName = String(submission?.fileName || '').toLowerCase();
    if (fileName.endsWith('.pdf')) return 'pdf';
    if (fileName.endsWith('.docx')) return 'docx';
    if (fileName.endsWith('.doc')) return 'doc';

    const mimeType = String(submission?.fileType || '').toLowerCase();
    if (mimeType.includes('application/pdf')) return 'pdf';
    if (mimeType.includes('application/msword')) return 'doc';
    if (mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return 'docx';

    return '';
}

async function fetchAuthorSubmissionSummary(authorId) {
    if (!Number.isFinite(Number(authorId))) {
        return {
            pdf: null,
            word: null,
            latestUploadedAt: null
        };
    }

    try {
        const response = await fetch(`/authors/${authorId}/submissions`);
        if (!response.ok) {
            return { pdf: null, word: null, latestUploadedAt: null };
        }

        const data = await response.json();
        const submissions = Array.isArray(data?.submissions) ? data.submissions : [];
        let latestPdf = null;
        let latestWord = null;
        let latestUploadedAt = null;

        submissions.forEach((submission) => {
            const extension = inferSubmissionExtension(submission);
            const submittedAt = submission?.submittedAt || null;

            if (!latestUploadedAt && submittedAt) {
                latestUploadedAt = submittedAt;
            }

            if (extension === 'pdf' && !latestPdf) {
                latestPdf = {
                    fileName: submission.fileName || 'PDF file',
                    fileUrl: submission.fileUrl || '',
                    submittedAt
                };
            }

            if ((extension === 'doc' || extension === 'docx') && !latestWord) {
                latestWord = {
                    fileName: submission.fileName || 'Word file',
                    fileUrl: submission.fileUrl || '',
                    submittedAt
                };
            }
        });

        if (!latestUploadedAt) {
            latestUploadedAt = latestPdf?.submittedAt || latestWord?.submittedAt || null;
        }

        return {
            pdf: latestPdf,
            word: latestWord,
            latestUploadedAt
        };
    } catch (error) {
        console.error('Failed to load author submissions:', error);
        return {
            pdf: null,
            word: null,
            latestUploadedAt: null
        };
    }
}

function renderUploadedFileCell(fileInfo) {
    if (!fileInfo || !fileInfo.fileUrl) {
        return '<span class="muted-text">Not uploaded</span>';
    }

    const safeName = escapeHtml(fileInfo.fileName || 'Download file');
    const safeUrl = escapeHtml(fileInfo.fileUrl);
    return `<a class="btn-chat" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="Download uploaded file">
                <i class="fas fa-download"></i> ${safeName}
            </a>`;
}

async function openProgressTrackingModal(stage) {
    console.log('Opening progress tracking for stage:', stage);
    
    // Get authors data
    const authorsData = await fetchAuthorsFromApi();
    
    // Get stage title
    const stageTitles = {
        "logins-created": "Logins Created",
        "invitation-send": "Invitation Send",
        "first-draft-reminder": "First Draft Reminder",
        "paper-submission": "Paper Submission",
        "review-in-progress": "Review in Progress"
    };
    
    const stageTitle = stageTitles[stage] || stage;
    
    // For invitation-send stage, track invitation responses
    if (stage === 'invitation-send') {
        return await openInvitationTrackingModal();
    }
    
    const isFirstDraftReminderStage = stage === 'first-draft-reminder';
    const isPaperSubmissionStage = stage === 'paper-submission';
    const requiresAcceptedInvitationOnly = isFirstDraftReminderStage || isPaperSubmissionStage;
    const relevantAuthors = requiresAcceptedInvitationOnly
        ? authorsData.filter(author => (author.invitationStatus || '').toLowerCase() === 'accepted')
        : authorsData;

    // Generate progress table for other stages
    let progressRows = '';
    let completedCount = 0;
    let pendingCount = 0;
    let inProgressCount = 0;
    let completedLabel = 'Completed';
    let inProgressLabel = 'In Progress';
    let pendingLabel = 'Pending';
    let totalLabel = 'Total Authors';
    let progressTableMarkup = '';
    
    if (relevantAuthors.length > 0) {
        if (isFirstDraftReminderStage) {
            completedLabel = 'Uploaded';
            inProgressLabel = 'Acknowledged';
            pendingLabel = 'Pending Response';
            totalLabel = 'Accepted Authors';

            progressRows = relevantAuthors.map(author => {
                const reminderStatus = getFirstDraftReminderStatus(author);
                if (reminderStatus.summaryBucket === 'completed') {
                    completedCount++;
                } else if (reminderStatus.summaryBucket === 'in-progress') {
                    inProgressCount++;
                } else {
                    pendingCount++;
                }

                return `
                    <tr class="progress-row" data-author-id="${author.id}">
                        <td>
                            <input type="checkbox" class="progress-checkbox" value="${author.id}">
                        </td>
                        <td>${author.firstName} ${author.lastName}</td>
                        <td>${author.email}</td>
                        <td>${author.paperTitle}</td>
                        <td class="status-cell ${reminderStatus.statusClass}">
                            ${reminderStatus.statusIcon}
                            <span>${reminderStatus.statusText}</span>
                        </td>
                        <td>${renderFirstDraftDownloadCell(author)}</td>
                        <td>${formatProgressDisplayDate(author.firstDraftSubmittedAt)}</td>
                        <td>
                            <button class="btn-chat chat-no-unread" id="chat-btn-author-${author.id}" onclick="openAdminChat(${author.id}, '${author.paperId || ''}', '${author.firstName} ${author.lastName}')" title="Open persistent chat with ${author.firstName} ${author.lastName}">
                                <i class="fas fa-comments"></i> Chat
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            progressTableMarkup = `
                <div class="progress-table-container">
                    <table class="progress-table">
                        <thead>
                            <tr>
                                <th>
                                    <input type="checkbox" id="selectAllProgress" onchange="toggleSelectAllProgress()">
                                </th>
                                <th>Author Name</th>
                                <th>Email ID</th>
                                <th>Paper Title</th>
                                <th>Status</th>
                                <th>Draft Uploaded</th>
                                <th>Uploaded At</th>
                                <th>Chat with Author</th>
                            </tr>
                        </thead>
                        <tbody id="progressTableBody">
                            ${progressRows}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (isPaperSubmissionStage) {
            totalLabel = 'Accepted Authors';
            const submissionSummaryEntries = await Promise.all(
                relevantAuthors.map(async (author) => {
                    const summary = await fetchAuthorSubmissionSummary(author.id);
                    return [author.id, summary];
                })
            );
            const submissionSummaryByAuthorId = new Map(submissionSummaryEntries);

            progressRows = relevantAuthors.map((author) => {
                const summary = submissionSummaryByAuthorId.get(author.id) || {
                    pdf: null,
                    word: null,
                    latestUploadedAt: null
                };

                const hasPdf = Boolean(summary.pdf);
                const hasWord = Boolean(summary.word);

                let statusClass = 'pending';
                let statusIcon = '<i class="fas fa-circle" style="color: #6b7280;"></i>';
                let statusText = 'Pending';

                if (hasPdf && hasWord) {
                    statusClass = 'completed';
                    statusIcon = '<i class="fas fa-check-circle" style="color: #059669;"></i>';
                    statusText = 'Completed';
                    completedCount++;
                } else if (hasPdf || hasWord) {
                    statusClass = 'in-progress';
                    statusIcon = '<i class="fas fa-clock" style="color: #f59e0b;"></i>';
                    statusText = 'In Progress';
                    inProgressCount++;
                } else {
                    pendingCount++;
                }

                const uploadedDate = formatProgressDisplayDate(summary.latestUploadedAt);

                return `
                    <tr class="progress-row" data-author-id="${author.id}">
                        <td>
                            <input type="checkbox" class="progress-checkbox" value="${author.id}">
                        </td>
                        <td>${author.paperId || 'N/A'}</td>
                        <td>${author.email || 'N/A'}</td>
                        <td>${author.paperTitle || 'N/A'}</td>
                        <td>${renderUploadedFileCell(summary.pdf)}</td>
                        <td>${renderUploadedFileCell(summary.word)}</td>
                        <td>${uploadedDate}</td>
                        <td class="status-cell ${statusClass}">
                            ${statusIcon}
                            <span>${statusText}</span>
                        </td>
                        <td>
                            <button class="btn-chat chat-no-unread" id="chat-btn-author-${author.id}" onclick="openAdminChat(${author.id}, '${author.paperId || ''}', '${author.firstName || ''} ${author.lastName || ''}')" title="Open persistent chat with ${author.firstName || ''} ${author.lastName || ''}">
                                <i class="fas fa-comments"></i> Chat
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            progressTableMarkup = `
                <div class="progress-table-container">
                    <table class="progress-table">
                        <thead>
                            <tr>
                                <th>
                                    <input type="checkbox" id="selectAllProgress" onchange="toggleSelectAllProgress()">
                                </th>
                                <th>Paper ID</th>
                                <th>Email</th>
                                <th>Paper Title</th>
                                <th>Uploaded File (PDF)</th>
                                <th>Uploaded File (Word)</th>
                                <th>Uploaded Date</th>
                                <th>Status</th>
                                <th>Chat with Author</th>
                            </tr>
                        </thead>
                        <tbody id="progressTableBody">
                            ${progressRows}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            progressRows = relevantAuthors.map(author => {
            const stageProgress = author.progress.stages[stage];
            const statusClass = stageProgress.status;
            let statusIcon = '';
            let statusText = '';
            
            switch (stageProgress.status) {
                case 'completed':
                    statusIcon = '<i class="fas fa-check-circle" style="color: #059669;"></i>';
                    statusText = 'Completed';
                    completedCount++;
                    break;
                case 'in-progress':
                    statusIcon = '<i class="fas fa-clock" style="color: #f59e0b;"></i>';
                    statusText = 'In Progress';
                    inProgressCount++;
                    break;
                default:
                    statusIcon = '<i class="fas fa-circle" style="color: #6b7280;"></i>';
                    statusText = 'Pending';
                    pendingCount++;
            }
            
            const completedDate = stageProgress.completedAt ? 
                new Date(stageProgress.completedAt).toLocaleDateString() : '-';
            
            return `
                <tr class="progress-row" data-author-id="${author.id}">
                    <td>
                        <input type="checkbox" class="progress-checkbox" value="${author.id}">
                    </td>
                    <td>${author.firstName} ${author.lastName}</td>
                    <td>${author.email}</td>
                    <td>${author.paperTitle}</td>
                    <td class="status-cell ${statusClass}">
                        ${statusIcon}
                        <span>${statusText}</span>
                    </td>
                    <td>${completedDate}</td>
                </tr>
            `;
            }).join('');

            progressTableMarkup = `
                <div class="progress-table-container">
                    <table class="progress-table">
                        <thead>
                            <tr>
                                <th>
                                    <input type="checkbox" id="selectAllProgress" onchange="toggleSelectAllProgress()">
                                </th>
                                <th>Author Name</th>
                                <th>Email</th>
                                <th>Paper Title</th>
                                <th>Status</th>
                                <th>Completed Date</th>
                            </tr>
                        </thead>
                        <tbody id="progressTableBody">
                            ${progressRows}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
    
    const totalCount = relevantAuthors.length;
    
    const modalHTML = `
        <div class="modal-overlay progress-tracking-modal" id="progressTrackingModal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-chart-line"></i> Progress Tracking - ${stageTitle}</h3>
                    <button class="modal-close" onclick="closeProgressTrackingModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Progress Summary -->
                    <div class="progress-summary">
                        <div class="summary-card completed">
                            <div class="summary-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="summary-info">
                                <div class="summary-number">${completedCount}</div>
                                <div class="summary-label">${completedLabel}</div>
                            </div>
                        </div>
                        <div class="summary-card in-progress">
                            <div class="summary-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="summary-info">
                                <div class="summary-number">${inProgressCount}</div>
                                <div class="summary-label">${inProgressLabel}</div>
                            </div>
                        </div>
                        <div class="summary-card pending">
                            <div class="summary-icon">
                                <i class="fas fa-circle"></i>
                            </div>
                            <div class="summary-info">
                                <div class="summary-number">${pendingCount}</div>
                                <div class="summary-label">${pendingLabel}</div>
                            </div>
                        </div>
                        <div class="summary-card total">
                            <div class="summary-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="summary-info">
                                <div class="summary-number">${totalCount}</div>
                                <div class="summary-label">${totalLabel}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Progress Controls -->
                    <div class="progress-controls">
                        <div class="progress-actions">
                            <button class="btn-success" onclick="bulkUpdateProgress('completed', '${stage}')">
                                <i class="fas fa-check"></i> Mark Selected as Completed
                            </button>
                            <button class="btn-warning" onclick="bulkUpdateProgress('in-progress', '${stage}')">
                                <i class="fas fa-clock"></i> Mark Selected as In Progress
                            </button>
                            <button class="btn-secondary" onclick="bulkUpdateProgress('pending', '${stage}')">
                                <i class="fas fa-circle"></i> Mark Selected as Pending
                            </button>
                        </div>
                    </div>
                    
                    <!-- Progress Table -->
                    ${totalCount > 0 ? progressTableMarkup : `
                    <div class="no-data">
                        <i class="fas fa-users" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
                        <h4>No Authors Found</h4>
                        <p>No authors are available to track progress for this stage.</p>
                    </div>
                    `}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeProgressTrackingModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        document.getElementById('progressTrackingModal').classList.add('active');
        
        // Check unread status for chat buttons in progress tracking tables.
        if (isFirstDraftReminderStage || isPaperSubmissionStage) {
            relevantAuthors.forEach((author) => {
                const chatBtn = document.getElementById(`chat-btn-author-${author.id}`);
                if (chatBtn) {
                    checkAuthorChatUnreadStatus(author.id, chatBtn);
                    // Check every 30 seconds (reduced from 10 for better performance)
                    setInterval(() => checkAuthorChatUnreadStatus(author.id, chatBtn), 30000);
                }
            });
        }
    }, 10);
}

function closeProgressTrackingModal() {
    const modal = document.getElementById('progressTrackingModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// ==================== TIMELINE MODAL FUNCTIONS ====================

const DATE_SCHEDULE_STAGES = [
    { key: 'logins-created', label: 'User and Review Creation' },
    { key: 'invitation-send', label: 'Invitation mails' },
    { key: 'first-draft-reminder', label: 'First Draft submission' },
    { key: 'paper-submission', label: 'Final Paper Submission' }
];

function toLocalDateTimeInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function setDatesEditMode(enabled) {
    const modal = document.getElementById('datesModal');
    if (!modal) return;
    modal.dataset.editMode = enabled ? 'true' : 'false';

    const inputs = modal.querySelectorAll('input[type="datetime-local"]');
    inputs.forEach((input) => {
        input.disabled = !enabled;
    });

    const modifyButton = modal.querySelector('#datesModifyBtn');
    const saveButton = modal.querySelector('#datesSaveBtn');
    const modeBadge = modal.querySelector('#datesModeBadge');

    if (modifyButton) {
        modifyButton.disabled = enabled;
        modifyButton.style.opacity = enabled ? '0.7' : '1';
        modifyButton.style.cursor = enabled ? 'not-allowed' : 'pointer';
    }

    if (saveButton) {
        saveButton.disabled = !enabled;
        saveButton.style.opacity = enabled ? '1' : '0.6';
        saveButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    if (modeBadge) {
        modeBadge.textContent = enabled ? 'Edit Mode' : 'View Mode';
        modeBadge.style.background = enabled ? '#fef3c7' : '#e2e8f0';
        modeBadge.style.color = enabled ? '#92400e' : '#475569';
    }
}

async function openDatesModal() {
    let schedulesByStage = {};

    try {
        const response = await fetch(`/timeline-schedules?_=${Date.now()}`);
        const data = await response.json();

        if (data.success && Array.isArray(data.schedules)) {
            schedulesByStage = data.schedules.reduce((acc, schedule) => {
                acc[schedule.stage] = schedule;
                return acc;
            }, {});
        }
    } catch (err) {
        console.error('Error loading saved date schedules:', err);
    }

    const rows = DATE_SCHEDULE_STAGES.map(({ key, label }) => {
        const existing = schedulesByStage[key] || {};
        const endValue = toLocalDateTimeInputValue(existing.end_time);

        return `
            <tr>
                <td style="font-weight: 600; color: #334155; padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">${label}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                    <input type="datetime-local" data-stage="${key}" data-boundary="end" value="${endValue}" style="width: 100%; min-width: 200px;">
                </td>
            </tr>
        `;
    }).join('');

    const modalHTML = `
        <div class="modal-overlay" id="datesModal">
            <div class="modal-container" style="max-width: 980px; width: 95%;">
                <div class="modal-header">
                    <h3><i class="fas fa-calendar-alt"></i> Dates</h3>
                    <button class="modal-close" onclick="closeDatesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
                        <p style="margin: 0; color: #64748b;">Set end date-time for each workflow criterion.</p>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span id="datesModeBadge" style="padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569;">View Mode</span>
                            <button type="button" class="btn-warning" id="datesModifyBtn" onclick="setDatesEditMode(true)">
                                <i class="fas fa-pen"></i> Modify
                            </button>
                        </div>
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8fafc;">
                                    <th style="text-align: left; padding: 12px 10px; border-bottom: 1px solid #cbd5e1; color: #1e293b;">Criteria</th>
                                    <th style="text-align: left; padding: 12px 10px; border-bottom: 1px solid #cbd5e1; color: #1e293b;">End Date & Time</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <div class="form-actions" style="margin-top: 18px; display: flex; gap: 10px;">
                        <button type="button" class="btn-secondary" onclick="closeDatesModal()" style="flex: 1;">Cancel</button>
                        <button type="button" class="btn-primary" id="datesSaveBtn" onclick="saveDatesModal()" style="flex: 1;">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => {
        const modal = document.getElementById('datesModal');
        if (modal) {
            modal.classList.add('active');
            setDatesEditMode(false);
        }
    }, 10);
}

function closeDatesModal() {
    const modal = document.getElementById('datesModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

async function saveDatesModal() {
    const modal = document.getElementById('datesModal');
    const saveButton = document.getElementById('datesSaveBtn');
    if (!modal) return;

    if (modal.dataset.editMode !== 'true') {
        alert('Click Modify first to edit and save dates.');
        return;
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        for (const { key, label } of DATE_SCHEDULE_STAGES) {
            const endInput = document.querySelector(`#datesModal input[data-stage="${key}"][data-boundary="end"]`);

            const endValue = endInput ? endInput.value : '';

            if (!endValue) {
                alert(`Please fill End date-time for "${label}".`);
                return;
            }

            if (Number.isNaN(new Date(endValue).getTime())) {
                alert(`Please enter a valid End date-time for "${label}".`);
                return;
            }

            const response = await fetch('/timeline-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stage: key,
                    startTime: null,
                    endTime: new Date(endValue).toISOString()
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || `Failed to save ${label}`);
            }
        }

        alert('Dates updated successfully and saved to database.');
        setDatesEditMode(false);
        loadWorkflowDatesFromDatabase();
    } catch (err) {
        console.error('Error saving dates:', err);
        alert(`Failed to save dates: ${err.message}`);
        setDatesEditMode(true);
    } finally {
        if (saveButton) {
            saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            if (modal.dataset.editMode === 'true') {
                saveButton.disabled = false;
            }
        }
    }
}

async function openTimelineModal(stage) {
    console.log('Opening timeline modal for stage:', stage);
    
    // Stage display names
    const stageTitles = {
        "logins-created": "Logins Created",
        "invitation-send": "Conference Invitation",
        "first-draft-reminder": "First Draft Reminder",
        "paper-submission": "Final Paper Reminder",
        "review-in-progress": "Review in Progress"
    };
    
    const stageEmojis = {
        "logins-created": "fas fa-user-check",
        "invitation-send": "fas fa-envelope-open",
        "first-draft-reminder": "fas fa-bell",
        "paper-submission": "fas fa-file-pdf",
        "review-in-progress": "fas fa-tasks"
    };
    
    // Load existing timeline data
    let existingTimeline = null;
    try {
        const response = await fetch('/timeline-schedules');
        const data = await response.json();
        if (data.success && data.schedules) {
            existingTimeline = data.schedules.find(s => s.stage === stage);
        }
    } catch (err) {
        console.error('Error loading timeline:', err);
    }
    
    // Format existing times for input fields
    let existingStart = '';
    let existingEnd = '';
    if (existingTimeline) {
        existingStart = existingTimeline.start_time ? new Date(existingTimeline.start_time).toISOString().slice(0, 16) : '';
        existingEnd = existingTimeline.end_time ? new Date(existingTimeline.end_time).toISOString().slice(0, 16) : '';
    }
    
    const modalHTML = `
        <div class="modal-overlay" id="timelineModal">
            <div class="modal-container" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="${stageEmojis[stage] || 'fas fa-clock'}"></i> Timeline Schedule: ${stageTitles[stage] || stage}</h3>
                    <button class="modal-close" onclick="closeTimelineModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="timelineForm" onsubmit="saveTimeline(event, '${stage}')">
                        <div class="timeline-info" style="background: #f0f4ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 0; color: #666;"><i class="fas fa-info-circle" style="margin-right: 8px;"></i>Set the start and end dates/times for this stage</p>
                        </div>
                        
                        <div class="form-group">
                            <label for="startTime"><i class="fas fa-play-circle" style="color: #4CAF50; margin-right: 8px;"></i>Start Time *</label>
                            <input type="datetime-local" id="startTime" name="startTime" value="${existingStart}" required>
                            <small style="color: #999;">When this stage should begin</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="endTime"><i class="fas fa-stop-circle" style="color: #f44336; margin-right: 8px;"></i>End Time *</label>
                            <input type="datetime-local" id="endTime" name="endTime" value="${existingEnd}" required>
                            <small style="color: #999;">When this stage should end</small>
                        </div>
                        
                        <div class="form-actions" style="margin-top: 25px; display: flex; gap: 10px;">
                            <button type="button" class="btn-secondary" onclick="closeTimelineModal()" style="flex: 1;">Cancel</button>
                            <button type="submit" class="btn-primary" style="flex: 1;">
                                <i class="fas fa-save"></i> Save Timeline
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        document.getElementById('timelineModal').classList.add('active');
    }, 10);
}

function closeTimelineModal() {
    const modal = document.getElementById('timelineModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

async function saveTimeline(event, stage) {
    event.preventDefault();
    
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    if (!startTime || !endTime) {
        alert('Please fill in both start and end times.');
        return;
    }
    
    // Validate end time is after start time
    if (new Date(endTime) <= new Date(startTime)) {
        alert('End time must be after start time.');
        return;
    }
    
    try {
        const response = await fetch('/timeline-schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stage: stage,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Timeline for "${stage}" saved successfully!`);
            closeTimelineModal();
        } else {
            alert(`❌ Error saving timeline: ${data.message}`);
        }
    } catch (err) {
        console.error('Error saving timeline:', err);
        alert('Failed to save timeline. Please try again.');
    }
}

// ====================== END TIMELINE FUNCTIONS =======================

async function openInvitationTrackingModal() {
    console.log('Opening invitation tracking modal');
    
    // Get authors data
    const authorsData = await fetchAuthorsFromApi();
    console.log('✅ Authors data loaded:', authorsData.length, 'authors');
    console.log('Authors data:', authorsData);
    
    if (!authorsData || authorsData.length === 0) {
        console.error('⚠️ No authors data available');
    }
    
    // Track invitation statistics
    let sentCount = 0;
    let acceptedCount = 0;
    let declinedCount = 0;
    let pendingCount = 0;
    let notSentCount = 0;
    
    // Generate invitation tracking table
    let invitationRows = '';
    
    if (authorsData.length > 0) {
        invitationRows = authorsData.map(author => {
            // Null-safe progress stage access
            const inviteStage = author.progress && author.progress.stages && author.progress.stages['invitation-send'];
            const invitationSent = inviteStage ? inviteStage.status === 'completed' : false;
            
            // Get invitation response status
            const invitationStatus = author.invitationStatus || 'pending';
            const firstLoginCompleted = author.firstLoginCompleted || false;
            const rejectionEmailSentAt = author.rejectionEmailSentAt || null;
            
            let statusIcon = '';
            let statusText = '';
            let statusClass = '';
            
            if (!invitationSent) {
                statusIcon = '<i class="fas fa-circle" style="color: #6b7280;"></i>';
                statusText = 'Not Sent';
                statusClass = 'not-sent';
                notSentCount++;
            } else {
                sentCount++;

                if (rejectionEmailSentAt) {
                    statusIcon = '<i class="fas fa-ban" style="color: #dc2626;"></i>';
                    statusText = 'Paper Rejected';
                    statusClass = 'declined';
                    declinedCount++;
                } else {
                    switch (invitationStatus) {
                        case 'accepted':
                            statusIcon = '<i class="fas fa-check-circle" style="color: #059669;"></i>';
                            statusText = 'Accepted';
                            statusClass = 'accepted';
                            acceptedCount++;
                            break;
                        case 'declined':
                            statusIcon = '<i class="fas fa-times-circle" style="color: #dc2626;"></i>';
                            statusText = 'Declined';
                            statusClass = 'declined';
                            declinedCount++;
                            break;
                        default:
                            statusIcon = '<i class="fas fa-clock" style="color: #f59e0b;"></i>';
                            statusText = firstLoginCompleted ? 'Pending Response' : 'Awaiting First Login';
                            statusClass = 'pending';
                            pendingCount++;
                    }
                }
            }
            
            const sentDate = inviteStage && inviteStage.completedAt ?
                new Date(inviteStage.completedAt).toLocaleDateString() : '-';
            
            const responseDate = rejectionEmailSentAt
                ? new Date(rejectionEmailSentAt).toLocaleDateString()
                : author.invitationResponseDate
                    ? new Date(author.invitationResponseDate).toLocaleDateString()
                    : '-';
            
            return `
                <tr class="itr-row" data-author-id="${author.id}">
                    <td class="itr-author-name">${author.firstName} ${author.lastName}</td>
                    <td class="itr-email">${author.email}</td>
                    <td class="itr-paper-title">${author.paperTitle}</td>
                    <td class="itr-date">${sentDate}</td>
                    <td><span class="itr-status itr-status-${statusClass}">${statusIcon} ${statusText}</span></td>
                    <td class="itr-date">${responseDate}</td>
                    <td>
                        ${invitationSent ?
                            `<button class="itr-action-btn itr-action-resend" onclick="resendInvitation('${author.userId}')">
                                <i class="fas fa-paper-plane"></i> Resend
                            </button>` :
                            `<button class="itr-action-btn itr-action-send" onclick="sendInvitationToAuthor('${author.userId}')">
                                <i class="fas fa-envelope"></i> Send
                            </button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    const totalCount = authorsData.length;
    
    const modalHTML = `
        <div class="modal-overlay itr-modal-overlay" id="progressTrackingModal">
            <div class="itr-modal">
                <!-- Header -->
                <div class="itr-header">
                    <div class="itr-header-left">
                        <div class="itr-header-icon"><i class="fas fa-envelope-open-text"></i></div>
                        <div>
                            <h2 class="itr-title">Invitation Tracking &amp; Responses</h2>
                            <p class="itr-subtitle">${totalCount} author${totalCount !== 1 ? 's' : ''} total</p>
                        </div>
                    </div>
                    <button class="itr-close-btn" onclick="closeProgressTrackingModal()">&times;</button>
                </div>

                <!-- Stats Row -->
                <div class="itr-stats">
                    <div class="itr-stat-card itr-stat-total">
                        <div class="itr-stat-icon"><i class="fas fa-users"></i></div>
                        <div class="itr-stat-num">${totalCount}</div>
                        <div class="itr-stat-lbl">Total Authors</div>
                    </div>
                    <div class="itr-stat-card itr-stat-sent">
                        <div class="itr-stat-icon"><i class="fas fa-paper-plane"></i></div>
                        <div class="itr-stat-num">${sentCount}</div>
                        <div class="itr-stat-lbl">Invitations Sent</div>
                    </div>
                    <div class="itr-stat-card itr-stat-accepted">
                        <div class="itr-stat-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="itr-stat-num">${acceptedCount}</div>
                        <div class="itr-stat-lbl">Accepted</div>
                    </div>
                    <div class="itr-stat-card itr-stat-pending">
                        <div class="itr-stat-icon"><i class="fas fa-clock"></i></div>
                        <div class="itr-stat-num">${pendingCount}</div>
                        <div class="itr-stat-lbl">Pending</div>
                    </div>
                    <div class="itr-stat-card itr-stat-declined">
                        <div class="itr-stat-icon"><i class="fas fa-times-circle"></i></div>
                        <div class="itr-stat-num">${declinedCount}</div>
                        <div class="itr-stat-lbl">Declined</div>
                    </div>
                </div>

                <!-- Table -->
                <div class="itr-body">
                    ${totalCount > 0 ? `
                    <div class="itr-table-wrap">
                        <table class="itr-table">
                            <thead>
                                <tr>
                                    <th style="width:130px;">Author Name</th>
                                    <th style="width:160px;">Email</th>
                                    <th style="width:320px;">Paper Title</th>
                                    <th style="width:110px;">Invitation Sent</th>
                                    <th style="width:150px;">Response Status</th>
                                    <th style="width:110px;">Response Date</th>
                                    <th style="width:100px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="invitationTableBody">
                                ${invitationRows}
                            </tbody>
                        </table>
                    </div>
                    ` : `
                    <div class="itr-empty">
                        <i class="fas fa-envelope-open"></i>
                        <h4>No Authors Found</h4>
                        <p>No authors are available to track invitation responses.</p>
                    </div>
                    `}
                </div>

                <!-- Footer -->
                <div class="itr-footer">
                    <button class="itr-btn-secondary" onclick="closeProgressTrackingModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        document.getElementById('progressTrackingModal').classList.add('active');
    }, 10);
}

function toggleSelectAllProgress() {
    const selectAllCheckbox = document.getElementById('selectAllProgress');
    const progressCheckboxes = document.querySelectorAll('.progress-checkbox');
    
    progressCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

function bulkUpdateProgress(status, stage) {
    const selectedCheckboxes = document.querySelectorAll('.progress-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('Please select authors to update.');
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to mark ${selectedCheckboxes.length} selected author(s) as ${status} for this stage?`);
    
    if (confirmed) {
        const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        let updated = 0;
        
        selectedIds.forEach(authorId => {
            if (updateAuthorProgress(authorId, stage, status, `Bulk updated to ${status}`)) {
                updated++;
            }
        });
        
        if (updated > 0) {
            alert(`Successfully updated ${updated} author(s) to ${status}.`);
            // Refresh the modal
            closeProgressTrackingModal();
            setTimeout(() => {
                openProgressTrackingModal(stage);
            }, 100);
        }
    }
}

function openUpdateProgressModal(authorId, stage) {
    // Get author data
    let author = null;
    if (typeof window.authors !== 'undefined' && window.authors) {
        author = window.authors.find(a => a.id === authorId);
    } else if (typeof authors !== 'undefined' && authors) {
        author = authors.find(a => a.id === authorId);
    }
    
    if (!author) {
        alert('Author not found.');
        return;
    }
    
    const stageProgress = author.progress.stages[stage];
    const stageTitles = {
        "logins-created": "Logins Created",
        "invitation-send": "Invitation Send",
        "first-draft-reminder": "First Draft Reminder",
        "paper-submission": "Paper Submission",
        "review-in-progress": "Review in Progress"
    };
    
    const modalHTML = `
        <div class="modal-overlay" id="updateProgressModal">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Update Progress</h3>
                    <button class="modal-close" onclick="closeUpdateProgressModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="update-progress-info">
                        <h4>${author.firstName} ${author.lastName}</h4>
                        <p><strong>Stage:</strong> ${stageTitles[stage]}</p>
                        <p><strong>Paper:</strong> ${author.paperTitle}</p>
                    </div>
                    <form id="updateProgressForm" onsubmit="submitProgressUpdate(event, ${authorId}, '${stage}')">
                        <div class="form-group">
                            <label for="progressStatus">Status *</label>
                            <select id="progressStatus" name="status" required>
                                <option value="pending" ${stageProgress.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="in-progress" ${stageProgress.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                <option value="completed" ${stageProgress.status === 'completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="progressNotes">Notes</label>
                            <textarea id="progressNotes" name="notes" rows="3" placeholder="Add any notes about this stage...">${stageProgress.notes || ''}</textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="closeUpdateProgressModal()">Cancel</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Update Progress
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        document.getElementById('updateProgressModal').classList.add('active');
    }, 10);
}

function closeUpdateProgressModal() {
    const modal = document.getElementById('updateProgressModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function submitProgressUpdate(event, authorId, stage) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const status = formData.get('status');
    const notes = formData.get('notes');
    
    if (updateAuthorProgress(authorId, stage, status, notes)) {
        alert('Progress updated successfully!');
        closeUpdateProgressModal();
        
        // Refresh the progress tracking modal if it's open
        setTimeout(() => {
            if (document.getElementById('progressTrackingModal')) {
                closeProgressTrackingModal();
                setTimeout(() => {
                    openProgressTrackingModal(stage);
                }, 100);
            }
        }, 100);
    } else {
        alert('Error updating progress. Please try again.');
    }
}

function loadProjectsContent() {
    const content = document.querySelector('.content');
    content.innerHTML = `
        <div class="page-header">
            <h2>Draft Review</h2>
            <p style="color: #666; margin-top: 10px;">Review and manage submitted first drafts</p>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-file-alt"></i> Submitted Drafts</h3>
                <button class="btn-primary" onclick="refreshDraftReviews()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
            <div class="card-content">
                <div id="draftReviewTable">
                    <!-- Table will be populated by loadDraftReviews() -->
                </div>
            </div>
        </div>
    `;
    
    // Load the draft reviews table
    loadDraftReviews();
}

function loadDocumentsContent() {
    const content = document.querySelector('.content');
    content.innerHTML = `
        <div class="page-header">
            <h2>Document Vault</h2>
            <p style="color: #666; margin-top: 10px;">Upload admin documents after malware scanning and track upload dates</p>
        </div>

        <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
                <h3><i class="fas fa-upload"></i> Upload Document</h3>
            </div>
            <div class="card-content">
                <form id="adminDocumentUploadForm" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <input type="file" id="adminDocumentFile" name="documentFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" required>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-cloud-upload-alt"></i> Scan & Upload
                    </button>
                    <small style="color:#666;">Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV. Max: 25 MB</small>
                </form>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-table"></i> Uploaded Documents</h3>
                <button class="btn-primary" onclick="refreshAdminDocuments()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
            <div class="card-content">
                <div id="adminDocumentsTable"></div>
            </div>
        </div>
    `;

    const form = document.getElementById('adminDocumentUploadForm');
    if (form) {
        form.addEventListener('submit', uploadAdminDocument);
    }

    loadAdminDocuments();
}

function loadUsersContent() {
    const content = document.querySelector('.content');
    const allAdmins = getAllAdmins();
    
    let usersHTML = `
        <div class="page-header">
            <h2>User Management</h2>
            <button class="btn-primary">
                <i class="fas fa-plus"></i> Add User
            </button>
        </div>
        <div class="card">
            <div class="card-header">
                <h3>Admin Users</h3>
            </div>
            <div class="card-content">
                <div class="users-table">
    `;
    
    allAdmins.forEach(admin => {
        usersHTML += `
            <div class="user-row">
                <div class="user-info">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <h4>${admin.fullName}</h4>
                        <p>${admin.email}</p>
                    </div>
                </div>
                <div class="user-role">${admin.role}</div>
                <div class="user-actions">
                    <button class="btn-secondary">Edit</button>
                    <button class="btn-danger">Delete</button>
                </div>
            </div>
        `;
    });
    
    usersHTML += `
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = usersHTML;
}

function loadAnalyticsContent() {
    const content = document.querySelector('.content');
    content.innerHTML = `
        <div class="page-header">
            <h2>Analytics Dashboard</h2>
        </div>
        <div class="analytics-grid">
            <div class="card">
                <div class="card-header">
                    <h3>Performance Metrics</h3>
                </div>
                <div class="card-content">
                    <p>Analytics charts and metrics would go here...</p>
                </div>
            </div>
        </div>
    `;
}

function loadSettingsContent() {
    const content = document.querySelector('.content');
    const session = getSession();
    
    content.innerHTML = `
        <div class="page-header">
            <h2>Settings</h2>
        </div>
        <div class="settings-grid">
            <div class="card">
                <div class="card-header">
                    <h3>Profile Settings</h3>
                </div>
                <div class="card-content">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" value="${session.user.fullName}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" value="${session.user.email}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <input type="text" value="${session.user.role}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Last Login</label>
                        <input type="text" value="${new Date(session.user.lastLogin).toLocaleString()}" readonly>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadDashboardData() {
    // Load initial dashboard content
    loadDashboardContent();
}

function updateDashboardStats() {
    // This would typically fetch real data from an API
    // For demo purposes, we'll just animate the numbers
    animateNumbers();
}

function animateNumbers() {
    const statNumbers = document.querySelectorAll('.stat-info h3');
    
    statNumbers.forEach(element => {
        const finalNumber = parseInt(element.textContent);
        let currentNumber = 0;
        const increment = finalNumber / 20;
        
        const timer = setInterval(() => {
            currentNumber += increment;
            if (currentNumber >= finalNumber) {
                element.textContent = finalNumber + (element.textContent.includes('%') ? '%' : '');
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(currentNumber) + (element.textContent.includes('%') ? '%' : '');
            }
        }, 50);
    });
}

function showWelcomeMessage(userName) {
    const message = document.createElement('div');
    message.className = 'welcome-message';
    message.innerHTML = `
        <div class="welcome-content">
            <i class="fas fa-check-circle"></i>
            <span>Welcome back, ${userName.split(' ')[0]}!</span>
        </div>
    `;
    
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1001;
        animation: slideInRight 0.5s ease;
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 500);
    }, 3000);
}

function handleLogout() {
    // Confirm logout
    if (confirm('Are you sure you want to logout?')) {
        // Clear session
        clearSession();
        
        // Show logout message
        const message = document.createElement('div');
        message.textContent = 'Logged out successfully!';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
        `;
        
        document.body.appendChild(message);
        
        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .welcome-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
    }
    
    .page-header h2 {
        font-size: 28px;
        font-weight: 600;
        color: #333;
    }
    
    .users-table {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    
    .user-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 0;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .user-row:last-child {
        border-bottom: none;
    }
    
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }
    
    .user-info .user-avatar {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }
    
    .user-info .user-details h4 {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
    }
    
    .user-info .user-details p {
        font-size: 14px;
        color: #666;
    }
    
    .user-role {
        padding: 6px 12px;
        background: #f0f0f0;
        border-radius: 6px;
        font-size: 12px;
        color: #666;
        font-weight: 500;
    }
    
    .user-actions {
        display: flex;
        gap: 8px;
    }
    
    .btn-secondary {
        padding: 6px 12px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    
    .btn-danger {
        padding: 6px 12px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    
    .form-group {
        margin-bottom: 20px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #333;
    }
    
    .form-group input {
        width: 100%;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        background: #f9f9f9;
    }
    
    .projects-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 20px;
    }
    
    .project-meta {
        margin-top: 8px;
        display: flex;
        gap: 15px;
        font-size: 12px;
        color: #888;
    }
    
    .project-date, .project-team {
        display: flex;
        align-items: center;
    }
    
    @media (max-width: 768px) {
        .projects-grid {
            grid-template-columns: 1fr;
        }
    }
    
    .project-actions {
        display: flex;
        gap: 8px;
    }
    
    .template-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    
    .template-item {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 16px 0;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .template-item:last-child {
        border-bottom: none;
    }
    
    .template-item i {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
    }
    
    .template-info {
        flex: 1;
    }
    
    .template-info h4 {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
    }
    
    .template-info p {
        font-size: 14px;
        color: #666;
    }

    /* Timeline Dashboard Panel (White + Royal Blue) */
    .timeline-content-area {
        margin-top: 26px;
        padding: 0;
    }

    .timeline-dashboard {
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        border: 1px solid #d8e3fb;
        border-radius: 18px;
        padding: 30px 28px;
        box-shadow: 0 12px 26px rgba(24, 56, 146, 0.1);
    }

    .timeline-dashboard .dashboard-header {
        text-align: center;
        margin-bottom: 26px;
    }

    .timeline-dashboard .dashboard-header h3 {
        color: #2f56cc;
        font-size: 34px;
        font-weight: 700;
        line-height: 1.18;
        letter-spacing: 0.2px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    .timeline-dashboard .dashboard-header h3 i {
        font-size: 0.9em;
    }

    .timeline-dashboard .dashboard-header p {
        color: #4a649e;
        font-size: 17px;
        font-weight: 500;
        margin: 0;
    }

    .timeline-dashboard .dashboard-actions {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
    }

    .timeline-dashboard .dashboard-actions button {
        border: 1px solid transparent;
        border-radius: 14px;
        padding: 13px 24px;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.1px;
        min-height: 52px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        cursor: pointer;
        transition: transform 0.18s ease, box-shadow 0.22s ease, filter 0.22s ease;
    }

    .timeline-dashboard .dashboard-actions button i,
    .timeline-dashboard .btn-submit i {
        font-size: 0.86em;
    }

    .timeline-dashboard .dashboard-actions button:hover {
        transform: translateY(-2px);
        filter: brightness(1.03);
    }

    .timeline-dashboard .btn-primary,
    .timeline-dashboard .create-users-btn {
        background: linear-gradient(135deg, #2f56cc 0%, #5f80e6 100%);
        color: #ffffff;
        box-shadow: 0 8px 18px rgba(47, 86, 204, 0.25);
    }

    .timeline-dashboard .btn-secondary,
    .timeline-dashboard .manage-credentials-btn {
        background: #ffffff;
        color: #1f3f9f;
        border-color: #b9c9f4;
        box-shadow: 0 6px 14px rgba(58, 88, 171, 0.14);
    }

    .timeline-dashboard .btn-warning {
        background: linear-gradient(135deg, #d88a2a 0%, #e6a94c 100%);
        color: #ffffff;
        box-shadow: 0 8px 16px rgba(216, 138, 42, 0.3);
    }

    .timeline-dashboard .btn-info,
    .timeline-dashboard .track-progress-btn {
        background: linear-gradient(135deg, #365fd2 0%, #6585e8 100%);
        color: #ffffff;
        box-shadow: 0 8px 18px rgba(54, 95, 210, 0.26);
    }

    .timeline-dashboard .submit-section {
        margin-top: 28px;
        padding-top: 22px;
        border-top: 1px solid #d8e3fb;
        text-align: center;
    }

    .timeline-dashboard .btn-submit {
        background: linear-gradient(135deg, #1e4db9 0%, #2f56cc 100%);
        color: #ffffff;
        border: 1px solid #2f56cc;
        border-radius: 14px;
        padding: 14px 42px;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.2px;
        box-shadow: 0 10px 22px rgba(30, 77, 185, 0.28);
        transition: transform 0.2s ease, box-shadow 0.22s ease, filter 0.2s ease;
    }

    .timeline-dashboard .btn-submit:hover {
        transform: translateY(-2px);
        filter: brightness(1.04);
        box-shadow: 0 12px 24px rgba(30, 77, 185, 0.34);
    }
    
    /* Timeline Styles - Infographic Layout */
    .timeline-section {
        background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
        border-radius: 18px;
        padding: 30px 20px 24px;
        margin-top: 22px;
        border: 1px solid #dbe4fb;
        box-shadow: 0 14px 30px rgba(31, 60, 145, 0.08);
        overflow-x: auto;
    }
    
    .timeline-section h3 {
        font-size: 24px;
        font-weight: 700;
        color: #1d336c;
        margin-bottom: 20px;
        text-align: center;
        letter-spacing: 0.2px;
    }
    
    .timeline-container.horizontal {
        display: flex;
        align-items: stretch;
        padding: 6px 20px;
        min-width: max-content;
        width: max-content;
        margin: 0 auto;
        gap: 22px;
        justify-content: center;
        position: relative;
    }
    
    .timeline-container.horizontal::before {
        content: '';
        position: absolute;
        left: 75px;
        right: 75px;
        top: 50%;
        height: 14px;
        transform: translateY(-50%);
        background: linear-gradient(90deg, #b95986 0%, #6170b5 28%, #3f5f9f 48%, #4e87cf 62%, #cc665f 82%, #cf9a58 100%);
        border-radius: 999px;
        z-index: 0;
    }
    
    .timeline-item {
        position: relative;
        width: 188px;
        min-width: 188px;
        height: 330px;
        cursor: pointer;
        transition: transform 0.22s ease;
    }
    
    .timeline-item:hover {
        transform: translateY(-2px);
    }
    
    .timeline-dot {
        width: 86px;
        height: 86px;
        border-radius: 50%;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
        background: #ffffff;
        border: 7px solid #7f8ab6;
        box-shadow: 0 10px 20px rgba(27, 42, 90, 0.14);
    }
    
    .timeline-dot::before {
        content: '';
        position: absolute;
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid rgba(52, 72, 130, 0.16);
    }
    
    .timeline-dot i {
        position: relative;
        z-index: 1;
        font-size: 24px;
        color: #4a5c93;
    }
    
    .timeline-item:nth-child(1) .timeline-dot { border-color: #c16e98; }
    .timeline-item:nth-child(2) .timeline-dot { border-color: #7d79a8; }
    .timeline-item:nth-child(3) .timeline-dot { border-color: #466995; }
    .timeline-item:nth-child(4) .timeline-dot { border-color: #5a94d5; }
    .timeline-item:nth-child(5) .timeline-dot { border-color: #c76862; }
    .timeline-item:nth-child(6) .timeline-dot { border-color: #d18f4f; }
    .timeline-item:nth-child(7) .timeline-dot { border-color: #2f56cc; }
    
    .timeline-connector {
        position: absolute;
        top: 50%;
        right: -11px;
        width: 22px;
        height: 14px;
        transform: translateY(-50%);
        background: transparent;
        z-index: 2;
    }
    
    .timeline-connector::after {
        content: '';
        position: absolute;
        right: -1px;
        top: 50%;
        transform: translateY(-50%);
        border-top: 7px solid transparent;
        border-bottom: 7px solid transparent;
        border-left: 11px solid rgba(70, 95, 160, 0.62);
    }
    
    .timeline-item:last-child .timeline-connector {
        display: none;
    }
    
    .timeline-content {
        width: 170px;
        min-height: 128px;
        background: rgba(255, 255, 255, 0.97);
        border: 1px solid #e4e9f8;
        border-radius: 14px;
        box-shadow: 0 8px 18px rgba(31, 60, 145, 0.08);
        padding: 14px 12px;
        text-align: center;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        transition: box-shadow 0.22s ease, border-color 0.22s ease;
        z-index: 1;
    }
    
    .timeline-item:nth-child(odd) .timeline-content {
        top: 6px;
    }
    
    .timeline-item:nth-child(even) .timeline-content {
        bottom: 6px;
    }
    
    .timeline-title {
        font-size: 15px;
        font-weight: 700;
        color: #1f3368;
        margin-bottom: 8px;
        line-height: 1.25;
    }
    
    .timeline-description {
        font-size: 12px;
        color: #5b6f9e;
        line-height: 1.35;
        margin-bottom: 10px;
        max-height: 34px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    
    .timeline-date {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.7px;
        color: #596ea8;
    }
    
    .timeline-item.completed .timeline-content {
        border-color: #b8c8f4;
    }
    
    .timeline-item.completed .timeline-dot {
        box-shadow: 0 10px 20px rgba(31, 77, 182, 0.25);
    }
    
    .timeline-item.completed .timeline-dot i,
    .timeline-item.completed .timeline-date {
        color: #1f4db6;
    }
    
    .timeline-item.active .timeline-content {
        border-color: #7f98df;
        box-shadow: 0 12px 24px rgba(31, 60, 145, 0.18);
    }
    
    .timeline-item.active .timeline-dot {
        animation: pulse 2.1s infinite;
        box-shadow: 0 12px 22px rgba(23, 63, 154, 0.24);
    }
    
    .timeline-item.active .timeline-dot i,
    .timeline-item.active .timeline-date {
        color: #173f9a;
    }
    
    .timeline-item.pending .timeline-date {
        color: #5a75b2;
    }
    
    @keyframes pulse {
        0% {
            box-shadow: 0 12px 22px rgba(23, 63, 154, 0.24), 0 0 0 0 rgba(52, 95, 214, 0.3);
        }
        70% {
            box-shadow: 0 12px 22px rgba(23, 63, 154, 0.24), 0 0 0 11px rgba(52, 95, 214, 0);
        }
        100% {
            box-shadow: 0 12px 22px rgba(23, 63, 154, 0.24), 0 0 0 0 rgba(52, 95, 214, 0);
        }
    }
    
    /* Responsive Timeline */
    @media (max-width: 768px) {
        .timeline-dashboard {
            padding: 22px 16px;
            border-radius: 14px;
        }

        .timeline-dashboard .dashboard-header h3 {
            font-size: 26px;
        }

        .timeline-dashboard .dashboard-header h3 i {
            font-size: 0.82em;
        }

        .timeline-dashboard .dashboard-header p {
            font-size: 15px;
        }

        .timeline-dashboard .dashboard-actions {
            gap: 10px;
        }

        .timeline-dashboard .dashboard-actions button {
            width: 100%;
            max-width: 320px;
            padding: 12px 18px;
            font-size: 14px;
        }

        .timeline-dashboard .dashboard-actions button i,
        .timeline-dashboard .btn-submit i {
            font-size: 0.82em;
        }

        .timeline-dashboard .btn-submit {
            width: 100%;
            max-width: 320px;
            font-size: 16px;
            padding: 13px 20px;
        }

        .timeline-section {
            padding: 20px 14px;
            overflow-x: visible;
        }

        .timeline-section h3 {
            font-size: 22px;
            margin-bottom: 16px;
        }

        .timeline-container.horizontal {
            flex-direction: column;
            align-items: center;
            min-width: auto;
            gap: 14px;
            padding: 0;
        }

        .timeline-container.horizontal::before {
            content: '';
            left: 50%;
            right: auto;
            top: 44px;
            bottom: 44px;
            width: 10px;
            height: auto;
            transform: translateX(-50%);
            background: linear-gradient(180deg, #b95986 0%, #6170b5 28%, #3f5f9f 48%, #4e87cf 62%, #cc665f 82%, #cf9a58 100%);
        }
        
        .timeline-item {
            width: 100%;
            max-width: 340px;
            min-width: 0;
            height: auto;
            display: flex;
            justify-content: center;
            padding: 0;
        }

        .timeline-dot {
            width: 68px;
            height: 68px;
            border-width: 6px;
            position: relative;
            left: auto;
            top: auto;
            transform: none;
            margin: 62px 0 10px;
        }

        .timeline-dot::before {
            width: 44px;
            height: 44px;
        }

        .timeline-dot i {
            font-size: 19px;
        }

        .timeline-connector {
            display: none;
        }

        .timeline-content {
            position: static;
            transform: none;
            width: calc(100% - 38px);
            min-height: auto;
            margin-bottom: 10px;
        }

        .timeline-item:nth-child(odd) .timeline-content,
        .timeline-item:nth-child(even) .timeline-content {
            top: auto;
            bottom: auto;
        }

        .timeline-title {
            font-size: 14px;
        }

        .timeline-date {
            font-size: 10px;
        }

        .timeline-description {
            max-height: none;
            -webkit-line-clamp: unset;
        }
    }
`;
document.head.appendChild(style);

// Send Invitation Modal Functions
async function openSendInvitationModal() {
    console.log('Opening Send Invitation modal');
    
    // Get authors data
    const authorsData = await fetchAuthorsFromApi();
    
    // Generate author rows for the invitation table
    let authorRows = '';
    let totalAuthors = 0;
    let invitedCount = 0;
    
    if (authorsData.length > 0) {
        authorRows = authorsData.map(author => {
            totalAuthors++;
            // Safely read invitation-send stage; fall back to checking invitation_status field
            const stageStatus = author.progress && author.progress.stages && author.progress.stages['invitation-send']
                ? author.progress.stages['invitation-send'].status
                : 'pending';
            const alsoInvited = author.invitationStatus === 'accepted' || author.invitationStatus === 'declined';
            const isInvited = stageStatus === 'completed' || alsoInvited;

            if (isInvited) invitedCount++;

            let statusBadge = '';
            if (isInvited) {
                statusBadge = '<span class="status-badge sent"><i class="fas fa-check-circle"></i> Sent</span>';
            } else if (stageStatus === 'in-progress') {
                statusBadge = '<span class="status-badge pending"><i class="fas fa-clock"></i> Pending</span>';
            } else {
                statusBadge = '<span class="status-badge not-sent"><i class="fas fa-circle"></i> Not Sent</span>';
            }
            
            return `
                <tr class="invitation-row" data-author-id="${author.id}">
                    <td>
                        <input type="checkbox" class="invitation-checkbox" value="${author.id}">
                    </td>
                    <td>${author.firstName} ${author.lastName}</td>
                    <td>${author.email}</td>
                    <td>${author.paperTitle}</td>
                    <td>${author.paperId || 'N/A'}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }
    
    const pendingCount = totalAuthors - invitedCount;
    
    const modalHTML = `
        <div class="modal-overlay send-invitation-modal" id="sendInvitationModal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-envelope"></i> Send Invitations</h3>
                    <button class="modal-close" onclick="closeSendInvitationModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Invitation Summary -->
                    <div class="invitation-summary">
                        <div class="summary-card total">
                            <div class="summary-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="summary-info">
                                <div class="summary-number">${totalAuthors}</div>
                                <div class="summary-label">Total Authors</div>
                            </div>
                        </div>
                        <div class="summary-card sent">
                            <div class="summary-icon">
                                <i class="fas fa-paper-plane"></i>
                            </div>
                            <div class="summary-info">
                                <div class="summary-number">${invitedCount}</div>
                                <div class="summary-label">Invitations Sent</div>
                            </div>
                        </div>
                        <div class="summary-card pending">
                            <div class="summary-icon">
                                <i class="fas fa-hourglass-half"></i>
                            </div>
                            <div class="summary-info">
                                <div class="summary-number">${pendingCount}</div>
                                <div class="summary-label">Pending Invitations</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Search and Controls -->
                    <div class="invitation-controls">
                        <div class="search-section">
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" 
                                       id="invitationSearchInput" 
                                       placeholder="Search by name, email, or paper title..." 
                                       onkeyup="filterInvitationTable()">
                            </div>
                        </div>
                        <div class="invitation-actions">
                            <button class="btn-success" id="sendInvitationBtn" onclick="sendSelectedInvitations()" disabled>
                                <i class="fas fa-paper-plane"></i> Send/Resend Selected Invitations
                            </button>
                            <button class="btn-warning" id="sendRejectionBtn" onclick="sendSelectedRejections()" disabled>
                                <i class="fas fa-circle-xmark"></i> Send Rejection to Selected
                            </button>
                            <button class="btn-secondary" onclick="selectAllInvitations()">
                                <i class="fas fa-check-square"></i> Select All Authors
                            </button>
                            <button class="btn-secondary" onclick="clearAllInvitations()">
                                <i class="fas fa-square"></i> Clear Selection
                            </button>
                        </div>
                    </div>
                    
                    <!-- Authors Table -->
                    ${totalAuthors > 0 ? `
                    <div class="invitation-table-container">
                        <table class="invitation-table">
                            <thead>
                                <tr>
                                    <th width="50">
                                        <input type="checkbox" id="selectAllInvitationCheckbox" onchange="toggleSelectAllInvitations()">
                                    </th>
                                    <th>Author Name</th>
                                    <th>Email</th>
                                    <th>Paper Title</th>
                                    <th>Paper ID</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="invitationTableBody">
                                ${authorRows}
                            </tbody>
                        </table>
                    </div>
                    ` : `
                    <div class="no-data">
                        <i class="fas fa-users" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
                        <h4>No Authors Found</h4>
                        <p>No authors are available to send invitations to.</p>
                    </div>
                    `}
                    
                    <!-- Selected Count Display -->
                    <div class="selection-info" id="selectionInfo" style="display: none;">
                        <i class="fas fa-info-circle"></i>
                        <span id="selectionCount">0</span> author(s) selected for invitation
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeSendInvitationModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        document.getElementById('sendInvitationModal').classList.add('active');
        updateInvitationSelection(); // Initialize selection state
    }, 10);
}

function closeSendInvitationModal() {
    const modal = document.getElementById('sendInvitationModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function filterInvitationTable() {
    const searchInput = document.getElementById('invitationSearchInput').value.toLowerCase();
    const tableRows = document.querySelectorAll('.invitation-row');
    let visibleCount = 0;
    
    tableRows.forEach(row => {
        const authorId = row.dataset.authorId;
        let author = null;
        
        if (typeof window.authors !== 'undefined' && window.authors) {
            author = window.authors.find(a => a.id == authorId);
        } else if (typeof authors !== 'undefined' && authors) {
            author = authors.find(a => a.id == authorId);
        }
        
        if (author) {
            const searchText = `${author.firstName} ${author.lastName} ${author.email} ${author.paperTitle}`.toLowerCase();
            if (searchText.includes(searchInput)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        }
    });
    
    // Update select all checkbox state when filtering
    updateSelectAllState();
}

function toggleSelectAllInvitations() {
    const selectAllCheckbox = document.getElementById('selectAllInvitationCheckbox');
    const visibleCheckboxes = Array.from(document.querySelectorAll('.invitation-checkbox')).filter(checkbox => {
        const row = checkbox.closest('.invitation-row');
        return row.style.display !== 'none';
    });
    
    visibleCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateInvitationSelection();
}

function selectAllInvitations() {
    const availableCheckboxes = document.querySelectorAll('.invitation-checkbox');
    availableCheckboxes.forEach(checkbox => {
        const row = checkbox.closest('.invitation-row');
        if (row.style.display !== 'none') {
            checkbox.checked = true;
        }
    });
    updateInvitationSelection();
    updateSelectAllState();
}

function clearAllInvitations() {
    const checkboxes = document.querySelectorAll('.invitation-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateInvitationSelection();
    updateSelectAllState();
}

function updateInvitationSelection() {
    const selectedCheckboxes = document.querySelectorAll('.invitation-checkbox:checked');
    const selectedCount = selectedCheckboxes.length;
    const sendButton = document.getElementById('sendInvitationBtn');
    const rejectionButton = document.getElementById('sendRejectionBtn');
    const selectionInfo = document.getElementById('selectionInfo');
    const selectionCountSpan = document.getElementById('selectionCount');
    
    // Update send button state
    if (selectedCount > 0) {
        sendButton.disabled = false;
        sendButton.innerHTML = `<i class="fas fa-paper-plane"></i> Send/Resend ${selectedCount} Invitation${selectedCount > 1 ? 's' : ''}`;
        if (rejectionButton) {
            rejectionButton.disabled = false;
            rejectionButton.innerHTML = `<i class="fas fa-circle-xmark"></i> Send ${selectedCount} Rejection${selectedCount > 1 ? 's' : ''}`;
        }
        selectionInfo.style.display = 'flex';
        selectionCountSpan.textContent = selectedCount;
    } else {
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Send/Resend Selected Invitations';
        if (rejectionButton) {
            rejectionButton.disabled = true;
            rejectionButton.innerHTML = '<i class="fas fa-circle-xmark"></i> Send Rejection to Selected';
        }
        selectionInfo.style.display = 'none';
    }
    
    updateSelectAllState();
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAllInvitationCheckbox');
    const visibleCheckboxes = Array.from(document.querySelectorAll('.invitation-checkbox')).filter(checkbox => {
        const row = checkbox.closest('.invitation-row');
        return row.style.display !== 'none';
    });
    
    const checkedVisible = visibleCheckboxes.filter(cb => cb.checked);
    
    if (visibleCheckboxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedVisible.length === visibleCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else if (checkedVisible.length > 0) {
        selectAllCheckbox.indeterminate = true;
        selectAllCheckbox.checked = false;
    } else {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    }
}

function sendSelectedInvitations() {
    const selectedCheckboxes = document.querySelectorAll('.invitation-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('Please select authors to send invitations to.');
        return;
    }
    
    const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
    
    // If only one author selected, show email composition modal
    if (selectedIds.length === 1) {
        openEmailCompositionModal(selectedIds[0]);
    } else {
        // For multiple authors, show batch confirmation
        const confirmMessage = `Are you sure you want to send invitations to ${selectedIds.length} selected author(s)?`;
        
        if (confirm(confirmMessage)) {
            // Show email composition for batch sending
            openBatchEmailModal(selectedIds);
        }
    }
}

async function markAuthorInvitationStatus(authorId, action) {
    try {
        await fetch('/authors/invitation-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorId, action })
        });
    } catch (error) {
        console.warn('Could not update invitation status:', error);
    }
}

async function sendSelectedRejections() {
    const selectedCheckboxes = document.querySelectorAll('.invitation-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert('Please select authors to send rejection emails to.');
        return;
    }

    const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value, 10));
    if (selectedIds.length === 1) {
        openEmailCompositionModal(selectedIds[0], 'rejection');
    } else {
        openBatchEmailModal(selectedIds, 'rejection');
    }
}

// Add event listeners for invitation checkboxes when modal loads
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('invitation-checkbox')) {
        updateInvitationSelection();
    }
});

// Email Composition Modal Functions
async function getConfiguredSenderEmail() {
    if (window.configuredSenderEmail) {
        return window.configuredSenderEmail;
    }

    try {
        const response = await fetch('/health');
        const health = await response.json();
        window.configuredSenderEmail = health.smtpFrom || 'Configured in server (.env)';
    } catch (error) {
        console.error('Could not load sender email from server config:', error);
        window.configuredSenderEmail = 'Configured in server (.env)';
    }

    return window.configuredSenderEmail;
}

const EMAIL_SEND_TEMPLATE_FALLBACKS = {
    invitation: {
        subject: 'IEEE PCIC - Conference Invitation',
        bodyHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">IEEE PCIC Conference Invitation</h2>
                <p>Hi {AUTHOR_FIRST_NAME},</p>
                <p>We are pleased to invite you to participate in IEEE PCIC.</p>
                <p><strong>Paper Title:</strong> {PAPER_TITLE}</p>
                <p><strong>Paper ID:</strong> {PAPER_ID}</p>
                <p><strong>Login Email:</strong> {EMAIL}</p>
                <p><strong>Password:</strong> {PASSWORD}</p>
                {ALL_PAPERS_TABLE}
                <p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p>
            </div>
        `
    },
    'first-reminder': {
        subject: 'First Draft Submission Reminder - IEEE PCIC Conference',
        bodyHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">First Draft Submission Reminder</h2>
                <p><strong>Dear {AUTHOR_FIRST_NAME},</strong></p>
                <p>We hope this message finds you well. This is a friendly reminder regarding your paper submission for the IEEE PCIC Conference.</p>
                <p><strong>Paper ID:</strong> {PAPER_ID}</p>
                <p><strong>Paper Title:</strong> {PAPER_TITLE}</p>
                <p><strong>What's Next:</strong> Please prepare and upload your first draft by the specified deadline.</p>
                <p><strong>Submission Guidelines:</strong></p>
                <ul>
                    <li>Submit your paper in PDF format</li>
                    <li>Follow IEEE conference formatting guidelines</li>
                    <li>Ensure all references are properly cited</li>
                    <li>Include author information and affiliations</li>
                </ul>
                <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                <p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p>
            </div>
        `
    },
    'final-submission': {
        subject: 'Final Paper Submission - IEEE PCIC Conference',
        bodyHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f2937;">Final Paper Submission Notice</h2>
                <p><strong>Dear {AUTHOR_FIRST_NAME},</strong></p>
                <p>This is a reminder to submit your final paper for the IEEE PCIC Conference.</p>
                <p><strong>Paper ID:</strong> {PAPER_ID}</p>
                <p><strong>Paper Title:</strong> {PAPER_TITLE}</p>
                <p>Please complete your final paper submission at the earliest.</p>
                <p>If you need any assistance, please contact the conference team.</p>
                <p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p>
            </div>
        `
    },

    rejection: {
        subject: 'IEEE PCIC - Paper Decision Notification',
        bodyHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f3f9f;">IEEE PCIC Conference Notification</h2>
                <p>Dear {AUTHOR_FIRST_NAME},</p>
                <p>Thank you for submitting your work titled <strong>{PAPER_TITLE}</strong> (Paper ID: <strong>{PAPER_ID}</strong>).</p>
                <p>After review, we regret to inform you that this submission has not been selected for this cycle.</p>
                <p>We appreciate your effort and encourage you to submit future work to upcoming IEEE PCIC conferences.</p>
                <p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p>
            </div>
        `
    }
};

function getLocalTemplateKey(templateType) {
    return `email_template_override_${templateType}`;
}

function readLocalTemplateOverride(templateType) {
    try {
        const raw = localStorage.getItem(getLocalTemplateKey(templateType));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            subject: String(parsed.subject || '').trim(),
            bodyHtml: String(parsed.bodyHtml || '').trim()
        };
    } catch (_error) {
        return null;
    }
}

function writeLocalTemplateOverride(templateType, subject, bodyHtml) {
    localStorage.setItem(
        getLocalTemplateKey(templateType),
        JSON.stringify({
            subject: String(subject || ''),
            bodyHtml: String(bodyHtml || ''),
            updatedAt: new Date().toISOString()
        })
    );
}

async function fetchEmailSendTemplate(templateType) {
    const fallback = EMAIL_SEND_TEMPLATE_FALLBACKS[templateType] || EMAIL_SEND_TEMPLATE_FALLBACKS.invitation;
    const localOverride = readLocalTemplateOverride(templateType);

    if (localOverride && localOverride.subject && localOverride.bodyHtml) {
        return {
            subject: localOverride.subject,
            bodyHtml: localOverride.bodyHtml
        };
    }

    try {
        const response = await fetch(`/admin/email-templates/${templateType}`);
        const result = await response.json();
        if (result.success && result.template) {
            const serverTemplate = {
                subject: result.template.subject || fallback.subject,
                bodyHtml: result.template.bodyHtml || fallback.bodyHtml
            };

            writeLocalTemplateOverride(templateType, serverTemplate.subject, serverTemplate.bodyHtml);
            return serverTemplate;
        }
    } catch (error) {
        console.error(`Could not load ${templateType} template from server:`, error);
    }

    return fallback;
}

function buildAllPapersTableHtml(email, allAuthors) {
    if (!email || !allAuthors || !Array.isArray(allAuthors)) return '';
    const papers = allAuthors.filter(a => (a.email || '').toLowerCase() === email.toLowerCase());
    if (papers.length <= 1) return '';
    const rows = papers.map((p, i) => `
        <tr style="background:${i % 2 === 0 ? '#f8faff' : '#ffffff'}">
            <td style="padding:10px 14px;border:1px solid #d1d9f0;">${p.paperId || 'N/A'}</td>
            <td style="padding:10px 14px;border:1px solid #d1d9f0;">${p.paperTitle || 'N/A'}</td>
            <td style="padding:10px 14px;border:1px solid #d1d9f0;font-family:monospace;">${p.userId || 'N/A'}</td>
            <td style="padding:10px 14px;border:1px solid #d1d9f0;font-family:monospace;">${p.password || 'N/A'}</td>
        </tr>`).join('');
    return `
        <table style="width:100%;border-collapse:collapse;margin-top:12px;margin-bottom:12px;font-size:14px;">
            <thead>
                <tr style="background:#1a3a8f;color:#ffffff;">
                    <th style="padding:10px 14px;border:1px solid #1a3a8f;text-align:left;">Paper ID</th>
                    <th style="padding:10px 14px;border:1px solid #1a3a8f;text-align:left;">Paper Title</th>
                    <th style="padding:10px 14px;border:1px solid #1a3a8f;text-align:left;">User ID</th>
                    <th style="padding:10px 14px;border:1px solid #1a3a8f;text-align:left;">Password</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function buildEmailTemplateVariables(author, allAuthors) {
    const allPapersTable = buildAllPapersTableHtml(author.email, allAuthors || window._allAuthorsCache || []);
    return {
        AUTHOR_FIRST_NAME: author.firstName || '',
        AUTHOR_LAST_NAME: author.lastName || '',
        AUTHOR_FULL_NAME: `${author.firstName || ''} ${author.lastName || ''}`.trim(),
        PAPER_TITLE: author.paperTitle || 'N/A',
        PAPER_ID: author.paperId || `IEEE-${String(author.id || '').padStart(4, '0')}`,
        EMAIL: author.email || '',
        USERNAME: author.email || '',
        PASSWORD: author.password || '',
        ALL_PAPERS_TABLE: allPapersTable
    };
}

function applyEmailTemplate(templateText, variables) {
    const input = String(templateText || '');
    return input.replace(/\{([A-Z_]+)\}/g, (_full, key) => {
        if (Object.prototype.hasOwnProperty.call(variables, key)) {
            return String(variables[key] || '');
        }
        return `{${key}}`;
    });
}

function escapeAttributeValue(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const richEmailEditorSelections = {};

function buildRichEmailToolbar(editorId, toolbarId) {
    return `
        <div class="rich-email-toolbar" id="${toolbarId}" data-editor-target="${editorId}">
            <select class="rich-email-select" onchange="applyRichEditorFontFamily('${editorId}', this.value)">
                <option value="">Font</option>
                <option value="Arial">Arial</option>
                <option value="Verdana">Verdana</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Tahoma">Tahoma</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
                <option value="Courier New">Courier New</option>
            </select>

            <select class="rich-email-select" onchange="applyRichEditorFontSize('${editorId}', this.value)">
                <option value="">Size</option>
                <option value="12px">12</option>
                <option value="14px">14</option>
                <option value="16px">16</option>
                <option value="18px">18</option>
                <option value="20px">20</option>
                <option value="24px">24</option>
                <option value="28px">28</option>
            </select>

            <label class="rich-email-color" title="Text Color">
                <i class="fas fa-font"></i>
                <input type="color" value="#1f2937" onchange="applyRichEditorColor('${editorId}', this.value)">
            </label>

            <label class="rich-email-color" title="Highlight Color">
                <i class="fas fa-highlighter"></i>
                <input type="color" value="#fff59d" onchange="applyRichEditorHighlight('${editorId}', this.value)">
            </label>

            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'bold')" title="Bold"><i class="fas fa-bold"></i></button>
            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'italic')" title="Italic"><i class="fas fa-italic"></i></button>
            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'underline')" title="Underline"><i class="fas fa-underline"></i></button>
            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'strikeThrough')" title="Strikethrough"><i class="fas fa-strikethrough"></i></button>

            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'justifyLeft')" title="Align Left"><i class="fas fa-align-left"></i></button>
            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'justifyCenter')" title="Align Center"><i class="fas fa-align-center"></i></button>
            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'justifyRight')" title="Align Right"><i class="fas fa-align-right"></i></button>

            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'insertUnorderedList')" title="Bulleted List"><i class="fas fa-list-ul"></i></button>
            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'insertOrderedList')" title="Numbered List"><i class="fas fa-list-ol"></i></button>

            <button type="button" class="rich-email-btn" onclick="applyRichEditorCommand('${editorId}', 'removeFormat')" title="Clear Formatting"><i class="fas fa-eraser"></i></button>
        </div>
    `;
}

function initializeRichEmailEditor(editorId, toolbarId) {
    const editor = document.getElementById(editorId);
    const toolbar = document.getElementById(toolbarId);
    if (!editor || !toolbar) return;

    editor.addEventListener('keyup', () => saveRichEditorSelection(editorId));
    editor.addEventListener('mouseup', () => saveRichEditorSelection(editorId));
    editor.addEventListener('blur', () => saveRichEditorSelection(editorId));

    toolbar.querySelectorAll('button.rich-email-btn').forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
    });

    saveRichEditorSelection(editorId);
}

function saveRichEditorSelection(editorId) {
    const editor = document.getElementById(editorId);
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    richEmailEditorSelections[editorId] = range.cloneRange();
}

function ensureRichEditorFocus(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor) return null;

    editor.focus();
    const selection = window.getSelection();
    if (!selection) return editor;

    const savedRange = richEmailEditorSelections[editorId];
    if (savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        return editor;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return editor;
}

function applyRichEditorCommand(editorId, command, value = null) {
    const editor = ensureRichEditorFocus(editorId);
    if (!editor) return;

    try {
        document.execCommand('styleWithCSS', false, true);
    } catch (_error) {
        // Ignore unsupported command.
    }

    document.execCommand(command, false, value);
    saveRichEditorSelection(editorId);
}

function applyRichEditorInlineStyle(editorId, styleProperty, styleValue) {
    const editor = ensureRichEditorFocus(editorId);
    if (!editor || !styleValue) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const span = document.createElement('span');
    span.style[styleProperty] = styleValue;

    if (range.collapsed) {
        span.appendChild(document.createTextNode('\u200b'));
        range.insertNode(span);
        const nextRange = document.createRange();
        nextRange.setStart(span.firstChild, 1);
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
    } else {
        const selected = range.extractContents();
        span.appendChild(selected);
        range.insertNode(span);
        const nextRange = document.createRange();
        nextRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(nextRange);
    }

    saveRichEditorSelection(editorId);
}

function applyRichEditorFontFamily(editorId, fontFamily) {
    if (!fontFamily) return;
    applyRichEditorCommand(editorId, 'fontName', fontFamily);
}

function applyRichEditorFontSize(editorId, fontSize) {
    if (!fontSize) return;
    applyRichEditorInlineStyle(editorId, 'fontSize', fontSize);
}

function applyRichEditorColor(editorId, color) {
    if (!color) return;
    applyRichEditorCommand(editorId, 'foreColor', color);
}

function applyRichEditorHighlight(editorId, color) {
    if (!color) return;
    applyRichEditorCommand(editorId, 'hiliteColor', color);
}

async function openEmailCompositionModal(authorId, templateType = 'invitation') {
    // Always fetch fresh authors from DB to avoid stale cache
    let author = null;
    let allAuthors = [];
    try {
        const res = await fetch('/authors');
        const data = await res.json();
        if (data.success && data.authors) {
            allAuthors = data.authors;
            window._allAuthorsCache = allAuthors;
            author = allAuthors.find(a => a.id === authorId);
        }
    } catch (err) {
        console.error('Could not fetch authors for email modal:', err);
    }
    
    if (!author) {
        const normalizedTargetId = Number(authorId);
        author = allAuthors.find((candidate) => Number(candidate.id) === normalizedTargetId);
    }

    if (!author) {
        alert('Author not found.');
        return;
    }
    
    // Email configuration
    const senderEmail = await getConfiguredSenderEmail();
    const selectedTemplateType = templateType === 'rejection' ? 'rejection' : 'invitation';
    const selectedTemplate = await fetchEmailSendTemplate(selectedTemplateType);
    const variables = buildEmailTemplateVariables(author, allAuthors);
    const subject = applyEmailTemplate(selectedTemplate.subject, variables);
    const emailBody = applyEmailTemplate(selectedTemplate.bodyHtml, variables);

    const modalTitle = selectedTemplateType === 'rejection' ? 'Compose Rejection Email' : 'Compose Invitation Email';
    const previewTitle = selectedTemplateType === 'rejection' ? 'Rejection Email Preview' : 'Email Preview';
    const sendButtonLabel = selectedTemplateType === 'rejection' ? 'Send Rejection Email' : 'Send Email';
    const showCredentials = selectedTemplateType !== 'rejection';
    
    const modalHTML = `
        <div class="modal-overlay email-composition-modal" id="emailCompositionModal">
            <div class="modal-container extra-large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-envelope"></i> ${modalTitle}</h3>
                    <button class="modal-close" onclick="closeEmailCompositionModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Email Preview Section -->
                    <div class="email-preview-section">
                        <div class="email-header">
                            <h4><i class="fas fa-paper-plane"></i> ${previewTitle}</h4>
                            <div class="recipient-info">
                                <span><strong>To:</strong> ${author.firstName} ${author.lastName} (${author.email})</span>
                            </div>
                        </div>
                        
                        <!-- Gmail Interface Mockup -->
                        <div class="gmail-interface">
                            <div class="gmail-header">
                                <div class="gmail-from">
                                    <label>From:</label>
                                    <div class="email-account">
                                        <i class="fab fa-google"></i>
                                        <span>${senderEmail}</span>
                                    </div>
                                </div>
                                <div class="gmail-to">
                                    <label>To:</label>
                                    <input type="email" id="recipientEmail" value="${author.email}" readonly>
                                </div>
                                <div class="gmail-cc">
                                    <label>CC:</label>
                                    <input type="text" id="emailCc" placeholder="Optional: add CC emails separated by commas">
                                </div>
                                <div class="gmail-bcc">
                                    <label>BCC:</label>
                                    <input type="text" id="emailBcc" placeholder="Optional: add BCC emails separated by commas">
                                </div>
                                <div class="gmail-subject">
                                    <label>Subject:</label>
                                    <input type="text" id="emailSubject" value="${escapeAttributeValue(subject)}">
                                </div>
                            </div>
                            
                            <div class="gmail-body">
                                <div class="email-body-container">
                                    ${buildRichEmailToolbar('emailContent', 'composeEmailToolbar')}
                                    <div class="email-content" id="emailContent" contenteditable="true">
                                        ${emailBody}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Author Details Section -->
                    <div class="author-details-section">
                        <h4><i class="fas fa-user"></i> Author Details</h4>
                        <div class="author-info-grid">
                            <div class="info-item">
                                <label>Name:</label>
                                <span>${author.firstName} ${author.lastName}</span>
                            </div>
                            <div class="info-item">
                                <label>Email:</label>
                                <span>${author.email}</span>
                            </div>
                            <div class="info-item">
                                <label>Paper Title:</label>
                                <span>${author.paperTitle}</span>
                            </div>
                            <div class="info-item">
                                <label>Paper ID:</label>
                                <span>IEEE-${author.id.toString().padStart(4, '0')}</span>
                            </div>
                            ${showCredentials ? `
                            <div class="info-item">
                                <label>Login Credentials:</label>
                                <div class="credentials-display">
                                    <div><strong>Login Email:</strong> <code>${author.email}</code></div>
                                    <div><strong>Password:</strong> <code>${author.password}</code></div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeEmailCompositionModal()">Cancel</button>
                    <button type="button" class="btn-primary" onclick="copyEmailToClipboard()">
                        <i class="fas fa-copy"></i> Copy Email Content
                    </button>
                    <button type="button" class="btn-success" onclick="confirmSendEmail(${authorId}, '${selectedTemplateType}')">
                        <i class="fas fa-paper-plane"></i> ${sendButtonLabel}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    initializeRichEmailEditor('emailContent', 'composeEmailToolbar');
    
    setTimeout(() => {
        document.getElementById('emailCompositionModal').classList.add('active');
    }, 10);
}

function generateEmailBody(author) {
    return `
        <div class="email-body">
            <p><strong>Hi ${author.firstName},</strong></p>
            
            <p>We hope this email finds you well. We are pleased to invite you to participate in the <strong>IEEE PCIC (Petroleum and Chemical Industry Committee)</strong> conference.</p>
            
            <p>Your paper titled "<strong>${author.paperTitle}</strong>" has been selected for review and we would like to invite you to submit your full manuscript for consideration.</p>
            
            <div class="credentials-section">
                <h4>Your Login Credentials:</h4>
                <div class="credential-box">
                    <p><strong>Paper ID:</strong> IEEE-${author.id.toString().padStart(4, '0')}</p>
                    <p><strong>Username:</strong> ${author.userId}</p>
                    <p><strong>Password:</strong> ${author.password}</p>
                </div>
            </div>
            
            <p>Please use these credentials to access our submission portal and upload your final manuscript. The submission deadline is <strong>[INSERT DEADLINE DATE]</strong>.</p>
            
            <div class="important-info">
                <h4>Important Information:</h4>
                <ul>
                    <li>Ensure your paper follows IEEE formatting guidelines</li>
                    <li>Maximum paper length: 8 pages</li>
                    <li>Include author biographies and photographs</li>
                    <li>Submit both PDF and Word document versions</li>
                </ul>
            </div>
            
            <p>If you have any questions or need technical assistance, please don't hesitate to contact our support team.</p>
            
            <p>We look forward to your participation in IEEE PCIC.</p>
            
            <div class="email-signature">
                <p><strong>Best regards,</strong></p>
                <p><strong>IEEE PCIC Conference Committee</strong></p>
                <p>Email: support@ieeepcic.org</p>
                <p>Website: www.ieeepcic.org</p>
            </div>
        </div>
    `;
}

async function openBatchEmailModal(selectedIds, templateType = 'invitation') {
    const senderEmail = await getConfiguredSenderEmail();
    const selectedTemplateType = ['invitation', 'rejection', 'first-reminder', 'final-submission'].includes(templateType)
        ? templateType
        : 'invitation';
    const selectedTemplate = await fetchEmailSendTemplate(selectedTemplateType);
    const batchTitleMap = {
        invitation: 'Batch Email Sending',
        rejection: 'Batch Rejection Email Sending',
        'first-reminder': 'First Draft Reminder Email Editor',
        'final-submission': 'Final Paper Submission Email Editor'
    };
    const batchDescriptionMap = {
        invitation: `You are about to send invitation emails to <strong>${selectedIds.length}</strong> authors.`,
        rejection: `You are about to send rejection emails to <strong>${selectedIds.length}</strong> authors.`,
        'first-reminder': `You are about to send first draft reminder emails to <strong>${selectedIds.length}</strong> selected author(s).`,
        'final-submission': `You are about to send final paper submission emails to <strong>${selectedIds.length}</strong> selected author(s).`
    };
    const batchNoteMap = {
        invitation: 'Each email will be personalized with the author\'s name, paper title, and login credentials.',
        rejection: 'Each email will be personalized with the author\'s name and paper details.',
        'first-reminder': 'You can edit the HTML template below while keeping the visual formatting intact. Placeholders will be personalized per selected paper.',
        'final-submission': 'You can edit the HTML template below while keeping the visual formatting intact. Placeholders will be personalized per selected paper.'
    };
    const confirmLabelMap = {
        invitation: 'I confirm that I want to send personalized invitation emails to all selected authors',
        rejection: 'I confirm that I want to send personalized rejection emails to all selected authors',
        'first-reminder': 'I confirm that I want to send personalized first draft reminder emails to the selected authors',
        'final-submission': 'I confirm that I want to send personalized final paper submission emails to the selected authors'
    };
    const sendButtonLabelMap = {
        invitation: `Send ${selectedIds.length} Emails`,
        rejection: `Send ${selectedIds.length} Rejection Emails`,
        'first-reminder': `Send ${selectedIds.length} First Draft Reminder${selectedIds.length > 1 ? 's' : ''}`,
        'final-submission': `Send ${selectedIds.length} Final Submission Email${selectedIds.length > 1 ? 's' : ''}`
    };
    const batchTitle = batchTitleMap[selectedTemplateType] || batchTitleMap.invitation;
    const batchDescription = batchDescriptionMap[selectedTemplateType] || batchDescriptionMap.invitation;
    const batchNote = batchNoteMap[selectedTemplateType] || batchNoteMap.invitation;
    const confirmLabel = confirmLabelMap[selectedTemplateType] || confirmLabelMap.invitation;
    const sendButtonLabel = sendButtonLabelMap[selectedTemplateType] || sendButtonLabelMap.invitation;

    const modalHTML = `
        <div class="modal-overlay batch-email-modal" id="batchEmailModal">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-envelopes-bulk"></i> ${batchTitle}</h3>
                    <button class="modal-close" onclick="closeBatchEmailModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="batch-info">
                        <p><i class="fas fa-info-circle"></i> ${batchDescription}</p>
                        <p>${batchNote}</p>
                    </div>
                    
                    <div class="email-settings">
                        <h4>Email Configuration</h4>
                        <div class="setting-item">
                            <label>From:</label>
                            <span>${senderEmail}</span>
                        </div>
                        <div class="setting-item">
                            <label>Subject:</label>
                            <input type="text" id="batchEmailSubject" value="${escapeAttributeValue(selectedTemplate.subject)}">
                        </div>
                        <div class="setting-item">
                            <label>CC:</label>
                            <input type="text" id="batchEmailCc" placeholder="Optional: add CC emails separated by commas">
                        </div>
                        <div class="setting-item">
                            <label>BCC:</label>
                            <input type="text" id="batchEmailBcc" placeholder="Optional: add BCC emails separated by commas">
                        </div>
                        <div class="setting-item" style="display:block; margin-top: 12px;">
                            <label style="display:block; margin-bottom: 8px;">Body (HTML):</label>
                            <div class="email-body-container" style="border:1px solid #d1d5db; border-radius:6px; min-height:220px; max-height:380px; overflow:auto; background:#fff;">
                                ${buildRichEmailToolbar('batchEmailContent', 'batchEmailToolbar')}
                                <div id="batchEmailContent" class="email-content" contenteditable="true" style="min-height:200px;">${selectedTemplate.bodyHtml}</div>
                            </div>
                            <small style="display:block; margin-top:6px; color:#64748b;">Use placeholders: {AUTHOR_FIRST_NAME}, {AUTHOR_LAST_NAME}, {AUTHOR_FULL_NAME}, {PAPER_TITLE}, {PAPER_ID}, {EMAIL}, {PASSWORD}</small>
                        </div>
                    </div>
                    
                    <div class="confirmation-section">
                        <label class="checkbox-container">
                            <input type="checkbox" id="confirmBatchSend">
                            <span class="checkmark"></span>
                            ${confirmLabel}
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeBatchEmailModal()">Cancel</button>
                    <button type="button" class="btn-secondary" onclick="saveCurrentBatchTemplate()">
                        <i class="fas fa-save"></i> Save Template
                    </button>
                    <button type="button" class="btn-success" id="batchSendBtn" onclick="confirmBatchSend()" disabled>
                        <i class="fas fa-paper-plane"></i> ${sendButtonLabel}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store selected IDs for later use
    window.batchSelectedIds = selectedIds;
    window.batchEmailType = selectedTemplateType;

    initializeRichEmailEditor('batchEmailContent', 'batchEmailToolbar');
    
    // Enable/disable send button based on confirmation checkbox
    document.getElementById('confirmBatchSend').addEventListener('change', function() {
        document.getElementById('batchSendBtn').disabled = !this.checked;
    });
    
    setTimeout(() => {
        document.getElementById('batchEmailModal').classList.add('active');
    }, 10);
}

function closeEmailCompositionModal() {
    const modal = document.getElementById('emailCompositionModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function closeBatchEmailModal() {
    const modal = document.getElementById('batchEmailModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            delete window.batchSelectedIds;
            delete window.batchEmailType;
        }, 300);
    }
}

function copyEmailToClipboard() {
    const emailContent = document.getElementById('emailContent');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = emailContent.innerHTML;
    
    // Convert HTML to plain text
    const plainText = tempDiv.textContent || tempDiv.innerText;
    
    navigator.clipboard.writeText(plainText).then(() => {
        alert('Email content copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy email content:', err);
        alert('Failed to copy email content. Please try again.');
    });
}

function convertHtmlToPlainText(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = String(html || '');
    return (tempDiv.textContent || tempDiv.innerText || '').trim();
}

function parseEmailRecipients(value, headerLabel = 'CC') {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }

    const recipientList = raw
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter(Boolean);

    if (recipientList.length === 0) {
        return '';
    }

    const invalidRecipient = recipientList.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidRecipient) {
        throw new Error(`Invalid ${headerLabel} email address: ${invalidRecipient}`);
    }

    return recipientList.join(', ');
}

function parseCcRecipients(ccValue) {
    return parseEmailRecipients(ccValue, 'CC');
}

function parseBccRecipients(bccValue) {
    return parseEmailRecipients(bccValue, 'BCC');
}

async function saveEmailTemplate(templateType, subject, bodyHtml) {
    const allowedTemplate = ['invitation', 'rejection', 'first-reminder', 'final-submission'].includes(templateType) ? templateType : null;
    if (!allowedTemplate) {
        alert('Template type is not supported for saving.');
        return false;
    }

    const trimmedSubject = String(subject || '').trim();
    const trimmedBodyHtml = String(bodyHtml || '').trim();
    if (!trimmedSubject || !trimmedBodyHtml) {
        alert('Subject and body are required before saving template.');
        return false;
    }

    writeLocalTemplateOverride(allowedTemplate, trimmedSubject, trimmedBodyHtml);

    try {
        const response = await fetch(`/admin/email-templates/${allowedTemplate}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: trimmedSubject,
                bodyHtml: trimmedBodyHtml,
                bodyPlain: convertHtmlToPlainText(trimmedBodyHtml)
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to save template on server.');
        }
        return true;
    } catch (error) {
        console.warn('Template saved locally; server save failed:', error);
        return 'local-only';
    }
}

async function saveCurrentComposeTemplate(templateType) {
    const subject = document.getElementById('emailSubject')?.value || '';
    const bodyHtml = document.getElementById('emailContent')?.innerHTML || '';

    try {
        const result = await saveEmailTemplate(templateType, subject, bodyHtml);
        if (result === 'local-only') {
            alert('Template saved locally for future use on this browser. Server sync is currently unavailable.');
        } else {
            alert('Template saved successfully for future use.');
        }
    } catch (error) {
        console.error('Failed to save compose template:', error);
        alert(`Failed to save template: ${error.message}`);
    }
}

async function saveCurrentBatchTemplate() {
    const templateType = ['invitation', 'rejection', 'first-reminder', 'final-submission'].includes(window.batchEmailType)
        ? window.batchEmailType
        : 'invitation';
    const subject = document.getElementById('batchEmailSubject')?.value || '';
    const bodyHtml = document.getElementById('batchEmailContent')?.innerHTML || '';

    try {
        const result = await saveEmailTemplate(templateType, subject, bodyHtml);
        if (result === 'local-only') {
            alert('Template saved locally for future use on this browser. Server sync is currently unavailable.');
        } else {
            alert('Template saved successfully for future use.');
        }
    } catch (error) {
        console.error('Failed to save batch template:', error);
        alert(`Failed to save template: ${error.message}`);
    }
}

async function confirmSendEmail(authorId, templateType = 'invitation') {
    // Always fetch fresh author data to avoid stale cache
    let author = null;
    try {
        const res = await fetch('/authors');
        const data = await res.json();
        if (data.success && data.authors) {
            const normalizedTargetId = Number(authorId);
            author = data.authors.find((candidate) => Number(candidate.id) === normalizedTargetId);
        }
    } catch (err) {
        console.error('Could not fetch authors before send:', err);
    }

    if (!author) {
        alert('Author not found.');
        return;
    }
    
    const selectedTemplateType = templateType === 'rejection' ? 'rejection' : 'invitation';
    const emailActionLabel = selectedTemplateType === 'rejection' ? 'rejection email' : 'invitation email';
    const defaultSubject = EMAIL_SEND_TEMPLATE_FALLBACKS[selectedTemplateType]?.subject || EMAIL_SEND_TEMPLATE_FALLBACKS.invitation.subject;

    const confirmed = confirm(`Send ${emailActionLabel} automatically to ${author.firstName} ${author.lastName} (${author.email})?`);
    
    if (confirmed) {
        // Show loading state
        const sendButton = document.querySelector(`#emailCompositionModal .btn-success[onclick*="confirmSendEmail(${authorId}"]`) || event.target;
        const originalText = sendButton.innerHTML;
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Email...';

        const subjectTemplate = document.getElementById('emailSubject')?.value || defaultSubject;
        const emailBodyTemplate = document.getElementById('emailContent')?.innerHTML || generateEmailBody(author);
        const ccInputValue = document.getElementById('emailCc')?.value || '';
        const bccInputValue = document.getElementById('emailBcc')?.value || '';
        const variables = buildEmailTemplateVariables(author, window._allAuthorsCache || [author]);
        const subject = applyEmailTemplate(subjectTemplate, variables);
        const emailBody = applyEmailTemplate(emailBodyTemplate, variables);
        let cc = '';
        let bcc = '';

        try {
            cc = parseCcRecipients(ccInputValue);
            bcc = parseBccRecipients(bccInputValue);
        } catch (error) {
            alert(error.message);
            sendButton.disabled = false;
            sendButton.innerHTML = originalText;
            return;
        }
        
        // Prepare email data
        const emailData = {
            to: author.email,
            subject,
            emailBody,
            cc,
            bcc,
            firstName: author.firstName,
            lastName: author.lastName,
            paperTitle: author.paperTitle,
            userId: author.userId,
            password: author.password,
            authorId: author.id,
            templateType: selectedTemplateType
        };
        
        // Invalidate cache before sending email
        invalidateAuthorsCache();
        
        // Send email via backend service
        fetch('/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        })
        .then(response => response.json())
        .then(data => {
            // Reset button
            sendButton.disabled = false;
            sendButton.innerHTML = originalText;
            
            if (data.success) {
                const postSend = selectedTemplateType === 'rejection'
                    ? markAuthorInvitationStatus(author.id, 'declined')
                    : Promise.resolve();

                postSend.then(() => {
                    alert(`✅ Email sent successfully to ${author.email}!\n\nMessage ID: ${data.messageId}`);
                    closeEmailCompositionModal();
                
                    // Refresh the send invitation modal if it's open
                    setTimeout(() => {
                        if (document.getElementById('sendInvitationModal')) {
                            closeSendInvitationModal();
                            setTimeout(() => {
                                openSendInvitationModal();
                            }, 300);
                        }
                    }, 300);
                });
            } else {
                alert(`❌ Failed to send email: ${data.error}\n\nPlease check if the email service is running.`);
            }
        })
        .catch(error => {
            // Reset button
            sendButton.disabled = false;
            sendButton.innerHTML = originalText;
            
            console.error('Email sending error:', error);
            alert(`❌ Email service error: ${error.message}\n\nPlease ensure the email service is running:\n1. Open a terminal\n2. Run: npm install\n3. Run: npm start`);
        });
    }
}

function getCurrentAuthorId() {
    // Get author ID from the current modal context
    const modal = document.getElementById('emailCompositionModal');
    if (modal) {
        const sendButton = modal.querySelector('.btn-success[onclick*="confirmSendEmail"]');
        if (sendButton) {
            const onclick = sendButton.getAttribute('onclick');
            const match = onclick.match(/confirmSendEmail\((\d+)\)/);
            return match ? parseInt(match[1]) : null;
        }
    }
    return null;
}

function refreshModals() {
    // Close current modals and refresh
    closeEmailCompositionModal();
    
    setTimeout(() => {
        if (document.getElementById('sendInvitationModal')) {
            closeSendInvitationModal();
            setTimeout(() => {
                openSendInvitationModal();
            }, 300);
        }
    }, 300);
}

async function confirmBatchSend() {
    const selectedIds = window.batchSelectedIds;
    const templateType = ['invitation', 'rejection', 'first-reminder', 'final-submission'].includes(window.batchEmailType)
        ? window.batchEmailType
        : 'invitation';
    if (!selectedIds || selectedIds.length === 0) {
        alert('No authors selected.');
        return;
    }
    
    // Show loading state
    const sendButton = document.getElementById('batchSendBtn');
    const originalText = sendButton.innerHTML;
    sendButton.disabled = true;
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Emails (Bulk Mode)...';

    const subjectTemplate = document.getElementById('batchEmailSubject')?.value || EMAIL_SEND_TEMPLATE_FALLBACKS[templateType].subject;
    const bodyTemplate = document.getElementById('batchEmailContent')?.innerHTML || EMAIL_SEND_TEMPLATE_FALLBACKS[templateType].bodyHtml;
    const ccInputValue = document.getElementById('batchEmailCc')?.value || '';
    const bccInputValue = document.getElementById('batchEmailBcc')?.value || '';
    let cc = '';
    let bcc = '';

    try {
        cc = parseCcRecipients(ccInputValue);
        bcc = parseBccRecipients(bccInputValue);
    } catch (error) {
        alert(error.message);
        sendButton.disabled = false;
        sendButton.innerHTML = originalText;
        return;
    }

    try {
        const authorsData = await fetchAuthorsFromApi();
        const normalizedSelectedIds = selectedIds.map((id) => Number(id));
        const selectedAuthors = authorsData.filter((candidate) => normalizedSelectedIds.includes(Number(candidate.id)));

        window._allAuthorsCache = authorsData;
        
        // Prepare all emails for bulk sending (parallel on backend)
        const emailsToSend = selectedAuthors.map(author => {
            const variables = buildEmailTemplateVariables(author, authorsData);
            return {
                to: author.email,
                subject: applyEmailTemplate(subjectTemplate, variables),
                emailBody: applyEmailTemplate(bodyTemplate, variables),
                cc,
                bcc,
                firstName: author.firstName,
                authorId: author.id,
                userId: author.userId,
                password: author.password,
                templateType
            };
        });

        // Send all emails in one bulk request (parallel on backend)
        const response = await fetch('/send-bulk-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails: emailsToSend })
        });
        
        const result = await response.json();

        if (result.success && result.summary.successCount > 0) {
            // Update rejection statuses if needed
            if (templateType === 'rejection') {
                for (const author of selectedAuthors) {
                    await markAuthorInvitationStatus(author.id, 'declined');
                }
            }

            closeBatchEmailModal();

            const messageTypeMap = {
                invitation: 'invitation',
                rejection: 'rejection',
                'first-reminder': 'first draft reminder',
                'final-submission': 'final paper submission'
            };
            const messageType = messageTypeMap[templateType] || 'email';
            const timeMsg = result.summary.durationMs ? ` (${(result.summary.durationMs/1000).toFixed(2)}s)` : '';
            alert(`Successfully sent ${result.summary.successCount} ${messageType} email(s)!${timeMsg}\n${result.summary.failureCount > 0 ? `(${result.summary.failureCount} failed)` : ''}`);
            
            setTimeout(() => {
                if (document.getElementById('sendInvitationModal')) {
                    closeSendInvitationModal();
                    setTimeout(() => {
                        openSendInvitationModal();
                    }, 300);
                }
            }, 300);
        } else {
            const failType = templateType === 'rejection' ? 'rejections' : 'invitations';
            alert(`No ${failType} were sent. ${result.error ? 'Error: ' + result.error : 'Please try again.'}`);
        }
    } catch (error) {
        console.error('Batch send error:', error);
        alert('Error sending batch emails. Please try again.');
    } finally {
        sendButton.disabled = false;
        sendButton.innerHTML = originalText;
    }
}

// Helper functions for invitation tracking
function sendInvitationToAuthor(userId) {
    fetchAuthorsFromApi().then(authorsData => {
        const author = (authorsData || []).find(a => a.userId === userId);
        if (!author) {
            alert('Author not found.');
            return;
        }

        closeProgressTrackingModal();
        setTimeout(() => {
            openEmailCompositionModal(author.id);
        }, 150);
    });
}

function resendInvitation(userId) {
    if (confirm('Are you sure you want to resend the invitation?')) {
        sendInvitationToAuthor(userId);
    }
}

async function sendSingleInvitation(author, callback) {
    try {
        const template = await fetchEmailSendTemplate('invitation');
        // Use cached all-authors list for multi-paper table if available
        const allAuthors = window._allAuthorsCache || [];
        const variables = buildEmailTemplateVariables(author, allAuthors);
        const emailData = {
            to: author.email,
            subject: applyEmailTemplate(template.subject, variables),
            firstName: author.firstName,
            authorId: author.id,
            emailBody: applyEmailTemplate(template.bodyHtml, variables)
        };

        invalidateAuthorsCache();
        const response = await fetch('/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        const data = await response.json();
        if (data.success) {
            alert(`Invitation sent successfully to ${author.email}`);
            if (callback) callback();
        } else {
            alert('Failed to send invitation. Please try again.');
        }
    } catch (error) {
        console.error('Error sending invitation:', error);
        alert('Error sending invitation. Please try again.');
    }
}

async function sendFirstDraftReminders() {
    console.log('Sending first draft reminders...');
    
    // Get authors data
    const authorsData = await fetchAuthorsFromApi();
    
    // Filter authors who have accepted invitations
    const acceptedAuthors = authorsData.filter(author => {
        const invitationSent = author.progress.stages['invitation-send'].status === 'completed';
        const invitationAccepted = author.invitationStatus === 'accepted';
        return invitationSent && invitationAccepted;
    });
    
    if (acceptedAuthors.length === 0) {
        alert('No authors have accepted invitations yet. Please send invitations first and wait for authors to accept them.');
        return;
    }
    
    // First choose which papers/authors should receive the reminder.
    showFirstDraftReminderSelectionModal(acceptedAuthors);
}

function showFirstDraftReminderSelectionModal(acceptedAuthors) {
    const modalHTML = `
        <div class="modal-overlay" id="firstDraftReminderModal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-bell"></i> Select Papers For First Draft Reminder</h3>
                    <button class="modal-close" onclick="closeFirstDraftReminderModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="reminder-info">
                        <h4>Step 1: Select Paper IDs</h4>
                        <p><strong>Available Recipients:</strong> Authors who have accepted invitations</p>
                        <p><strong>Total Available:</strong> ${acceptedAuthors.length} authors</p>
                        <p><strong>Action:</strong> Choose the paper ID(s) and author(s) that should receive the first draft reminder.</p>
                    </div>
                    
                    <div class="recipients-list">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                            <h4 style="margin:0;">Recipients List</h4>
                            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                <button type="button" class="btn-secondary" onclick="selectAllFirstDraftRecipients()">
                                    <i class="fas fa-check-square"></i> Select All
                                </button>
                                <button type="button" class="btn-secondary" onclick="clearAllFirstDraftRecipients()">
                                    <i class="fas fa-square"></i> Clear Selection
                                </button>
                            </div>
                        </div>
                        <div class="recipients-table-container">
                            <table class="recipients-table">
                                <thead>
                                    <tr>
                                        <th width="50">
                                            <input type="checkbox" id="selectAllFirstDraftCheckbox" onchange="toggleSelectAllFirstDraftRecipients()">
                                        </th>
                                        <th>Author Name</th>
                                        <th>Email</th>
                                        <th>Paper ID</th>
                                        <th>Paper Title</th>
                                        <th>Invitation Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${acceptedAuthors.map((author, index) => `
                                        <tr class="first-draft-recipient-row" onclick="toggleFirstDraftRecipientRow(${index}, event)" style="cursor:pointer;">
                                            <td>
                                                <input type="checkbox" class="first-draft-recipient-checkbox" value="${index}" onchange="updateFirstDraftRecipientSelection()" onclick="event.stopPropagation()">
                                            </td>
                                            <td>${author.firstName} ${author.lastName}</td>
                                            <td>${author.email}</td>
                                            <td>${author.paperId || 'N/A'}</td>
                                            <td>${author.paperTitle}</td>
                                            <td>
                                                <span class="status-badge accepted">
                                                    <i class="fas fa-check-circle"></i> Accepted
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="selection-info" id="firstDraftSelectionInfo" style="display:none; margin-top:16px;">
                        <i class="fas fa-info-circle"></i>
                        <span id="firstDraftSelectionCount">0</span> paper(s) selected for preview
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-success" id="previewFirstDraftBtn" onclick="proceedToFirstDraftReminderPreview()" disabled>
                        <i class="fas fa-arrow-right"></i> Preview Email Template
                    </button>
                    <button class="btn-secondary" onclick="closeFirstDraftReminderModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    window.firstDraftCandidates = acceptedAuthors;
    window.firstDraftRecipients = [];
    selectAllFirstDraftRecipients();
    
    setTimeout(() => {
        document.getElementById('firstDraftReminderModal').classList.add('active');
    }, 10);
}

function toggleFirstDraftRecipientRow(index, event) {
    if (event && event.target && event.target.closest('input, button, a, label')) {
        return;
    }

    const checkbox = document.querySelector(`.first-draft-recipient-checkbox[value="${index}"]`);
    if (!checkbox) {
        return;
    }

    checkbox.checked = !checkbox.checked;
    updateFirstDraftRecipientSelection();
}

function toggleSelectAllFirstDraftRecipients() {
    const selectAllCheckbox = document.getElementById('selectAllFirstDraftCheckbox');
    const checkboxes = document.querySelectorAll('.first-draft-recipient-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });

    updateFirstDraftRecipientSelection();
}

function selectAllFirstDraftRecipients() {
    document.querySelectorAll('.first-draft-recipient-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    updateFirstDraftRecipientSelection();
}

function clearAllFirstDraftRecipients() {
    document.querySelectorAll('.first-draft-recipient-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateFirstDraftRecipientSelection();
}

function updateFirstDraftRecipientSelection() {
    const checkboxes = Array.from(document.querySelectorAll('.first-draft-recipient-checkbox'));
    const selectedIndexes = checkboxes
        .filter(checkbox => checkbox.checked)
        .map(checkbox => Number(checkbox.value));
    const candidates = Array.isArray(window.firstDraftCandidates) ? window.firstDraftCandidates : [];
    const selectedRecipients = selectedIndexes
        .map(index => candidates[index])
        .filter(Boolean);
    const previewButton = document.getElementById('previewFirstDraftBtn');
    const selectionInfo = document.getElementById('firstDraftSelectionInfo');
    const selectionCount = document.getElementById('firstDraftSelectionCount');
    const selectAllCheckbox = document.getElementById('selectAllFirstDraftCheckbox');

    window.firstDraftRecipients = selectedRecipients;

    if (previewButton) {
        previewButton.disabled = selectedRecipients.length === 0;
        previewButton.innerHTML = selectedRecipients.length > 0
            ? `<i class="fas fa-arrow-right"></i> Preview Email Template (${selectedRecipients.length})`
            : '<i class="fas fa-arrow-right"></i> Preview Email Template';
    }

    if (selectionInfo && selectionCount) {
        selectionInfo.style.display = selectedRecipients.length > 0 ? 'flex' : 'none';
        selectionCount.textContent = selectedRecipients.length;
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkboxes.length > 0 && selectedRecipients.length === checkboxes.length;
    }
}

function proceedToFirstDraftReminderPreview() {
    const recipients = Array.isArray(window.firstDraftRecipients) ? window.firstDraftRecipients : [];
    if (recipients.length === 0) {
        alert('Please select at least one paper ID before continuing.');
        return;
    }

    const selectedIds = recipients
        .map(recipient => recipient.id)
        .filter(id => Number.isFinite(id));

    if (selectedIds.length === 0) {
        alert('Could not resolve the selected authors. Please try again.');
        return;
    }

    closeFirstDraftReminderModal(() => {
        openBatchEmailModal(selectedIds, 'first-reminder');
    });
}

function showFirstDraftReminderPreviewModal(selectedRecipients) {
    const modalHTML = `
        <div class="modal-overlay" id="firstDraftReminderModal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-bell"></i> Send First Draft Reminders</h3>
                    <button class="modal-close" onclick="closeFirstDraftReminderModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="reminder-info">
                        <h4>Step 2: Review Email Template</h4>
                        <p><strong>Selected Recipients:</strong> ${selectedRecipients.length} author(s)</p>
                        <p><strong>Message:</strong> First draft submission reminder</p>
                    </div>

                    <div class="recipients-list">
                        <h4>Selected Recipients</h4>
                        <div class="recipients-table-container">
                            <table class="recipients-table">
                                <thead>
                                    <tr>
                                        <th>Author Name</th>
                                        <th>Email</th>
                                        <th>Paper ID</th>
                                        <th>Paper Title</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${selectedRecipients.map(author => `
                                        <tr>
                                            <td>${author.firstName} ${author.lastName}</td>
                                            <td>${author.email}</td>
                                            <td>${author.paperId || 'N/A'}</td>
                                            <td>${author.paperTitle || 'N/A'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="reminder-preview">
                        <h4>Email Preview</h4>
                        <div class="email-preview">
                            <div class="email-header">
                                <strong>Subject:</strong> First Draft Submission Reminder - IEEE PCIC Conference
                            </div>
                            <div class="email-content">
                                <p><strong>Dear [Author Name],</strong></p>
                                <p>We hope this message finds you well. This is a friendly reminder regarding your paper submission for the IEEE PCIC Conference.</p>
                                <p><strong>Paper ID:</strong> [Paper ID]</p>
                                <p><strong>Paper Title:</strong> [Paper Title]</p>
                                <p><strong>What's Next:</strong> Please prepare and upload your first draft by the specified deadline.</p>
                                <p><strong>Submission Guidelines:</strong></p>
                                <ul>
                                    <li>Submit your paper in PDF format</li>
                                    <li>Follow IEEE conference formatting guidelines</li>
                                    <li>Ensure all references are properly cited</li>
                                    <li>Include author information and affiliations</li>
                                </ul>
                                <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                                <p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p>
                            </div>
                        </div>
                    </div>

                    <div class="confirmation-section">
                        <div class="confirmation-checkbox">
                            <input type="checkbox" id="confirmFirstDraftSend">
                            <label for="confirmFirstDraftSend">I confirm that I want to send first draft reminders to the ${selectedRecipients.length} selected author(s).</label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-success" id="sendFirstDraftBtn" onclick="executeFirstDraftReminders()" disabled>
                        <i class="fas fa-paper-plane"></i> Send Reminders
                    </button>
                    <button class="btn-secondary" onclick="closeFirstDraftReminderModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.firstDraftRecipients = selectedRecipients;

    document.getElementById('confirmFirstDraftSend').addEventListener('change', function() {
        document.getElementById('sendFirstDraftBtn').disabled = !this.checked;
    });

    setTimeout(() => {
        document.getElementById('firstDraftReminderModal').classList.add('active');
    }, 10);
}

function closeFirstDraftReminderModal(onClosed) {
    const modal = document.getElementById('firstDraftReminderModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            if (typeof onClosed === 'function') {
                onClosed();
            }
        }, 300);
        return;
    }

    if (typeof onClosed === 'function') {
        onClosed();
    }
}

function executeFirstDraftReminders() {
    const recipients = window.firstDraftRecipients;
    if (!recipients || recipients.length === 0) {
        alert('No recipients found.');
        return;
    }
    
    // Show loading state
    const sendBtn = document.getElementById('sendFirstDraftBtn');
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    sendBtn.disabled = true;
    
    // Send reminders to all accepted authors
    let successCount = 0;
    let errorCount = 0;
    
    const sendPromises = recipients.map(author => {
        const emailData = {
            to: author.email,
            subject: 'First Draft Submission Reminder - IEEE PCIC Conference',
            emailBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">First Draft Submission Reminder</h2>
                    <p><strong>Dear ${author.firstName} ${author.lastName},</strong></p>
                    <p>We hope this message finds you well. This is a friendly reminder regarding your paper submission for the IEEE PCIC Conference.</p>
                    <p><strong>Paper ID:</strong> ${author.paperId || 'N/A'}</p>
                    <p><strong>Paper Title:</strong> ${author.paperTitle}</p>
                    <p><strong>What's Next:</strong> Please prepare and upload your first draft by the specified deadline.</p>
                    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                    <p>Best regards,<br><strong>IEEE PCIC - Mariane Sub-Committee</strong></p>
                </div>
            `,
            firstName: author.firstName,
            lastName: author.lastName,
            paperTitle: author.paperTitle,
            paperId: author.paperId,
            userId: author.userId,
            password: author.password,
            authorId: author.id
        };
        
        invalidateAuthorsCache();
        return fetch('/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                successCount++;
            } else {
                errorCount++;
                console.error(`Failed to send reminder to ${author.email}:`, data.error);
            }
        })
        .catch(error => {
            errorCount++;
            console.error(`Error sending reminder to ${author.email}:`, error);
        });
    });
    
    // Wait for all emails to be sent
    Promise.all(sendPromises).then(() => {
        // Show results
        if (successCount === recipients.length) {
            alert(`✅ Success! First draft reminders sent to ${successCount} selected author(s).`);
            // Update timeline status
            updateTimelineItemStatus('first-draft-reminder', 'completed');
        } else if (successCount > 0) {
            alert(`⚠️ Partial Success: Reminders sent to ${successCount} authors. ${errorCount} failed.`);
            updateTimelineItemStatus('first-draft-reminder', 'in-progress');
        } else {
            alert(`❌ Failed: Unable to send reminders. Please check your email configuration.`);
        }
        
        // Close modal
        closeFirstDraftReminderModal();
        
        // Refresh credentials table
        if (typeof refreshCredentialsTable === 'function') {
            refreshCredentialsTable();
        }
    });
}

async function sendFinalPaperSubmissionEmails() {
    console.log('Sending final paper submission emails...');

    const authorsData = await fetchAuthorsFromApi();
    const recipients = (authorsData || []).filter((author) => {
        const hasEmail = Boolean(author.email);
        const acceptedInvitation = author.invitationStatus === 'accepted';
        return hasEmail && acceptedInvitation;
    });

    if (recipients.length === 0) {
        alert('No authors with accepted invitations and valid email addresses were found.');
        return;
    }

    showFinalPaperRecipientSelectionModal(recipients);
}

function showFinalPaperRecipientSelectionModal(recipients) {
    const modalHTML = `
        <div class="modal-overlay" id="finalPaperSelectionModal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-file-signature"></i> Select Accepted Papers For Final Submission Email</h3>
                    <button class="modal-close" onclick="closeFinalPaperSelectionModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="reminder-info">
                        <h4>Step 1: Select Accepted Papers</h4>
                        <p><strong>Eligible Recipients:</strong> Authors who accepted invitations</p>
                        <p><strong>Total Eligible:</strong> ${recipients.length} author(s)</p>
                        <p><strong>Action:</strong> Choose the paper ID(s) that should receive the final paper submission email.</p>
                    </div>

                    <div class="recipients-list">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                            <h4 style="margin:0;">Accepted Papers List</h4>
                            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                <button type="button" class="btn-secondary" onclick="selectAllFinalPaperRecipients()">
                                    <i class="fas fa-check-square"></i> Select All
                                </button>
                                <button type="button" class="btn-secondary" onclick="clearAllFinalPaperRecipients()">
                                    <i class="fas fa-square"></i> Clear Selection
                                </button>
                            </div>
                        </div>
                        <div class="recipients-table-container">
                            <table class="recipients-table">
                                <thead>
                                    <tr>
                                        <th width="50">
                                            <input type="checkbox" id="selectAllFinalPaperCheckbox" onchange="toggleSelectAllFinalPaperRecipients()">
                                        </th>
                                        <th>Author Name</th>
                                        <th>Email</th>
                                        <th>Paper ID</th>
                                        <th>Paper Title</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recipients.map((author, index) => `
                                        <tr class="final-paper-recipient-row" onclick="toggleFinalPaperRecipientRow(${index}, event)" style="cursor:pointer;">
                                            <td>
                                                <input type="checkbox" class="final-paper-recipient-checkbox" value="${index}" onchange="updateFinalPaperRecipientSelection()" onclick="event.stopPropagation()">
                                            </td>
                                            <td>${author.firstName} ${author.lastName}</td>
                                            <td>${author.email}</td>
                                            <td>${author.paperId || 'N/A'}</td>
                                            <td>${author.paperTitle || 'N/A'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="selection-info" id="finalPaperSelectionInfo" style="display:none; margin-top:16px;">
                        <i class="fas fa-info-circle"></i>
                        <span id="finalPaperSelectionCount">0</span> paper(s) selected for email composition
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-success" id="composeFinalPaperBtn" onclick="proceedToFinalPaperBatchCompose()" disabled>
                        <i class="fas fa-arrow-right"></i> Edit Template & Send
                    </button>
                    <button class="btn-secondary" onclick="closeFinalPaperSelectionModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.finalPaperCandidates = recipients;
    window.finalPaperRecipients = [];
    selectAllFinalPaperRecipients();

    setTimeout(() => {
        document.getElementById('finalPaperSelectionModal').classList.add('active');
    }, 10);
}

function toggleFinalPaperRecipientRow(index, event) {
    if (event && event.target && event.target.closest('input, button, a, label')) {
        return;
    }

    const checkbox = document.querySelector(`.final-paper-recipient-checkbox[value="${index}"]`);
    if (!checkbox) return;
    checkbox.checked = !checkbox.checked;
    updateFinalPaperRecipientSelection();
}

function toggleSelectAllFinalPaperRecipients() {
    const selectAllCheckbox = document.getElementById('selectAllFinalPaperCheckbox');
    if (!selectAllCheckbox) return;
    const checkboxes = document.querySelectorAll('.final-paper-recipient-checkbox');
    checkboxes.forEach((checkbox) => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    updateFinalPaperRecipientSelection();
}

function selectAllFinalPaperRecipients() {
    const checkboxes = document.querySelectorAll('.final-paper-recipient-checkbox');
    checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
    });
    updateFinalPaperRecipientSelection();
}

function clearAllFinalPaperRecipients() {
    const checkboxes = document.querySelectorAll('.final-paper-recipient-checkbox');
    checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
    });
    updateFinalPaperRecipientSelection();
}

function updateFinalPaperRecipientSelection() {
    const checkboxes = Array.from(document.querySelectorAll('.final-paper-recipient-checkbox'));
    const selectedIndexes = checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => Number(checkbox.value))
        .filter((index) => Number.isFinite(index));

    const recipients = (window.finalPaperCandidates || []).filter((_author, index) => selectedIndexes.includes(index));
    window.finalPaperRecipients = recipients;

    const info = document.getElementById('finalPaperSelectionInfo');
    const count = document.getElementById('finalPaperSelectionCount');
    const composeBtn = document.getElementById('composeFinalPaperBtn');
    const selectAllCheckbox = document.getElementById('selectAllFinalPaperCheckbox');

    if (info && count) {
        info.style.display = recipients.length > 0 ? 'flex' : 'none';
        count.textContent = String(recipients.length);
    }

    if (composeBtn) {
        composeBtn.disabled = recipients.length === 0;
    }

    if (selectAllCheckbox) {
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedIndexes.length === checkboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedIndexes.length > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }
}

function proceedToFinalPaperBatchCompose() {
    const recipients = Array.isArray(window.finalPaperRecipients) ? window.finalPaperRecipients : [];
    if (recipients.length === 0) {
        alert('Please select at least one paper before continuing.');
        return;
    }

    const selectedIds = recipients
        .map((recipient) => recipient.id)
        .filter((id) => Number.isFinite(Number(id)));

    if (selectedIds.length === 0) {
        alert('Could not resolve selected authors. Please try again.');
        return;
    }

    closeFinalPaperSelectionModal(() => {
        openBatchEmailModal(selectedIds, 'final-submission');
    });
}

function closeFinalPaperSelectionModal(onClosed) {
    const modal = document.getElementById('finalPaperSelectionModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            delete window.finalPaperCandidates;
            delete window.finalPaperRecipients;
            if (typeof onClosed === 'function') {
                onClosed();
            }
        }, 300);
        return;
    }

    delete window.finalPaperCandidates;
    delete window.finalPaperRecipients;
    if (typeof onClosed === 'function') {
        onClosed();
    }
}

async function openFinalSubmissionsListModal() {
    const loadingHTML = `
        <div class="modal-overlay" id="finalSubmissionsModal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-file-signature"></i> Final Paper Submissions</h3>
                    <button class="modal-close" onclick="closeFinalSubmissionsListModal()">&times;</button>
                </div>
                <div class="modal-body" id="finalSubmissionsBody">
                    <p style="text-align:center;padding:32px;color:#64748b;">Loading final submissions...</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeFinalSubmissionsListModal()">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loadingHTML);
    setTimeout(() => {
        const modal = document.getElementById('finalSubmissionsModal');
        if (modal) modal.classList.add('active');
    }, 10);

    try {
        const authorsRes = await fetch('/authors');
        const authorsData = await authorsRes.json();
        const authors = authorsData.success ? (authorsData.authors || []) : [];

        const finalSubmittedAuthors = authors.filter((author) => {
            const notes = String(author?.progress?.stages?.['paper-submission']?.notes || '').toLowerCase();
            return notes.includes('final paper submitted');
        });

        const submissionResults = await Promise.all(finalSubmittedAuthors.map(async (author) => {
            try {
                const submissionsRes = await fetch(`/authors/${author.id}/submissions`);
                const submissionsData = await submissionsRes.json();
                const latest = submissionsData.success ? submissionsData.latest : null;
                return {
                    authorName: `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown Author',
                    fileName: latest?.fileName || 'Final paper file not found',
                    submittedAt: latest?.submittedAt || null,
                    fileUrl: latest?.fileUrl || ''
                };
            } catch (_error) {
                return {
                    authorName: `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown Author',
                    fileName: 'Unable to load file details',
                    submittedAt: null,
                    fileUrl: ''
                };
            }
        }));

        const body = document.getElementById('finalSubmissionsBody');
        if (!body) return;

        if (submissionResults.length === 0) {
            body.innerHTML = `
                <div style="text-align:center;padding:24px;color:#64748b;">
                    <i class="fas fa-folder-open" style="font-size:36px;margin-bottom:12px;"></i>
                    <h4 style="margin:0 0 8px 0;">No Final Submissions Yet</h4>
                    <p style="margin:0;">No author has submitted a final paper yet.</p>
                </div>
            `;
            return;
        }

        const listItems = submissionResults.map((item, index) => {
            const submittedOn = item.submittedAt
                ? new Date(item.submittedAt).toLocaleString()
                : 'Date not available';
            const downloadAction = item.fileUrl
                ? `<a href="${item.fileUrl}" target="_blank" rel="noopener" class="btn-primary" style="padding:6px 10px;font-size:12px;display:inline-flex;align-items:center;gap:6px;margin-top:8px;">
                        <i class="fas fa-download"></i> Download
                   </a>`
                : `<span style="display:inline-block;margin-top:8px;color:#94a3b8;font-size:12px;">Download not available</span>`;

            return `
                <li style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-weight:600;color:#1f2937;">${index + 1}. ${item.authorName}</div>
                    <div style="color:#334155;">Final Paper: ${item.fileName}</div>
                    <div style="font-size:12px;color:#64748b;">Submitted: ${submittedOn}</div>
                    <div>${downloadAction}</div>
                </li>
            `;
        }).join('');

        body.innerHTML = `
            <div class="reminder-info" style="margin-bottom:16px;">
                <h4 style="margin:0 0 6px 0;">Final Paper Submissions List</h4>
                <p style="margin:0;color:#64748b;">Author name and final paper submitted by each author.</p>
            </div>
            <ol style="margin:0;padding:0 0 0 20px;max-height:420px;overflow:auto;">
                ${listItems}
            </ol>
        `;
    } catch (error) {
        const body = document.getElementById('finalSubmissionsBody');
        if (body) {
            body.innerHTML = `
                <div style="text-align:center;padding:24px;color:#dc2626;">
                    Failed to load final submissions. Please try again.
                </div>
            `;
        }
        console.error('openFinalSubmissionsListModal error:', error);
    }
}

function closeFinalSubmissionsListModal() {
    const modal = document.getElementById('finalSubmissionsModal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
}

// Draft Review Functions
async function loadDraftReviews() {
    const tableContainer = document.getElementById('draftReviewTable');

    let sessions = [];
    try {
        const response = await fetch('/chat/sessions/admin');
        const result = await response.json();
        if (result.success) {
            sessions = result.sessions || [];
        }
    } catch (error) {
        console.error('Failed to load admin chat sessions:', error);
    }

    if (sessions.length === 0) {
        tableContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px 20px; color: #666;">
                <div style="font-size: 3em; margin-bottom: 15px; color: #ddd;">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h3 style="margin-bottom: 10px; color: #555;">No Authors Found</h3>
                <p>Create authors first to start submissions and chat discussions.</p>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <div class="draft-review-table">
            <table class="submissions-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Author Name(s)</th>
                        <th>Paper Title</th>
                        <th>Email</th>
                        <th>Submitted On</th>
                        <th>Last Message</th>
                        <th>Comments</th>
                        <th>Chat</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sessions.forEach((item, index) => {
        const author = item.author || {};
        const hasSubmission = Boolean(item.latestSubmissionAt);
        const unreadMessages = Number(item.unreadForAdmin || 0);

        let commentStatus = '';
        let commentClass = '';
        if (unreadMessages > 0) {
            commentStatus = `${unreadMessages} new author message${unreadMessages > 1 ? 's' : ''}`;
            commentClass = 'status-new-user';
        } else if ((item.totalMessages || 0) > 0) {
            commentStatus = 'No new comments';
            commentClass = 'status-no-new';
        } else if (hasSubmission) {
            commentStatus = 'No comments yet';
            commentClass = 'status-no-comments';
        } else {
            commentStatus = 'Waiting for submission';
            commentClass = 'status-no-comments';
        }

        const lastMessageText = item.lastMessage && item.lastMessage.message
            ? item.lastMessage.message
            : (hasSubmission ? 'Draft submitted - waiting for chat.' : 'No chat activity yet');
        const clippedLastMessage = String(lastMessageText).length > 55
            ? `${String(lastMessageText).slice(0, 55)}...`
            : String(lastMessageText);

        tableHTML += `
            <tr>
                <td>${index + 1}</td>
                <td class="author-name">${author.firstName || ''} ${author.lastName || ''}</td>
                <td class="paper-title">${author.paperTitle || 'Untitled Paper'}</td>
                <td class="email">${author.email || 'Not available'}</td>
                <td class="submitted-date">
                    ${hasSubmission ? new Date(item.latestSubmissionAt).toLocaleDateString() : 'Not submitted'}
                </td>
                <td class="file-info" title="${String(lastMessageText).replace(/"/g, '&quot;')}">
                    <span style="font-size: 0.9em; color: #374151;">${clippedLastMessage}</span>
                </td>
                <td class="comment-status">
                    <span class="status-indicator ${commentClass}">
                        <i class="fas fa-${getStatusIcon(commentClass)}"></i>
                        ${commentStatus}
                    </span>
                </td>
                <td class="chat-action">
                    <button class="btn-chat ${unreadMessages > 0 ? 'chat-has-unread' : 'chat-no-unread'}" id="chat-btn-author-${author.id}" onclick="openAdminChat(${author.id}, '${author.paperId || ''}', '${author.firstName || ''} ${author.lastName || ''}')" title="${unreadMessages > 0 ? unreadMessages + ' unread message' + (unreadMessages !== 1 ? 's' : '') : 'No new messages'}">
                        <i class="fas fa-comments"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    tableContainer.innerHTML = tableHTML;

    // Check unread status for each chat button
    sessions.forEach((item) => {
        const author = item.author || {};
        const chatBtn = document.getElementById(`chat-btn-author-${author.id}`);
        if (chatBtn) {
            checkAuthorChatUnreadStatus(author.id, chatBtn);
            // Check every 30 seconds (reduced from 10 for better performance)
            setInterval(() => checkAuthorChatUnreadStatus(author.id, chatBtn), 30000);
        }
    });
}

function getFileIcon(extension) {
    switch(extension.toLowerCase()) {
        case 'pdf': return 'pdf';
        case 'doc':
        case 'docx': return 'word';
        case 'txt': return 'alt';
        case 'jpg':
        case 'jpeg':
        case 'png': return 'image';
        default: return 'file';
    }
}

function getStatusIcon(statusClass) {
    switch(statusClass) {
        case 'status-unread-admin': return 'exclamation-circle';
        case 'status-new-user': return 'envelope';
        case 'status-no-new': return 'check-circle';
        case 'status-no-comments': return 'comment-slash';
        default: return 'comment';
    }
}

function refreshDraftReviews() {
    loadDraftReviews();
    showNotification('Draft reviews refreshed!', 'success');
}

async function uploadAdminDocument(event) {
    event.preventDefault();

    const fileInput = document.getElementById('adminDocumentFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showNotification('Please select a document to upload.', 'error');
        return;
    }

    const session = getSession();
    const createdByAdminId = session && session.user ? session.user.id : null;
    if (!createdByAdminId) {
        showNotification('Admin session not found. Please log in again.', 'error');
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-shield-virus"></i> Scanning...';
    }

    try {
        const payload = new FormData();
        payload.append('documentFile', fileInput.files[0]);
        payload.append('createdByAdminId', String(createdByAdminId));

        const response = await fetch('/admin/documents', {
            method: 'POST',
            body: payload
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Upload failed');
        }

        showNotification('Document uploaded and malware-scanned successfully.', 'success');
        event.target.reset();
        await loadAdminDocuments();
    } catch (error) {
        showNotification(error.message || 'Failed to upload document.', 'error');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Scan & Upload';
        }
    }
}

async function loadAdminDocuments() {
    const tableContainer = document.getElementById('adminDocumentsTable');
    if (!tableContainer) return;

    tableContainer.innerHTML = '<div style="padding:12px;color:#666;">Loading documents...</div>';

    try {
        const response = await fetch('/admin/documents');
        const result = await response.json();
        const documents = (result.success && Array.isArray(result.documents)) ? result.documents : [];

        if (documents.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 30px 20px; color: #666;">
                    <div style="font-size: 2.5em; margin-bottom: 10px; color: #ddd;"><i class="fas fa-folder-open"></i></div>
                    <h3 style="margin-bottom: 8px; color: #555;">No Documents Uploaded</h3>
                    <p>Upload your first document using the form above.</p>
                </div>
            `;
            return;
        }

        const rows = documents.map((doc, index) => {
            const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : '-';
            const fileSize = formatBytes(Number(doc.fileSize || 0));
            const scanStatus = (doc.malwareScanStatus || 'unknown').toLowerCase();
            const statusColor = scanStatus === 'clean' ? '#0f766e' : '#b91c1c';
            const statusLabel = scanStatus.charAt(0).toUpperCase() + scanStatus.slice(1);
            const downloadLink = doc.fileUrl
                ? `<a href="${doc.fileUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding:6px 10px; font-size: 12px;">Open</a>`
                : '<span style="color:#999;">Unavailable</span>';

            const deleteButton = `<button class="btn-danger" style="padding:6px 10px; font-size: 12px;" onclick="deleteAdminDocument(${doc.id}, '${String(doc.fileName || '').replace(/'/g, "\\'")}')">Delete</button>`;

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td title="${String(doc.fileName || '').replace(/"/g, '&quot;')}">${doc.fileName || '-'}</td>
                    <td>${fileSize}</td>
                    <td>${doc.uploadedBy || 'Unknown'}</td>
                    <td>${uploadedAt}</td>
                    <td><span style="font-weight:600; color:${statusColor};">${statusLabel}</span></td>
                    <td style="display:flex; gap:8px; align-items:center;">${downloadLink}${deleteButton}</td>
                </tr>
            `;
        }).join('');

        tableContainer.innerHTML = `
            <div class="draft-review-table">
                <table class="submissions-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Document Name</th>
                            <th>Size</th>
                            <th>Uploaded By</th>
                            <th>Uploaded Date</th>
                            <th>Malware Scan</th>
                            <th>File</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load admin documents:', error);
        tableContainer.innerHTML = '<div style="color:#b91c1c; padding:12px;">Failed to load documents.</div>';
    }
}

function refreshAdminDocuments() {
    loadAdminDocuments();
    showNotification('Document list refreshed.', 'success');
}

async function deleteAdminDocument(documentId, fileName) {
    const ok = confirm(`Delete document "${fileName}"? This cannot be undone.`);
    if (!ok) return;

    try {
        const response = await fetch(`/admin/documents/${documentId}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Delete failed');
        }

        showNotification('Document deleted successfully.', 'success');
        await loadAdminDocuments();
    } catch (error) {
        showNotification(error.message || 'Failed to delete document.', 'error');
    }
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? '#16a34a' : (type === 'error' ? '#dc2626' : '#2563eb');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        background: ${bg};
        color: white;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 2800);
}

function ensureAdminChatPopupStyles() {
    if (document.getElementById('adminChatPopupStyles')) return;

    const style = document.createElement('style');
    style.id = 'adminChatPopupStyles';
    style.textContent = `
        .chat-popup-overlay {
            position: fixed;
            inset: 0;
            background: rgba(10, 18, 46, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }
        .chat-popup-modal {
            width: min(1220px, 98vw);
            height: min(820px, 95vh);
            border-radius: 20px;
            overflow: hidden;
            background: #ffffff;
            box-shadow: 0 36px 96px rgba(11, 35, 116, 0.4), 0 12px 32px rgba(11, 35, 116, 0.2);
            border: 1px solid rgba(32, 62, 180, 0.3);
            display: flex;
            flex-direction: column;
        }
        .chat-popup-header {
            background: linear-gradient(135deg, #1e40af 0%, #3966f1 50%, #2f55d4 100%);
            color: #ffffff;
            padding: 18px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(11, 35, 116, 0.2);
        }
        .chat-popup-title {
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            letter-spacing: -0.3px;
        }
        .chat-popup-subtitle {
            font-size: 13px;
            opacity: 0.92;
            margin-top: 4px;
            font-weight: 500;
        }
        .chat-popup-close {
            border: none;
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
            width: 38px;
            height: 38px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 22px;
            line-height: 1;
            transition: all 0.2s ease;
        }
        .chat-popup-close:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
        }
        .chat-popup-frame {
            width: 100%;
            height: 100%;
            border: 0;
            background: #fff;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .chat-popup-frame.loaded {
            opacity: 1;
        }
        .chat-popup-loading {
            position: absolute;
            inset: 60px 0 0 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            background: #f9fafb;
            pointer-events: none;
        }
        .chat-popup-loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e5e7eb;
            border-top-color: #3966f1;
            border-radius: 50%;
            animation: chat-spin 0.7s linear infinite;
        }
        .chat-popup-loading-text {
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
        }
        @keyframes chat-spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function closeAdminChatPopup() {
    const existing = document.getElementById('adminChatPopupOverlay');
    if (existing) existing.remove();
}

function openAdminChatPopup(chatUrl, subtitle) {
    ensureAdminChatPopupStyles();
    closeAdminChatPopup();

    const overlay = document.createElement('div');
    overlay.className = 'chat-popup-overlay';
    overlay.id = 'adminChatPopupOverlay';

    overlay.innerHTML = `
        <div class="chat-popup-modal" role="dialog" aria-modal="true" aria-label="Author Chat">
            <div class="chat-popup-header">
                <div>
                    <div class="chat-popup-title">Author Communication</div>
                    <div class="chat-popup-subtitle">${subtitle || 'Live support channel'}</div>
                </div>
                <button class="chat-popup-close" type="button" onclick="closeAdminChatPopup()" aria-label="Close">&times;</button>
            </div>
            <div style="position:relative; flex:1; min-height:0;">
                <div class="chat-popup-loading" id="chatPopupLoading">
                    <div class="chat-popup-loading-spinner"></div>
                    <div class="chat-popup-loading-text">Opening chat...</div>
                </div>
                <iframe class="chat-popup-frame" id="chatPopupFrame" src="${chatUrl}" title="Author Chat"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                    onload="this.classList.add('loaded'); const l=document.getElementById('chatPopupLoading'); if(l) l.remove();"></iframe>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeAdminChatPopup();
        }
    });

    document.body.appendChild(overlay);
}

if (!window.__adminChatPopupMessageBound) {
    window.addEventListener('message', (event) => {
        if (event && event.data && event.data.type === 'closeChatPopup') {
            closeAdminChatPopup();
        }
    });
    window.__adminChatPopupMessageBound = true;
}

function openAdminChat(authorId, paperId = '', authorName = '') {
    if (!authorId) {
        showNotification('Author not found!', 'error');
        return;
    }

    const chatUrl = `chat-dashboard.html?authorId=${encodeURIComponent(authorId)}&admin=true&paperId=${encodeURIComponent(paperId || '')}&userName=${encodeURIComponent(authorName || '')}&popup=true`;
    const subtitle = `${authorName || 'Author'}${paperId ? ` | Paper ID: ${paperId}` : ''}`;
    openAdminChatPopup(chatUrl, subtitle);
}
