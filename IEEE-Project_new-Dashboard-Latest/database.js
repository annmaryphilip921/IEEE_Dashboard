// Simple in-memory data for demo purposes.
// Admin authentication is now server-side only (RDS + bcrypt),
// so no admin credentials are stored in browser JavaScript.

// Author database for storing author information and credentials
// No default/pre-seeded authors. Authors are created manually by admins.
let defaultAuthors = [];

// Initialize empty authors array (will be populated from localStorage or default data)
let authors = [];

// Author ID counter for unique IDs
let authorIdCounter = 1001;

// Load authors from localStorage if available, otherwise use default data
function loadAuthorsFromStorage() {
    const storedAuthors = localStorage.getItem('ieee_authors');
    const storedCounter = localStorage.getItem('ieee_author_counter');
    
    if (storedAuthors && storedAuthors !== '[]') {
        try {
            const parsedAuthors = JSON.parse(storedAuthors);
            if (parsedAuthors && parsedAuthors.length > 0) {
                // Migrate old authors to new format
                authors = parsedAuthors.map(author => ({
                    ...author,
                    invitationStatus: author.invitationStatus || 'pending',
                    firstLoginCompleted: author.firstLoginCompleted || false
                }));
                console.log('Authors loaded from localStorage:', authors.length, 'authors');
                
                // Verify the data integrity
                authors.forEach(author => {
                    console.log('- Loaded author:', author.firstName, author.lastName, '(ID:', author.id + ')');
                });
            } else {
                console.log('No valid authors in localStorage, using default data');
                authors = [...defaultAuthors]; // Use spread operator to create a copy
            }
        } catch (e) {
            console.error('Error loading authors from localStorage:', e);
            console.log('Using default authors due to parsing error');
            authors = [...defaultAuthors]; // Use spread operator to create a copy
        }
    } else {
        console.log('No authors found in localStorage, using default data');
        authors = [...defaultAuthors]; // Use spread operator to create a copy
    }
    
    if (storedCounter) {
        try {
            const parsedCounter = parseInt(storedCounter);
            if (!isNaN(parsedCounter) && parsedCounter > 0) {
                authorIdCounter = parsedCounter;
                console.log('Author counter loaded from localStorage:', authorIdCounter);
            }
        } catch (e) {
            console.error('Error loading author counter from localStorage:', e);
        }
    }
    
    // Ensure counter is always higher than existing author IDs
    if (authors.length > 0) {
        const maxId = Math.max(...authors.map(author => author.id));
        if (authorIdCounter <= maxId) {
            authorIdCounter = maxId + 1;
            console.log('Counter adjusted to:', authorIdCounter);
        }
    }

    // Keep debug globals aligned with latest array reference.
    if (typeof window !== 'undefined') {
        window.authors = authors;
        window.authorIdCounter = authorIdCounter;
    }
}

// Save authors to localStorage
function saveAuthorsToStorage() {
    try {
        localStorage.setItem('ieee_authors', JSON.stringify(authors));
        localStorage.setItem('ieee_author_counter', authorIdCounter.toString());
        console.log('Authors saved to localStorage:', authors.length, 'authors');
        console.log('Counter saved:', authorIdCounter);
        
        // Verify save was successful
        const verification = localStorage.getItem('ieee_authors');
        if (verification) {
            const verifyParsed = JSON.parse(verification);
            console.log('Save verified. localStorage now contains', verifyParsed.length, 'authors');
        }

        if (typeof window !== 'undefined') {
            window.authors = authors;
            window.authorIdCounter = authorIdCounter;
        }
    } catch (e) {
        console.error('Error saving authors to localStorage:', e);
        console.error('localStorage might be full or disabled');
    }
}

// Function to clear localStorage (for testing/debugging)
function clearAuthorsStorage() {
    try {
        localStorage.removeItem('ieee_authors');
        localStorage.removeItem('ieee_author_counter');
        authors = [];
        authorIdCounter = 1001;
        if (typeof window !== 'undefined') {
            window.authors = authors;
            window.authorIdCounter = authorIdCounter;
        }
        console.log('Authors storage cleared');
    } catch (e) {
        console.error('Error clearing authors storage:', e);
    }
}

// Function to reset to default data
function resetToDefaultData() {
    authors = [...defaultAuthors];
    authorIdCounter = 1001;
    saveAuthorsToStorage();
    console.log('Reset to default data with', authors.length, 'authors');
}

// Load authors on page load
loadAuthorsFromStorage();

// Function to generate random password
function generateRandomPassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Function to generate user ID
function generateUserId(firstName, lastName) {
    const prefix = (firstName.substring(0, 2) + lastName.substring(0, 2)).toLowerCase();
    const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return prefix + suffix;
}

// Function to create new author
function createAuthor(authorData) {
    const userId = generateUserId(authorData.firstName, authorData.lastName);
    const password = generateRandomPassword();
    
    const newAuthor = {
        id: authorIdCounter++,
        userId: userId,
        password: password,
        firstName: authorData.firstName,
        lastName: authorData.lastName,
        email: authorData.email,
        phone: authorData.phone,
        company: authorData.company,
        paperTitle: authorData.paperTitle,
        abstractInfo: authorData.abstractInfo,
        paperId: authorData.paperId,
        createdAt: new Date().toISOString(),
        status: 'active',
        invitationStatus: 'pending', // pending, accepted, declined
        firstLoginCompleted: false,
        progress: {
            currentStage: "logins-created",
            stages: {
                "logins-created": { status: "completed", completedAt: new Date().toISOString(), notes: "Account created successfully" },
                "invitation-send": { status: "pending", completedAt: null, notes: "" },
                "first-draft-reminder": { status: "pending", completedAt: null, notes: "" },
                "paper-submission": { status: "pending", completedAt: null, notes: "" },
                "review-in-progress": { status: "pending", completedAt: null, notes: "" }
            },
            lastUpdated: new Date().toISOString()
        }
    };
    
    authors.push(newAuthor);
    saveAuthorsToStorage(); // Save to localStorage
    return newAuthor;
}

// Function to safely update author data without losing password
function updateAuthorSafely(email, updateData) {
    const authors = getAllAuthors();
    const authorIndex = authors.findIndex(a => a.email === email);
    
    if (authorIndex !== -1) {
        // Preserve sensitive data while updating
        const originalAuthor = authors[authorIndex];
        const updatedAuthor = {
            ...originalAuthor,      // Keep all original data
            ...updateData,          // Apply updates
            password: originalAuthor.password,  // Explicitly preserve password
            userId: originalAuthor.userId,      // Explicitly preserve userId
            id: originalAuthor.id               // Explicitly preserve ID
        };
        
        // Update in the main authors array
        authors[authorIndex] = updatedAuthor;
        
        // Save to localStorage
        saveAuthorsToStorage();
        
        return updatedAuthor;
    }
    
    return null;
}

// Function to update author progress
function updateAuthorProgress(authorId, stage, status, notes = "") {
    const author = authors.find(a => a.id === authorId);
    if (author && author.progress.stages[stage]) {
        author.progress.stages[stage] = {
            status: status,
            completedAt: status === 'completed' ? new Date().toISOString() : null,
            notes: notes
        };
        
        // Update current stage if completed
        if (status === 'completed') {
            author.progress.currentStage = stage;
        }
        
        author.progress.lastUpdated = new Date().toISOString();
        saveAuthorsToStorage(); // Save to localStorage
        return true;
    }
    return false;
}

// Function to get authors by stage
function getAuthorsByStage(stage) {
    return authors.filter(author => author.progress.currentStage === stage);
}

// Function to get author progress summary
function getProgressSummary() {
    const stages = ["logins-created", "invitation-send", "first-draft-reminder", "paper-submission", "review-in-progress"];
    const summary = {};
    
    stages.forEach(stage => {
        summary[stage] = {
            completed: authors.filter(a => a.progress.stages[stage].status === 'completed').length,
            pending: authors.filter(a => a.progress.stages[stage].status === 'pending').length,
            inProgress: authors.filter(a => a.progress.stages[stage].status === 'in-progress').length
        };
    });
    
    return summary;
}

// Function to get all authors
function getAllAuthors() {
    return authors;
}

// Function to find author by userId
function findAuthorByUserId(userId) {
    return authors.find(author => author.userId === userId);
}

// Function to update invitation status
function updateInvitationStatus(userId, status, firstLogin = false) {
    const author = authors.find(author => author.userId === userId);
    if (author) {
        author.invitationStatus = status;
        if (firstLogin) {
            author.firstLoginCompleted = true;
        }
        saveAuthorsToStorage();
        return true;
    }
    return false;
}

// Make functions globally available
window.authors = authors;
window.authorIdCounter = authorIdCounter;
window.generateRandomPassword = generateRandomPassword;
window.generateUserId = generateUserId;
window.createAuthor = createAuthor;
window.updateAuthorSafely = updateAuthorSafely;
window.getAllAuthors = getAllAuthors;
window.findAuthorByUserId = findAuthorByUserId;
window.updateInvitationStatus = updateInvitationStatus;
window.updateAuthorProgress = updateAuthorProgress;
window.getAuthorsByStage = getAuthorsByStage;
window.getProgressSummary = getProgressSummary;

// Diagnostic function to check user data integrity
function checkUserDataIntegrity() {
    console.log('=== USER DATA INTEGRITY CHECK ===');
    console.log('Total authors:', authors.length);
    
    authors.forEach((author, index) => {
        console.log(`
Author ${index + 1}:`);
        console.log('- Name:', author.firstName, author.lastName);
        console.log('- User ID:', author.userId);
        console.log('- Password:', author.password ? '[SET]' : '[MISSING]');
        console.log('- Email:', author.email);
        
        if (!author.password) {
            console.warn('⚠️ Password missing for', author.firstName, author.lastName);
        }
    });
}

// Function to fix user with missing password
function fixUserPassword(userId, newPassword = null) {
    const author = authors.find(a => a.userId === userId);
    if (author) {
        if (!newPassword) {
            newPassword = generateRandomPassword();
        }
        author.password = newPassword;
        saveAuthorsToStorage();
        console.log(`Password updated for ${author.firstName} ${author.lastName}:`, newPassword);
        return { success: true, password: newPassword };
    }
    return { success: false, message: 'User not found' };
}

// Function to create sample submission for testing
function createSampleSubmission(userEmail, paperTitle = "Transformer Aging Study") {
    const submission = {
        id: Date.now(),
        fileName: "transformer_aging_study.pdf",
        fileSize: 2048000, // 2MB
        comments: "Initial submission for review",
        submittedAt: "2025-12-01T10:00:00.000Z", // Dec 1, 2025 as shown in the image
        status: 'submitted',
        type: 'first-draft'
    };
    
    // Add to user's submissions
    let submissions = JSON.parse(localStorage.getItem(`submissions_${userEmail}`) || '[]');
    // Remove any existing first-draft submission to avoid duplicates
    submissions = submissions.filter(sub => sub.type !== 'first-draft');
    submissions.push(submission);
    localStorage.setItem(`submissions_${userEmail}`, JSON.stringify(submissions));
    
    console.log(`Sample submission created for ${userEmail}:`, submission);
    return submission;
}

// Comprehensive user cleanup function for complete data removal
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
            localStorage.removeItem(`chat_${userEmail}`);
            localStorage.removeItem(`chat_${userEmail}_admin`);
            localStorage.removeItem(`chat_${userId}`);
            localStorage.removeItem(`chat_${userId}_admin`);
            localStorage.removeItem(`chat_messages_${userEmail}`);
            localStorage.removeItem(`chat_messages_${userId}`);
            
            cleanupResults.cleanedItems.push('chat_data');
            console.log(`✅ Removed chat data for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove chat data: ${error.message}`);
        }
        
        // 3. Clean up progress and reminder data
        try {
            localStorage.removeItem(`progress_${userEmail}`);
            localStorage.removeItem(`progress_${userId}`);
            localStorage.removeItem(`firstDraftRemindLater_${userEmail}`);
            localStorage.removeItem(`firstDraftPopupShown_${userEmail}`);
            cleanupResults.cleanedItems.push('progress_and_reminders');
            console.log(`✅ Removed progress and reminder data for ${userEmail}`);
        } catch (error) {
            cleanupResults.errors.push(`Failed to remove progress data: ${error.message}`);
        }
        
        // 4. Scan and remove any other user-related localStorage keys
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
        
    } catch (error) {
        cleanupResults.success = false;
        cleanupResults.errors.push(`General cleanup error: ${error.message}`);
        console.error(`❌ Critical error during cleanup:`, error);
    }
    
    return cleanupResults;
}

// Authentication functions
function authenticateUser(username, password) {
    // Legacy frontend helper retained only for author-side flows.
    // Admin login is handled by /login API on the server.
    const author = authors.find(author => 
        author.userId.toLowerCase() === username.toLowerCase() && 
        author.password === password
    );
    
    if (author) {
        // Update last login time (add if not exists)
        if (!author.lastLogin) {
            author.lastLogin = new Date().toISOString();
        } else {
            author.lastLogin = new Date().toISOString();
        }
        
        // Ensure new properties exist with defaults
        if (typeof author.invitationStatus === 'undefined') {
            author.invitationStatus = 'pending';
        }
        if (typeof author.firstLoginCompleted === 'undefined') {
            author.firstLoginCompleted = false;
        }
        
        // Save the updated author data to preserve login time
        saveAuthorsToStorage();
        
        // Return author data without password for security reasons
        // NOTE: The original author object in the array still has the password
        const { password: _, ...authorWithoutPassword } = author;
        return {
            success: true,
            user: { ...authorWithoutPassword, userType: 'author' },
            message: "Author login successful"
        };
    }
    
    return {
        success: false,
        user: null,
        message: "Invalid username or password"
    };
}

function getAllAdmins() {
    const session = getSession();
    if (session && session.user && session.user.userType === 'admin') {
        const { id, username, fullName, email, role } = session.user;
        return [{ id, username, fullName, email, role }];
    }
    return [];
}

function getUserById(id) {
    const session = getSession();
    const parsedId = parseInt(id);
    if (session && session.user && session.user.userType === 'admin' && session.user.id === parsedId) {
        const { id: userId, username, fullName, email, role } = session.user;
        return { id: userId, username, fullName, email, role };
    }
    return null;
}

// Session management (simple localStorage approach for demo)
function createSession(user) {
    const sessionData = {
        user: user,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    sessionStorage.setItem('adminSession', JSON.stringify(sessionData));
    localStorage.removeItem('adminSession');
    return sessionData;
}

function getSession() {
    try {
        const raw = sessionStorage.getItem('adminSession');
        if (!raw) {
            localStorage.removeItem('adminSession');
            return null;
        }

        const session = JSON.parse(raw);
        if (session && new Date(session.expiresAt) > new Date()) {
            return session;
        }
        // Session expired
        clearSession();
        return null;
    } catch (error) {
        return null;
    }
}

function clearSession() {
    sessionStorage.removeItem('adminSession');
    localStorage.removeItem('adminSession');
}

function isAuthenticated() {
    return getSession() !== null;
}

// Make functions available globally for browser console debugging
if (typeof window !== 'undefined') {
    window.authors = authors;
    window.createAuthor = createAuthor;
    window.updateAuthorProgress = updateAuthorProgress;
    window.getAuthorsByStage = getAuthorsByStage;
    window.getProgressSummary = getProgressSummary;
    window.saveAuthorsToStorage = saveAuthorsToStorage;
    window.loadAuthorsFromStorage = loadAuthorsFromStorage;
    window.clearAuthorsStorage = clearAuthorsStorage;
    window.resetToDefaultData = resetToDefaultData;
    window.checkUserDataIntegrity = checkUserDataIntegrity;
    window.fixUserPassword = fixUserPassword;
    window.generateRandomPassword = generateRandomPassword;
    window.authenticateUser = authenticateUser;
    window.createSampleSubmission = createSampleSubmission;
    window.performCompleteUserCleanup = performCompleteUserCleanup;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        authenticateUser,
        getAllAdmins,
        getUserById,
        createSession,
        getSession,
        clearSession,
        isAuthenticated,
        updateAuthorSafely
    };
}
