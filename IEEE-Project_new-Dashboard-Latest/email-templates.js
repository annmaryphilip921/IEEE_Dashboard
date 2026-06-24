// Email Templates Management Functions - Append to dashboard.js

// Load Email Templates Content
async function loadEmailTemplatesContent() {
    const content = document.querySelector('.content');
    
    content.innerHTML = `
        <div class="page-header">
            <div class="header-left">
                <h1><i class="fas fa-envelope"></i> Email Templates Management</h1>
                <p>Customize email templates for invitations, reminders, and communications</p>
            </div>
        </div>
        
        <div class="templates-container">
            <div class="templates-tabs">
                <button class="template-tab-btn active" onclick="selectTemplateTab('invitation', event)">
                    <i class="fas fa-inbox"></i> Invitation Email
                </button>
                <button class="template-tab-btn" onclick="selectTemplateTab('first-reminder', event)">
                    <i class="fas fa-bell"></i> First Reminder
                </button>
                <button class="template-tab-btn" onclick="selectTemplateTab('second-reminder', event)">
                    <i class="fas fa-exclamation-circle"></i> Final Reminder
                </button>
            </div>
            
            <div class="template-editor-container" id="templateEditorContainer">
                <!-- Template editor will be loaded here -->
            </div>
        </div>
    `;
    
    // Load first template by default
    await loadEmailTemplate('invitation');
}

async function selectTemplateTab(templateType, event) {
    event.preventDefault();
    
    // Update active button
    document.querySelectorAll('.template-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.template-tab-btn').classList.add('active');
    
    // Load the template
    await loadEmailTemplate(templateType);
}

async function loadEmailTemplate(templateType) {
    try {
        const response = await fetch(`/admin/email-templates/${templateType}`);
        const result = await response.json();
        
        if (!result.success) {
            showNotification(`Failed to load ${templateType} template.`, 'error');
            return;
        }
        
        const template = result.template;
        const container = document.getElementById('templateEditorContainer');
        
        const templateNames = {
            'invitation': 'Invitation Email',
            'first-reminder': 'First Draft Reminder Email',
            'second-reminder': 'Final Reminder Email'
        };
        
        const placeholders = {
            'invitation': [
                '{AUTHOR_FIRST_NAME}', '{PAPER_TITLE}', '{PAPER_ID}', '{USERNAME}', '{PASSWORD}', '{ALL_PAPERS_TABLE}'
            ],
            'first-reminder': [
                '{AUTHOR_FIRST_NAME}', '{PAPER_TITLE}'
            ],
            'second-reminder': [
                '{AUTHOR_FIRST_NAME}', '{PAPER_TITLE}'
            ]
        };
        
        const placeholdersList = (placeholders[templateType] || []).map(p => 
            `<span class="placeholder-tag" onclick="insertPlaceholder('${p}')">${p}</span>`
        ).join(' ');
        
        container.innerHTML = `
            <div class="template-editor-section">
                <div class="editor-header">
                    <h2>${templateNames[templateType]}</h2>
                    <p>Edit the subject and body of this email template. Use available placeholders to personalize messages.</p>
                </div>
                
                <div class="editor-body">
                    <!-- Subject Section -->
                    <div class="form-group">
                        <label for="templateSubject">Email Subject <span style="color: #e53e3e;">*</span></label>
                        <input type="text" 
                               id="templateSubject" 
                               class="form-control" 
                               placeholder="Enter email subject..."
                               value="${template.subject}"
                               maxlength="200">
                        <small style="color: #718096; margin-top: 5px;">Characters remaining: <span id="subjectCounter">200</span></small>
                    </div>
                    
                    <!-- Body Section -->
                    <div class="form-group">
                        <label for="templateBody">Email Body (HTML) <span style="color: #e53e3e;">*</span></label>
                        <div style="margin-bottom: 10px; padding: 12px; background: #f7fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #2d3748;">Available Placeholders:</p>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${placeholdersList}
                            </div>
                        </div>
                        <div class="template-editor-shell">
                            <div class="template-editor-toolbar" id="templateEditorToolbar">
                                <select id="editorFontFamily" class="editor-select" onchange="applyEditorFontFamily(this.value)">
                                    <option value="">Font</option>
                                    <option value="Arial">Arial</option>
                                    <option value="Verdana">Verdana</option>
                                    <option value="Georgia">Georgia</option>
                                    <option value="Times New Roman">Times New Roman</option>
                                    <option value="Tahoma">Tahoma</option>
                                    <option value="Trebuchet MS">Trebuchet MS</option>
                                </select>

                                <select id="editorFontSize" class="editor-select" onchange="applyEditorFontSize(this.value)">
                                    <option value="">Size</option>
                                    <option value="12px">12</option>
                                    <option value="14px">14</option>
                                    <option value="16px">16</option>
                                    <option value="18px">18</option>
                                    <option value="20px">20</option>
                                    <option value="24px">24</option>
                                    <option value="28px">28</option>
                                </select>

                                <label class="editor-color-wrap" title="Text color">
                                    <i class="fas fa-font"></i>
                                    <input type="color" id="editorTextColor" class="editor-color" value="#1f2937" onchange="applyEditorFontColor(this.value)">
                                </label>

                                <label class="editor-color-wrap" title="Highlight color">
                                    <i class="fas fa-highlighter"></i>
                                    <input type="color" id="editorHighlightColor" class="editor-color" value="#fff59d" onchange="applyEditorHighlightColor(this.value)">
                                </label>

                                <button type="button" class="editor-btn" onclick="applyEditorCommand('bold')" title="Bold"><i class="fas fa-bold"></i></button>
                                <button type="button" class="editor-btn" onclick="applyEditorCommand('italic')" title="Italic"><i class="fas fa-italic"></i></button>
                                <button type="button" class="editor-btn" onclick="applyEditorCommand('underline')" title="Underline"><i class="fas fa-underline"></i></button>
                                <button type="button" class="editor-btn" onclick="applyEditorCommand('strikeThrough')" title="Strikethrough"><i class="fas fa-strikethrough"></i></button>

                                <button type="button" class="editor-btn" onclick="applyEditorCommand('justifyLeft')" title="Align left"><i class="fas fa-align-left"></i></button>
                                <button type="button" class="editor-btn" onclick="applyEditorCommand('justifyCenter')" title="Align center"><i class="fas fa-align-center"></i></button>
                                <button type="button" class="editor-btn" onclick="applyEditorCommand('justifyRight')" title="Align right"><i class="fas fa-align-right"></i></button>

                                <button type="button" class="editor-btn" onclick="applyEditorCommand('insertUnorderedList')" title="Bulleted list"><i class="fas fa-list-ul"></i></button>
                                <button type="button" class="editor-btn" onclick="applyEditorCommand('insertOrderedList')" title="Numbered list"><i class="fas fa-list-ol"></i></button>

                                <button type="button" class="editor-btn" onclick="clearEditorFormatting()" title="Clear formatting"><i class="fas fa-eraser"></i></button>
                                <button type="button" class="editor-btn source-toggle-btn" onclick="toggleTemplateSourceView()" title="Toggle HTML source">HTML</button>
                            </div>

                            <div id="templateBodyEditor" class="template-rich-editor" contenteditable="true">${template.bodyHtml}</div>

                            <textarea id="templateBody"
                                      class="form-control template-editor-textarea source-hidden"
                                      placeholder="Enter HTML email body..."
                                      rows="12">${template.bodyHtml}</textarea>
                        </div>
                    </div>
                    
                    <!-- Preview Section -->
                    <div class="form-group">
                        <label>Email Preview</label>
                        <div class="email-preview-box" id="emailPreview">
                            ${template.bodyHtml}
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="template-actions">
                        <button class="btn-secondary" onclick="reloadEmailTemplate('${templateType}')">
                            <i class="fas fa-undo"></i> Reset Changes
                        </button>
                        <button class="btn-info" onclick="previewTemplate()">
                            <i class="fas fa-eye"></i> Refresh Preview
                        </button>
                        <button class="btn-success" onclick="saveEmailTemplateEditor('${templateType}')">
                            <i class="fas fa-save"></i> Save Template
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        setupTemplateEditorEvents();
        
    } catch (error) {
        console.error('Error loading template:', error);
        showNotification('Failed to load email template.', 'error');
    }
}

function setupTemplateEditorEvents() {
    const subjectInput = document.getElementById('templateSubject');
    const editor = document.getElementById('templateBodyEditor');
    const bodyTextarea = document.getElementById('templateBody');
    
    if (subjectInput) {
        subjectInput.addEventListener('input', function() {
            const remaining = 200 - this.value.length;
            document.getElementById('subjectCounter').textContent = Math.max(0, remaining);
        });

        const remaining = 200 - (subjectInput.value || '').length;
        document.getElementById('subjectCounter').textContent = Math.max(0, remaining);
    }

    if (editor) {
        editor.addEventListener('input', function() {
            syncEditorToSource();
            previewTemplate();
        });

        editor.addEventListener('paste', function(event) {
            event.preventDefault();
            const text = (event.clipboardData || window.clipboardData).getData('text/plain');
            applyEditorCommand('insertText', text);
        });
    }
    
    if (bodyTextarea) {
        bodyTextarea.addEventListener('input', function() {
            if (bodyTextarea.classList.contains('source-visible')) {
                syncSourceToEditor();
            }
            previewTemplate();
        });
    }

    syncEditorToSource();
    previewTemplate();
}

function insertPlaceholder(placeholder) {
    const editor = document.getElementById('templateBodyEditor');
    const bodyTextarea = document.getElementById('templateBody');

    if (editor && (!bodyTextarea || !bodyTextarea.classList.contains('source-visible'))) {
        applyEditorCommand('insertText', placeholder);
        return;
    }

    if (bodyTextarea) {
        const start = bodyTextarea.selectionStart;
        const end = bodyTextarea.selectionEnd;
        const text = bodyTextarea.value;
        bodyTextarea.value = text.substring(0, start) + placeholder + text.substring(end);
        bodyTextarea.focus();
        bodyTextarea.selectionStart = start + placeholder.length;
        bodyTextarea.selectionEnd = start + placeholder.length;

        if (editor) {
            syncSourceToEditor();
        }
        previewTemplate();
    }
}

function previewTemplate() {
    const bodyHtml = getTemplateBodyHtml();
    const preview = document.getElementById('emailPreview');
    if (preview) {
        preview.innerHTML = bodyHtml || '<p style="color: #a0aec0;">Preview will appear here...</p>';
    }
}

function getTemplateBodyHtml() {
    const editor = document.getElementById('templateBodyEditor');
    const bodyTextarea = document.getElementById('templateBody');

    if (bodyTextarea && bodyTextarea.classList.contains('source-visible')) {
        return bodyTextarea.value || '';
    }

    if (editor) {
        return editor.innerHTML || '';
    }

    return bodyTextarea ? bodyTextarea.value || '' : '';
}

function syncEditorToSource() {
    const editor = document.getElementById('templateBodyEditor');
    const bodyTextarea = document.getElementById('templateBody');
    if (!editor || !bodyTextarea) return;
    bodyTextarea.value = editor.innerHTML || '';
}

function syncSourceToEditor() {
    const editor = document.getElementById('templateBodyEditor');
    const bodyTextarea = document.getElementById('templateBody');
    if (!editor || !bodyTextarea) return;
    editor.innerHTML = bodyTextarea.value || '';
}

function ensureEditorFocus() {
    const editor = document.getElementById('templateBodyEditor');
    if (!editor) return null;

    editor.focus();
    const selection = window.getSelection();
    if (!selection) return editor;

    if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    return editor;
}

function applyEditorCommand(command, value = null) {
    const editor = ensureEditorFocus();
    if (!editor) return;

    try {
        document.execCommand('styleWithCSS', false, true);
    } catch (_error) {
        // Older browsers may not support styleWithCSS.
    }

    document.execCommand(command, false, value);
    syncEditorToSource();
    previewTemplate();
}

function applyEditorInlineStyle(styleProperty, styleValue) {
    const editor = ensureEditorFocus();
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
        const selectedContent = range.extractContents();
        span.appendChild(selectedContent);
        range.insertNode(span);

        const nextRange = document.createRange();
        nextRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(nextRange);
    }

    syncEditorToSource();
    previewTemplate();
}

function applyEditorFontFamily(fontFamily) {
    if (!fontFamily) return;
    applyEditorCommand('fontName', fontFamily);
}

function applyEditorFontSize(fontSize) {
    if (!fontSize) return;
    applyEditorInlineStyle('fontSize', fontSize);
}

function applyEditorFontColor(color) {
    if (!color) return;
    applyEditorCommand('foreColor', color);
}

function applyEditorHighlightColor(color) {
    if (!color) return;
    applyEditorCommand('hiliteColor', color);
}

function clearEditorFormatting() {
    applyEditorCommand('removeFormat');
}

function toggleTemplateSourceView() {
    const editor = document.getElementById('templateBodyEditor');
    const bodyTextarea = document.getElementById('templateBody');
    if (!editor || !bodyTextarea) return;

    const isSourceVisible = bodyTextarea.classList.contains('source-visible');

    if (isSourceVisible) {
        syncSourceToEditor();
        bodyTextarea.classList.remove('source-visible');
        bodyTextarea.classList.add('source-hidden');
        editor.style.display = 'block';
        ensureEditorFocus();
    } else {
        syncEditorToSource();
        editor.style.display = 'none';
        bodyTextarea.classList.remove('source-hidden');
        bodyTextarea.classList.add('source-visible');
        bodyTextarea.focus();
    }

    previewTemplate();
}

async function saveEmailTemplateEditor(templateType) {
    const subject = document.getElementById('templateSubject')?.value;
    const bodyHtml = getTemplateBodyHtml();
    
    if (!subject || !bodyHtml) {
        showNotification('Please fill in all required fields.', 'error');
        return;
    }
    
    try {
        const plainTextContainer = document.createElement('div');
        plainTextContainer.innerHTML = bodyHtml;
        const bodyPlain = (plainTextContainer.textContent || plainTextContainer.innerText || '').trim();

        const response = await fetch(`/admin/email-templates/${templateType}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: subject,
                bodyHtml: bodyHtml,
                bodyPlain: bodyPlain
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Email template saved successfully!', 'success');
            await loadEmailTemplate(templateType);
        } else {
            showNotification(result.message || 'Failed to save template.', 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('Failed to save email template.', 'error');
    }
}

async function reloadEmailTemplate(templateType) {
    if (confirm('Are you sure you want to discard changes? This cannot be undone.')) {
        await loadEmailTemplate(templateType);
    }
}

// Add CSS for email templates
const emailTemplateStyles = `
.templates-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    overflow: hidden;
}

.templates-tabs {
    display: flex;
    gap: 2px;
    padding: 10px;
    background: #f7fafc;
    border-bottom: 2px solid #e2e8f0;
}

.template-tab-btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    background: white;
    color: #4a5568;
    font-weight: 600;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
}

.template-tab-btn:hover {
    background: #edf2f7;
}

.template-tab-btn.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.template-editor-container {
    padding: 30px;
}

.template-editor-section {
    max-width: 1000px;
    margin: 0 auto;
}

.editor-header {
    margin-bottom: 30px;
}

.editor-header h2 {
    color: #1a202c;
    margin: 0 0 8px 0;
    font-size: 1.8em;
}

.editor-header p {
    color: #718096;
    margin: 0;
}

.form-group {
    margin-bottom: 25px;
}

.form-group label {
    display: block;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 8px;
    font-size: 1em;
}

.form-control {
    width: 100%;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    transition: border-color 0.2s;
}

.form-control:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.template-editor-textarea {
    font-family: 'Courier New', monospace;
    resize: vertical;
    min-height: 300px;
}

.template-editor-shell {
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
}

.template-editor-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}

.editor-select {
    border: 1px solid #cbd5e0;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    background: white;
    color: #2d3748;
}

.editor-btn {
    border: 1px solid #cbd5e0;
    background: white;
    color: #2d3748;
    border-radius: 6px;
    height: 32px;
    min-width: 32px;
    padding: 0 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 13px;
}

.editor-btn:hover {
    border-color: #4299e1;
    color: #2b6cb0;
    background: #ebf8ff;
}

.source-toggle-btn {
    font-weight: 700;
    min-width: 44px;
}

.editor-color-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #cbd5e0;
    border-radius: 6px;
    padding: 4px 8px;
    background: white;
    color: #2d3748;
    height: 32px;
}

.editor-color {
    border: none;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    cursor: pointer;
}

.template-rich-editor {
    min-height: 300px;
    padding: 14px;
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #1f2937;
    overflow-y: auto;
}

.template-rich-editor:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px rgba(66, 153, 225, 0.2);
}

.template-editor-textarea.source-hidden {
    display: none;
}

.template-editor-textarea.source-visible {
    display: block;
    border: none;
    border-radius: 0;
    margin: 0;
    min-height: 300px;
}

.placeholder-tag {
    display: inline-block;
    background: #edf2f7;
    color: #4299e1;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid #cbd5e0;
    transition: all 0.2s;
}

.placeholder-tag:hover {
    background: #4299e1;
    color: white;
    border-color: #4299e1;
}

.email-preview-box {
    background: #f7fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    min-height: 200px;
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #2d3748;
}

.template-actions {
    display: flex;
    gap: 15px;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 2px solid #e2e8f0;
}

.btn-secondary, .btn-info, .btn-success {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    font-size: 14px;
}

.btn-secondary {
    background: #e2e8f0;
    color: #2d3748;
}

.btn-secondary:hover {
    background: #cbd5e0;
    transform: translateY(-2px);
}

.btn-info {
    background: #4299e1;
    color: white;
}

.btn-info:hover {
    background: #3182ce;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
}

.btn-success {
    background: linear-gradient(135deg, #48bb78, #38a169);
    color: white;
    flex: 1;
    justify-content: center;
}

.btn-success:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
}

@media (max-width: 768px) {
    .templates-tabs {
        flex-direction: column;
    }
    
    .template-editor-container {
        padding: 15px;
    }
    
    .template-actions {
        flex-direction: column;
    }
    
    .btn-success {
        flex: unset;
    }

    .template-editor-toolbar {
        gap: 6px;
    }

    .editor-select {
        flex: 1;
        min-width: 120px;
    }
}
`;

// Inject styles
if (!document.getElementById('emailTemplateStyles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'emailTemplateStyles';
    styleEl.textContent = emailTemplateStyles;
    document.head.appendChild(styleEl);
}
