// PDF Uploads tab variables
let pdfUploadForm;
let uploadStatus;
let authFormContainer;
let authForm;
let pendingFile;
let dropArea;
let fileInput;

// Initialize the PDF uploads tab functionality
function initPdfUploadsTab() {
    // Get DOM elements after the tab content is loaded
    pdfUploadForm = document.getElementById('pdf-upload-form');
    uploadStatus = document.getElementById('upload-status');
    authFormContainer = document.getElementById('auth-form-container');
    authForm = document.getElementById('auth-form');
    dropArea = document.getElementById('drop-area');
    fileInput = document.getElementById('pdf-file');
    
    // Set up event listeners
    setupFileInputListener();
    setupDragAndDropListeners();
    setupAuthFormListener();
}

// Setup file input change listener for automatic upload
function setupFileInputListener() {
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                
                // Check if it's a PDF
                if (file.type !== 'application/pdf') {
                    log('Please select a PDF file', 'error');
                    return;
                }
                
                // Save file info for authentication if needed
                pendingFile = file;
                
                // Create form data and upload
                const formData = new FormData();
                formData.append('action', 'upload_pdf');
                formData.append('pdf_file', file);
                
                log(`Uploading PDF: ${file.name}`, 'info');
                
                // Add visual feedback
                dropArea.innerHTML = `
                    <div class="uploading-feedback">
                        <p>Uploading ${file.name}...</p>
                    </div>
                `;
                
                uploadPdf(formData);
            }
        });
    }
}

// Setup drag and drop listeners
function setupDragAndDropListeners() {
    if (dropArea) {
        // Prevent default behavior to enable drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });
        
        // Highlight drop area when file is dragged over
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });
        
        // Remove highlight when file is dragged out
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });
        
        // Handle dropped files
        dropArea.addEventListener('drop', handleDrop, false);
    }
}

// Prevent default behavior for drag and drop events
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop area
function highlight(e) {
    dropArea.classList.add('highlight');
}

// Remove highlight from drop area
function unhighlight(e) {
    dropArea.classList.remove('highlight');
}

// Handle dropped files
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        const file = files[0];
        
        // Check if it's a PDF
        if (file.type !== 'application/pdf') {
            log('Please drop a PDF file', 'error');
            resetDropArea();
            return;
        }
        
        // Save file info for authentication if needed
        pendingFile = file;
        
        // Create form data and upload
        const formData = new FormData();
        formData.append('action', 'upload_pdf');
        formData.append('pdf_file', file);
        
        log(`Uploading PDF: ${file.name}`, 'info');
        
        // Add visual feedback
        dropArea.innerHTML = `
            <div class="uploading-feedback">
                <p>Uploading ${file.name}...</p>
            </div>
        `;
        
        uploadPdf(formData);
    }
}

// Reset drop area to original state
function resetDropArea() {
    if (dropArea) {
        dropArea.innerHTML = `
            <form id="pdf-upload-form" enctype="multipart/form-data">
                <input type="file" id="pdf-file" name="pdf_file" accept=".pdf" class="file-input" required>
                <label for="pdf-file" class="file-label">
                    <div class="drop-message">
                        <i class="drop-icon">&#8595;</i>
                        <p>Drag & drop PDF here<br>or click to select</p>
                    </div>
                </label>
            </form>
        `;
        
        // Reinitialize input element and listeners
        pdfUploadForm = document.getElementById('pdf-upload-form');
        fileInput = document.getElementById('pdf-file');
        setupFileInputListener();
    }
}

// Setup authentication form listener
function setupAuthFormListener() {
    if (authForm) {
        authForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const oneTimeCode = document.getElementById('one-time-code').value.trim();
            if (!oneTimeCode || oneTimeCode.length !== 8) {
                log('Please enter a valid 8-character one-time code', 'error');
                return;
            }
            
            // Create form data with both the file and the code
            const formData = new FormData();
            formData.append('action', 'upload_pdf');
            formData.append('one_time_code', oneTimeCode);
            
            // If we have a pending file, add it (for cases where the session was lost)
            if (pendingFile) {
                formData.append('pdf_file', pendingFile);
            }
            
            // Disable the submit button and show loading state
            const authBtn = document.getElementById('auth-submit-btn');
            authBtn.disabled = true;
            authBtn.textContent = 'Authenticating...';
            
            log('Authenticating with reMarkable...', 'info');
            
            uploadPdf(formData, authBtn);
        });
    }
}

// Function to handle PDF upload with or without authentication
function uploadPdf(formData, authBtn = null) {
    fetch('uploader.php', {
        method: 'POST',
        body: formData
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(function(data) {
        // Reset auth button if present
        if (authBtn) {
            authBtn.disabled = false;
            authBtn.textContent = 'Authenticate and Upload';
        }
        
        if (data.success) {
            log(`PDF uploaded successfully to your reMarkable device!`, 'success');
            
            // Reset forms
            if (authForm) authForm.reset();
            
            // Hide auth form if visible
            if (authFormContainer) {
                authFormContainer.classList.add('hidden');
            }
            
            // Show success message
            if (uploadStatus) {
                uploadStatus.classList.remove('hidden');
                // Hide after 5 seconds
                setTimeout(() => {
                    uploadStatus.classList.add('hidden');
                }, 5000);
            }
            
            // Reset the drop area
            resetDropArea();
            
            // Clear pending file
            pendingFile = null;
            
        } else if (data.needs_auth) {
            log('Authentication required for reMarkable upload', 'info');
            
            // Show authentication form
            if (authFormContainer) {
                authFormContainer.classList.remove('hidden');
                // Focus the input field
                setTimeout(() => {
                    document.getElementById('one-time-code').focus();
                }, 100);
            }
            
        } else {
            log(`Upload failed: ${data.message}`, 'error');
            resetDropArea();
        }
    })
    .catch(function(error) {
        // Reset auth button if present
        if (authBtn) {
            authBtn.disabled = false;
            authBtn.textContent = 'Authenticate and Upload';
        }
        
        log(`Upload error: ${error.message}`, 'error');
        resetDropArea();
    });
}

// Export function to make it available to the main.js
window.initPdfUploadsTab = initPdfUploadsTab;