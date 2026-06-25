// Author Dashboard - Phase 1: Timeline Implementation

document.addEventListener('DOMContentLoaded', function() {
    console.log('Author Dashboard loaded');
    
    // Check if user is authenticated as an author
    const session = getSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // If admin tries to access, redirect
    if (session.user.userType === 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    // Load author data
    loadAuthorData(session.user);
    
    // Update timeline based on progress
    updateTimeline(session.user);

    // Load all papers for this author's email
    loadAuthorPapers(session.user.email);
    
    // Check for accepted papers and update timeline state
    checkAcceptedPapers(session.user.email);
    
    // Load documents uploaded for this author
    loadAuthorDocuments();
});

function loadAuthorData(author) {
    // Display author name
    const nameEl = document.getElementById('authorName');
    if (nameEl) {
        nameEl.textContent = `${author.firstName} ${author.lastName}`;
    }
    console.log('Author data loaded:', author);
}

async function checkPaperChatUnreadStatus(paperId, buttonElement) {
    try {
        const res = await fetch(`/chat/unread-count/paper/${encodeURIComponent(paperId)}`);
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
        console.error('Error checking paper chat status:', err);
    }
}

async function loadAuthorPapers(email) {
    const container = document.getElementById('papersTableContainer');
    if (!container) return;

    try {
        const res = await fetch(`/author/my-papers?email=${encodeURIComponent(email)}`);
        const data = await res.json();

        if (!data.success || !data.papers || data.papers.length === 0) {
            container.innerHTML = '<p style="color:#a0aec0; text-align:center; padding:20px;">No invitation has been sent for your papers yet. Please check back later.</p>';
            return;
        }

        const rows = data.papers.map((paper, i) => {
            const statusClass = paper.invitation_status === 'accepted' ? 'inv-status-accepted'
                              : paper.invitation_status === 'declined' ? 'inv-status-declined'
                              : 'inv-status-pending';
            const statusLabel = (paper.invitation_status || 'Pending').charAt(0).toUpperCase()
                              + (paper.invitation_status || 'pending').slice(1);

            let actionHtml;
            if (paper.invitation_status === 'accepted') {
                actionHtml = `<span class="btn-accepted-label"><i class="fas fa-check-circle"></i> Accepted</span>`;
            } else if (paper.invitation_status === 'declined') {
                actionHtml = `<span class="btn-declined-label"><i class="fas fa-times-circle"></i> Declined</span>`;
            } else {
                actionHtml = `
                    <button class="btn-accept" onclick="respondToInvitation('${paper.paper_id}', 'accepted')">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="btn-decline" onclick="respondToInvitation('${paper.paper_id}', 'declined')">
                        <i class="fas fa-times"></i> Decline
                    </button>`;
            }

            return `<tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><span class="paper-id-badge">${paper.paper_id || '-'}</span></td>
                <td>${paper.paper_title || '-'}</td>
                <td><span class="${statusClass}">${statusLabel}</span></td>
                <td style="white-space:nowrap;">${actionHtml}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div style="overflow-x:auto;">
                <table class="papers-table">
                    <thead>
                        <tr>
                            <th style="width:50px;">#</th>
                            <th style="width:130px;">Paper ID</th>
                            <th>Paper Title</th>
                            <th style="width:140px;">Invitation Status</th>
                            <th style="width:180px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    } catch (err) {
        console.error('Failed to load papers:', err);
        container.innerHTML = '<p style="color:#e53e3e; padding:20px;"><i class="fas fa-exclamation-circle"></i> Failed to load papers. Please refresh.</p>';
    }
}

function updateTimeline(author) {
    // Get author progress stages
    const progress = author.progress || {};
    const stages = progress.stages || {};

    // Define timeline mapping
    const timelineMap = {
        'invitation': {
            elementId: 'timeline-invitation',
            dateElementId: 'date-invitation',
            stageKey: 'invitation-send',
            checkInvitationStatus: true
        },
        'first-draft': {
            elementId: 'timeline-first-draft',
            dateElementId: 'date-first-draft',
            stageKey: 'first-draft-reminder'
        },
        'paper-submission': {
            elementId: 'timeline-paper-submission',
            dateElementId: 'date-paper-submission',
            stageKey: 'paper-submission'
        },
        'review': {
            elementId: 'timeline-review',
            dateElementId: 'date-review',
            stageKey: 'review-in-progress'
        }
    };

    // Update each timeline item
    for (const [key, config] of Object.entries(timelineMap)) {
        const timelineElement = document.getElementById(config.elementId);
        const dateElement = document.getElementById(config.dateElementId);
        
        if (!timelineElement) continue;

        let status = 'pending';
        let displayDate = config.checkInvitationStatus ? '' : 'Pending';

        if (config.checkInvitationStatus) {
            // Check invitation status for first item
            if (author.invitationStatus === 'accepted') {
                status = 'active';
                displayDate = 'Accepted';
            } else if (author.invitationStatus === 'declined') {
                status = 'completed';
                displayDate = 'Declined';
            }
        } else {
            // Check progress stages for other items
            const stage = stages[config.stageKey];
            if (stage && stage.status === 'completed') {
                status = 'completed';
                if (stage.completedAt) {
                    displayDate = new Date(stage.completedAt).toLocaleDateString();
                } else {
                    displayDate = 'Completed';
                }
            } else if (stage && stage.status === 'active') {
                status = 'active';
                displayDate = 'In Progress';
            }
        }

        // Update element classes
        timelineElement.className = `timeline-item ${status}`;
        
        // Update date element
        if (dateElement) {
            dateElement.textContent = displayDate;
        }

        console.log(`Timeline ${key}: ${status} - ${displayDate}`);
    }

    // Update active timeline item (first incomplete item or first item)
    updateActiveTimelineItem();
}

function updateActiveTimelineItem() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    let activeSet = false;

    // First pass: find first non-completed item and set as active
    for (const item of timelineItems) {
        if (!item.classList.contains('completed')) {
            item.classList.add('active');
            activeSet = true;
            break;
        }
    }

    // If all completed, highlight the last one
    if (!activeSet && timelineItems.length > 0) {
        timelineItems[timelineItems.length - 1].classList.add('active');
    }
}

async function respondToInvitation(paperId, action) {
    const session = getSession();
    if (!session || !session.user) return;
    const email = session.user.email;

    const label = action === 'accepted' ? 'accept' : 'decline';
    if (!confirm(`Are you sure you want to ${label} the invitation for paper ${paperId}?`)) return;

    try {
        const res = await fetch('/author/paper-invitation-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paperId, action, email })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        // Reload papers table to reflect updated status
        await loadAuthorPapers(email);
        
        // Check and update timeline state for accepted papers
        await checkAcceptedPapers(email);
    } catch (err) {
        console.error('respondToInvitation error:', err);
        alert('Failed to update invitation status. Please try again.');
    }
}

function getAcknowledgementLabel(response) {
    if (response === 'yes_on_time') return 'Yes, will submit the file on time';
    if (response === 'no') return 'No';
    if (response === 'other_responses') return 'Other Responses';
    return '';
}

function formatUploadDateTime(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString();
}

function getDisplayFirstDraftFileName(fileName, email, paperId) {
    const rawName = String(fileName || '').trim();
    if (!rawName) return '';

    const safeEmail = String(email || '').trim();
    const safePaperId = String(paperId || '').trim();
    const storedPrefix = safeEmail && safePaperId ? `${safeEmail}_${safePaperId}_` : '';

    if (storedPrefix && rawName.startsWith(storedPrefix)) {
        return rawName.slice(storedPrefix.length) || rawName;
    }

    return rawName;
}

async function downloadLatestDraftForAuthor(paperId, email, fallbackFileName) {
    try {
        const endpoint = `/author/download-first-draft/${encodeURIComponent(paperId)}?email=${encodeURIComponent(email)}`;
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

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fallbackFileName || 'first-draft';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        console.error('downloadLatestDraftForAuthor error:', error);
        alert('Unable to download latest uploaded draft: ' + error.message);
    }
}

async function submitPaperAcknowledgement(paperId, paperKey) {
    const selectEl = document.getElementById(`ack-select-${paperKey}`);
    if (!selectEl) return;

    const response = selectEl.value;
    if (!response) {
        alert('Please select an acknowledge option before submitting.');
        return;
    }

    await savePaperAcknowledgement(paperId, response);
}

async function savePaperAcknowledgement(paperId, response) {
    const session = getSession();
    if (!session || !session.user) return;

    try {
        const res = await fetch('/author/paper-acknowledgement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paperId,
                email: session.user.email,
                response
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to save acknowledgement');

        await loadAcceptedPapersTable();
    } catch (err) {
        console.error('savePaperAcknowledgement error:', err);
        alert('Failed to save acknowledgement. Please try again.');
    }
}

function normalizeDateForInput(value) {
    if (!value) return '';

    // Already in correct format
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        if (value.includes('T')) return value.split('T')[0];
    }

    // Parse date in LOCAL timezone without UTC conversion
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DD using LOCAL date components (NOT toISOString which uses UTC)
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function saveSubmissionDate(paperId, expectedDate) {
    const session = getSession();
    if (!session || !session.user) return;

    console.log(`💾 Saving date for ${paperId}: sent="${expectedDate}"`);

    try {
        const res = await fetch('/author/paper-submission-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paperId,
                email: session.user.email,
                expectedSubmissionDate: expectedDate || null
            })
        });

        const data = await res.json();
        console.log(`✅ Save response for ${paperId}:`, data);
        if (!data.success) throw new Error(data.message || 'Failed to save date');

        await loadAcceptedPapersTable();
    } catch (err) {
        console.error('saveSubmissionDate error:', err);
        alert('Failed to save submission date. Please try again.');
    }
}

function ensureAuthorChatPopupStyles() {
    if (document.getElementById('authorChatPopupStyles')) return;

    const style = document.createElement('style');
    style.id = 'authorChatPopupStyles';
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
        .chat-popup-frame {
            width: 100%;
            height: 100%;
            flex: 1;
            min-height: 0;
            border: 0;
            background: #fff;
        }
    `;
    document.head.appendChild(style);
}

function closeAuthorChatPopup() {
    const existing = document.getElementById('authorChatPopupOverlay');
    if (existing) existing.remove();
}

function openAuthorChatPopup(chatUrl, paperId) {
    ensureAuthorChatPopupStyles();
    closeAuthorChatPopup();

    const overlay = document.createElement('div');
    overlay.className = 'chat-popup-overlay';
    overlay.id = 'authorChatPopupOverlay';

    overlay.innerHTML = `
        <div class="chat-popup-modal" role="dialog" aria-modal="true" aria-label="Chat with Admin">
            <iframe class="chat-popup-frame" src="${chatUrl}" title="Chat with Admin"></iframe>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeAuthorChatPopup();
        }
    });

    document.body.appendChild(overlay);
}

if (!window.__authorChatPopupMessageBound) {
    window.addEventListener('message', (event) => {
        if (event && event.data && event.data.type === 'closeChatPopup') {
            closeAuthorChatPopup();
        }
    });
    window.__authorChatPopupMessageBound = true;
}

async function openPaperChat(authorId, paperId) {
    if (!Number.isInteger(authorId) || authorId <= 0) {
        alert('Chat cannot be opened for this paper right now.');
        return;
    }

    try {
        const chatUrl = `chat-dashboard.html?authorId=${encodeURIComponent(authorId)}&paperId=${encodeURIComponent(paperId)}&popup=true`;
        openAuthorChatPopup(chatUrl, paperId);
    } catch (err) {
        console.error('openPaperChat error:', err);
        alert('Failed to open chat with admin. Please try again.');
    }
}

async function checkAcceptedPapers(email) {
    try {
        const res = await fetch(`/author/my-papers?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        
        if (!data.success || !data.papers) return;
        
        const hasAccepted = data.papers.some(p => p.invitation_status === 'accepted');
        const firstDraftTimeline = document.getElementById('timeline-first-draft');
        
        if (hasAccepted && firstDraftTimeline) {
            firstDraftTimeline.classList.add('has-accepted-papers');
            // Optionally set it to active
            firstDraftTimeline.classList.add('active');
        } else if (firstDraftTimeline) {
            firstDraftTimeline.classList.remove('has-accepted-papers');
        }
    } catch (err) {
        console.error('checkAcceptedPapers error:', err);
    }
}

function toggleAcceptedPapersSection() {
    const acceptedSection = document.getElementById('acceptedPapersSection');
    const completedSection = document.getElementById('completedPapersSection');
    const papersSection = document.querySelector('.papers-section');
    const firstDraftTimeline = document.getElementById('timeline-first-draft');

    if (!acceptedSection || !firstDraftTimeline || !firstDraftTimeline.classList.contains('has-accepted-papers')) return;

    const willShow = !acceptedSection.classList.contains('show');
    acceptedSection.classList.toggle('show', willShow);

    if (completedSection) {
        completedSection.classList.remove('show');
    }
    if (papersSection) {
        papersSection.style.display = willShow ? 'none' : 'block';
    }

    if (willShow) {
        loadAcceptedPapersTable();
    }
}

function toggleCompletedPapersSection() {
    const acceptedSection = document.getElementById('acceptedPapersSection');
    const completedSection = document.getElementById('completedPapersSection');
    const papersSection = document.querySelector('.papers-section');

    if (!completedSection) return;

    const willShow = !completedSection.classList.contains('show');
    completedSection.classList.toggle('show', willShow);

    if (acceptedSection) {
        acceptedSection.classList.remove('show');
    }
    if (papersSection) {
        papersSection.style.display = willShow ? 'none' : 'block';
    }

    if (willShow) {
        loadCompletedPapersTable();
    }
}

function toggleMyPapersSection() {
    const papersSection = document.querySelector('.papers-section');
    const acceptedSection = document.getElementById('acceptedPapersSection');
    const completedSection = document.getElementById('completedPapersSection');

    if (papersSection) {
        papersSection.style.display = papersSection.style.display === 'none' ? 'block' : 'none';

        if (papersSection.style.display === 'block') {
            if (acceptedSection) acceptedSection.classList.remove('show');
            if (completedSection) completedSection.classList.remove('show');
        }
    }
}

async function loadAcceptedPapersTable() {
    const session = getSession();
    if (!session || !session.user) return;

    const email = session.user.email;
    const container = document.getElementById('acceptedPapersTableContainer');
    if (!container) return;

    try {
        const res = await fetch(`/author/my-papers?email=${encodeURIComponent(email)}&_=${Date.now()}`);
        const data = await res.json();

        if (!data.success || !data.papers) {
            container.innerHTML = '<p style="color: #a0aec0; text-align: center;">No papers found.</p>';
            return;
        }

        const acceptedPapers = data.papers.filter((p) => p.invitation_status === 'accepted');
        if (acceptedPapers.length === 0) {
            container.innerHTML = '<p style="color: #a0aec0; text-align: center; padding: 20px;">No accepted papers yet. Accept a paper invitation to get started.</p>';
            return;
        }

        const rows = acceptedPapers.map((paper, i) => {
            const hasUploadedDraft = Boolean(paper.first_draft_submitted || paper.first_draft_submitted_at);
            const latestFileName = getDisplayFirstDraftFileName(
                paper.first_draft_file_name,
                paper.email || email,
                paper.paper_id
            ) || '';
            const latestDraftHtml = hasUploadedDraft
                ? `<button class="btn-chat-admin" onclick="downloadLatestDraftForAuthor('${paper.paper_id}', '${paper.email || email}', '${latestFileName || 'first-draft'}')">
                        <i class="fas fa-download"></i> ${latestFileName || 'Download Draft'}
                   </button>`
                : '<span style="color:#94a3b8;">Not uploaded</span>';

            const submissionDateHtml = formatUploadDateTime(paper.first_draft_submitted_at);

            const chatHtml = `<button class="btn-chat-admin chat-no-unread" id="chat-btn-${paper.paper_id}" onclick="openPaperChat(${paper.id}, '${paper.paper_id}')">
                    <i class="fas fa-comments"></i> Chat with Admin
                </button>`;

            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #1a3a8f;">${i + 1}</td>
                    <td><span class="paper-id-badge">${paper.paper_id || '-'}</span></td>
                    <td>${paper.paper_title || '-'}</td>
                    <td style="white-space: nowrap;">
                        <input type="file" id="file-${paper.paper_id}" accept=".pdf,.doc,.docx,.txt" style="display: none;" onchange="uploadFirstDraft('${paper.paper_id}', this)">
                        <button class="btn-upload" onclick="document.getElementById('file-${paper.paper_id}').click()">
                            <i class="fas fa-upload"></i> Upload Draft
                        </button>
                    </td>
                    <td>${latestDraftHtml}</td>
                    <td>${submissionDateHtml}</td>
                    <td>${chatHtml}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="accepted-papers-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">#</th>
                            <th style="width: 130px;">Paper ID</th>
                            <th style="min-width: 520px;">Paper Title</th>
                            <th style="width: 150px;">Action</th>
                            <th style="width: 280px;">Latest Uploaded File</th>
                            <th style="width: 220px;">Uploaded Date</th>
                            <th style="width: 170px;">Chat with Admin</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        acceptedPapers.forEach((paper) => {
            const chatBtn = document.getElementById(`chat-btn-${paper.paper_id}`);
            if (chatBtn) {
                checkPaperChatUnreadStatus(paper.paper_id, chatBtn);
                setInterval(() => checkPaperChatUnreadStatus(paper.paper_id, chatBtn), 10000);
            }
        });
    } catch (err) {
        console.error('loadAcceptedPapersTable error:', err);
        container.innerHTML = '<p style="color: #e53e3e; padding: 20px; text-align: center;"><i class="fas fa-exclamation-circle"></i> Failed to load accepted papers.</p>';
    }
}

function getSubmissionFileKind(submission) {
    const name = String(submission?.fileName || '').toLowerCase();
    const mime = String(submission?.fileType || '').toLowerCase();

    if (name.endsWith('.pdf') || mime.includes('application/pdf')) {
        return 'pdf';
    }
    if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('application/msword') || mime.includes('officedocument.wordprocessingml.document')) {
        return 'word';
    }

    return null;
}

function selectLatestFileByKind(submissions, kind) {
    if (!Array.isArray(submissions)) return null;

    const match = submissions.find((submission) => getSubmissionFileKind(submission) === kind);
    if (!match) return null;

    return {
        fileName: match.fileName || (kind === 'pdf' ? 'PDF file' : 'Word file'),
        fileUrl: match.fileUrl || '',
        submittedAt: match.submittedAt || null
    };
}

async function fetchCompletedSubmissionSummary(authorId) {
    if (!Number.isInteger(Number(authorId)) || Number(authorId) <= 0) {
        return { pdf: null, word: null, uploadedAt: null };
    }

    try {
        const response = await fetch(`/authors/${authorId}/submissions?_=${Date.now()}`);
        const data = await response.json();
        const submissions = Array.isArray(data?.submissions) ? data.submissions : [];

        const pdf = selectLatestFileByKind(submissions, 'pdf');
        const word = selectLatestFileByKind(submissions, 'word');

        const uploadedAt = pdf?.submittedAt || word?.submittedAt || null;
        return { pdf, word, uploadedAt };
    } catch (error) {
        console.error('fetchCompletedSubmissionSummary error:', error);
        return { pdf: null, word: null, uploadedAt: null };
    }
}

function renderCompletedUploadCell(paper, fileInfo, kind) {
    const inputId = `${kind}-upload-${paper.id}`;
    const acceptTypes = kind === 'pdf' ? '.pdf' : '.doc,.docx';

    if (fileInfo && fileInfo.fileUrl) {
        const safeName = fileInfo.fileName || (kind === 'pdf' ? 'PDF file' : 'Word file');
        return `<input type="file" id="${inputId}" accept="${acceptTypes}" style="display:none;" onchange="uploadCompletedPaperFile(${paper.id}, '${paper.paper_id}', this, '${kind}')">
                <div style="display:flex; gap:8px; align-items:center;">
                    <a class="btn-chat-admin" href="${fileInfo.fileUrl}" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-download"></i> ${safeName}
                    </a>
                    <button class="btn-upload" style="padding:10px 12px; min-width:auto;" title="Re-upload ${kind.toUpperCase()} file" onclick="document.getElementById('${inputId}').click()">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>`;
    }

    const uploadLabel = kind === 'pdf' ? 'Upload PDF' : 'Upload Word';

    return `<input type="file" id="${inputId}" accept="${acceptTypes}" style="display:none;" onchange="uploadCompletedPaperFile(${paper.id}, '${paper.paper_id}', this, '${kind}')">
            <button class="btn-upload" onclick="document.getElementById('${inputId}').click()">
                <i class="fas fa-upload"></i> ${uploadLabel}
            </button>`;
}

async function loadCompletedPapersTable() {
    const session = getSession();
    if (!session || !session.user) return;

    const email = session.user.email;
    const container = document.getElementById('completedPapersTableContainer');
    if (!container) return;

    try {
        const res = await fetch(`/author/my-papers?email=${encodeURIComponent(email)}&_=${Date.now()}`);
        const data = await res.json();

        if (!data.success || !data.papers) {
            container.innerHTML = '<p style="color: #a0aec0; text-align: center;">No papers found.</p>';
            return;
        }

        const acceptedPapers = data.papers.filter((p) => p.invitation_status === 'accepted');
        if (acceptedPapers.length === 0) {
            container.innerHTML = '<p style="color: #a0aec0; text-align: center; padding: 20px;">No accepted papers available for completed submission.</p>';
            return;
        }

        const summaries = await Promise.all(acceptedPapers.map((paper) => fetchCompletedSubmissionSummary(Number(paper.id))));

        const rows = acceptedPapers.map((paper, index) => {
            const summary = summaries[index] || { pdf: null, word: null, uploadedAt: null };
            const uploadedDate = formatUploadDateTime(summary.uploadedAt);
            const chatButton = `<button class="btn-chat-admin chat-no-unread" id="chat-btn-completed-${paper.id}" onclick="openPaperChat(${paper.id}, '${paper.paper_id || ''}')">
                    <i class="fas fa-comments"></i> Chat with Admin
                </button>`;

            return `
                <tr>
                    <td><span class="paper-id-badge">${paper.paper_id || '-'}</span></td>
                    <td>${paper.paper_title || '-'}</td>
                    <td style="white-space:nowrap;">${renderCompletedUploadCell(paper, summary.pdf, 'pdf')}</td>
                    <td style="white-space:nowrap;">${renderCompletedUploadCell(paper, summary.word, 'word')}</td>
                    <td>${uploadedDate}</td>
                    <td>${chatButton}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div style="overflow-x:auto;">
                <table class="accepted-papers-table">
                    <thead>
                        <tr>
                            <th style="width: 130px;">Paper ID</th>
                            <th style="min-width: 520px;">Paper Title</th>
                            <th style="width: 220px;">Upload File (PDF)</th>
                            <th style="width: 220px;">Upload File (Word)</th>
                            <th style="width: 180px;">Uploaded Date</th>
                            <th style="width: 180px;">Chat with Admin</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        acceptedPapers.forEach((paper) => {
            const chatBtn = document.getElementById(`chat-btn-completed-${paper.id}`);
            if (chatBtn) {
                checkPaperChatUnreadStatus(paper.paper_id, chatBtn);
                setInterval(() => checkPaperChatUnreadStatus(paper.paper_id, chatBtn), 10000);
            }
        });
    } catch (err) {
        console.error('loadCompletedPapersTable error:', err);
        container.innerHTML = '<p style="color: #e53e3e; padding: 20px; text-align: center;"><i class="fas fa-exclamation-circle"></i> Failed to load completed paper submission details.</p>';
    }
}

async function uploadCompletedPaperFile(authorId, paperId, fileInput, kind) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const expectedExt = kind === 'pdf' ? /\.pdf$/i : /\.(doc|docx)$/i;
    if (!expectedExt.test(file.name)) {
        alert(kind === 'pdf' ? 'Please upload a PDF file.' : 'Please upload a Word (.doc/.docx) file.');
        fileInput.value = '';
        return;
    }

    const row = fileInput.closest('td');
    const uploadBtn = row ? row.querySelector('.btn-upload') : null;
    const originalLabel = uploadBtn ? uploadBtn.innerHTML : '';

    try {
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        }

        const payload = new FormData();
        payload.append('draftFile', file);
        payload.append('submissionType', 'final-paper');
        payload.append('comments', kind === 'pdf' ? 'Final paper PDF' : 'Final paper Word');

        const response = await fetch(`/authors/${authorId}/submissions/first-draft`, {
            method: 'POST',
            body: payload
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Upload failed');
        }

        fileInput.value = '';
        await loadCompletedPapersTable();
        await loadAcceptedPapersTable();
        alert(`${kind.toUpperCase()} file uploaded successfully for paper ${paperId}.`);
    } catch (error) {
        console.error('uploadCompletedPaperFile error:', error);
        alert(`Failed to upload ${kind.toUpperCase()} file: ${error.message}`);
        fileInput.value = '';
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalLabel || '<i class="fas fa-upload"></i> Upload';
        }
    }
}

async function uploadFirstDraft(paperId, fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const session = getSession();
    if (!session || !session.user) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('paperId', paperId);
    formData.append('email', session.user.email);

    let btn = null;
    let originalHTML = '';

    try {
        const row = fileInput.closest('tr');
        btn = row ? row.querySelector('.btn-upload') : null;

        if (btn) {
            originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        }

        const res = await fetch('/author/upload-first-draft', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Upload failed');
        }

        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Uploaded';
            btn.style.background = '#059669';
            btn.style.color = 'white';
        }

        // Refresh both sections immediately so latest uploaded file/date is visible without page refresh.
        await loadAcceptedPapersTable();
        await loadCompletedPapersTable();

        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                btn.style.background = '';
                btn.style.color = '';
            }
            fileInput.value = '';
        }, 2000);

        alert('First draft uploaded successfully!');
    } catch (err) {
        console.error('uploadFirstDraft error:', err);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML || '<i class="fas fa-upload"></i> Upload Draft';
            btn.style.background = '';
            btn.style.color = '';
        }
        alert('Failed to upload first draft: ' + err.message);
        fileInput.value = '';
    }
}

async function loadAuthorDocuments() {
    try {
        const data = await fetchSharedDocuments();

        const container = document.getElementById('documentsTableContainer');

        if (!data.success || !data.documents || data.documents.length === 0) {
            container.innerHTML = '<p style="color:#a0aec0; text-align:center; padding:20px;">No documents uploaded for you yet</p>';
            return;
        }

        const documents = data.documents;

        let tableHTML = `
            <table class="accepted-papers-table">
                <thead>
                    <tr>
                        <th>Document Name</th>
                        <th>File Size</th>
                        <th>Uploaded Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        documents.forEach(doc => {
            const uploadDate = new Date(doc.uploadedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const fileSizeKB = (doc.fileSize / 1024).toFixed(2);

            tableHTML += `
                <tr>
                    <td><i class="fas fa-file"></i> ${doc.fileName}</td>
                    <td>${fileSizeKB} KB</td>
                    <td>${uploadDate}</td>
                    <td>
                        <a href="${doc.fileUrl}" target="_blank" class="btn-primary" style="display: inline-block; padding: 6px 12px; text-decoration: none; font-size: 12px;">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    } catch (error) {
        console.error('Error loading documents:', error);
        document.getElementById('documentsTableContainer').innerHTML = '<p style="color:red; padding:20px; text-align:center;">Error loading documents</p>';
    }
}

const DOCUMENTS_CACHE_TTL_MS = 60000;
let sharedDocumentsCache = {
    fetchedAt: 0,
    data: null
};

async function fetchSharedDocuments(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && sharedDocumentsCache.data && (now - sharedDocumentsCache.fetchedAt) < DOCUMENTS_CACHE_TTL_MS) {
        return sharedDocumentsCache.data;
    }

    const response = await fetch('/documents/shared');
    const data = await response.json();
    sharedDocumentsCache = {
        fetchedAt: now,
        data
    };

    return data;
}

function logoutAuthor() {
    if (confirm('Are you sure you want to logout?')) {
        clearSession();
        window.location.href = 'index.html';
    }
}

// Documents Modal Functions
function openDocumentsModal() {
    const modal = document.getElementById('documentsModal');
    modal.classList.add('show');
    loadDocumentsInModal();
}

function closeDocumentsModal() {
    const modal = document.getElementById('documentsModal');
    modal.classList.remove('show');
}

// Close modal when clicking outside the content
window.addEventListener('click', function(event) {
    const modal = document.getElementById('documentsModal');
    if (event.target === modal) {
        closeDocumentsModal();
    }
});

async function loadDocumentsInModal() {
    try {
        const data = await fetchSharedDocuments();

        const container = document.getElementById('documentsListContainer');

        if (!data.success || !data.documents || data.documents.length === 0) {
            container.innerHTML = `
                <div class="documents-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No documents uploaded for you yet</p>
                </div>
            `;
            return;
        }

        const documents = data.documents;
        let html = '<div class="documents-list">';

        documents.forEach(doc => {
            const uploadDate = new Date(doc.uploadedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const fileSizeKB = (doc.fileSize / 1024).toFixed(2);

            html += `
                <div class="document-item">
                    <div class="document-info">
                        <div class="document-icon">
                            <i class="fas fa-file-pdf"></i>
                        </div>
                        <div class="document-details">
                            <div class="document-name">${doc.fileName}</div>
                            <div class="document-meta">${fileSizeKB} KB • ${uploadDate}</div>
                        </div>
                    </div>
                    <a href="${doc.fileUrl}" target="_blank" download class="document-download">
                        <i class="fas fa-download"></i> Download
                    </a>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading documents:', error);
        document.getElementById('documentsListContainer').innerHTML = `
            <div class="documents-empty">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading documents</p>
            </div>
        `;
    }
}

// Session Management Functions
function getSession() {
    try {
        const session = sessionStorage.getItem('ieee_session');
        if (session) {
            return JSON.parse(session);
        }
        return null;
    } catch (e) {
        console.error('Error reading session:', e);
        return null;
    }
}

function clearSession() {
    sessionStorage.removeItem('ieee_session');
    localStorage.removeItem('ieee_session');
}
