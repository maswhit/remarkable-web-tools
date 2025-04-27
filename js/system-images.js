// System Images tab variables
let systemImagesGrid;
let refreshSystemImagesBtn;
let imagePreviewModal;
let previewImage;
let previewImageName;
let replacementSelect;
let replaceImageBtn;
let modalClose;

// Initialize the system images tab functionality
function initSystemImagesTab() {
    // Get DOM elements after the tab content is loaded
    systemImagesGrid = document.getElementById('system-images-grid');
    refreshSystemImagesBtn = document.getElementById('refresh-system-images');
    imagePreviewModal = document.getElementById('image-preview-modal');
    previewImage = document.getElementById('preview-image');
    previewImageName = document.getElementById('preview-image-name');
    replacementSelect = document.getElementById('replacement-select');
    replaceImageBtn = document.getElementById('replace-image-btn');
    modalClose = document.querySelector('.modal-close');
    
    // Set up event listeners
    setupSystemImagesListeners();
    
    // Load system images if connected
    if (document.getElementById('connection-indicator').classList.contains('connected')) {
        loadSystemImages();
    } else {
        showConnectionRequired();
    }
    
    // Load local templates for replacement dropdown
    loadLocalTemplatesForReplacement();
    
    // Listen for connection events
    document.addEventListener('remarkableConnected', handleRemarkableConnected);
    document.addEventListener('remarkableDisconnected', handleRemarkableDisconnected);
}

// Set up event listeners for system images tab
function setupSystemImagesListeners() {
    if (refreshSystemImagesBtn) {
        refreshSystemImagesBtn.addEventListener('click', loadSystemImages);
    }
    
    // Modal close button
    if (modalClose) {
        modalClose.addEventListener('click', closeImagePreviewModal);
    }
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === imagePreviewModal) {
            closeImagePreviewModal();
        }
    });
    
    // Replacement select dropdown change
    if (replacementSelect) {
        replacementSelect.addEventListener('change', function() {
            replaceImageBtn.disabled = !this.value;
        });
    }
    
    // Replace image button
    if (replaceImageBtn) {
        replaceImageBtn.addEventListener('click', handleReplaceImage);
    }
}

// Handle reMarkable connected event
function handleRemarkableConnected() {
    loadSystemImages();
}

// Handle reMarkable disconnected event
function handleRemarkableDisconnected() {
    showConnectionRequired();
}

// Show message that connection is required
function showConnectionRequired() {
    if (systemImagesGrid) {
        systemImagesGrid.innerHTML = `
            <div class="system-image-item">
                <h3>Connection Required</h3>
                <p>Please connect to your reMarkable device to view system images.</p>
            </div>
        `;
    }
}

// Load system images from the device
function loadSystemImages() {
    if (!systemImagesGrid) return;
    
    systemImagesGrid.innerHTML = `
        <div class="system-image-item">
            <h3>Loading system images...</h3>
            <p>Please wait while we fetch images from your device.</p>
        </div>
    `;
    
    log('Fetching system images from /usr/share/remarkable...', 'info');
    
    fetch('uploader.php?action=get_system_images')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                renderSystemImages(data.images);
                log('System images loaded successfully', 'success');
            } else {
                systemImagesGrid.innerHTML = `
                    <div class="system-image-item">
                        <h3>Error Loading Images</h3>
                        <p>${data.message}</p>
                    </div>
                `;
                log(`Failed to load system images: ${data.message}`, 'error');
            }
        })
        .catch(error => {
            systemImagesGrid.innerHTML = `
                <div class="system-image-item">
                    <h3>Error</h3>
                    <p>Could not load system images: ${error.message}</p>
                </div>
            `;
            log(`Error loading system images: ${error.message}`, 'error');
        });
}

// Render system images in the grid
function renderSystemImages(images) {
    if (!systemImagesGrid) return;
    
    if (!images || images.length === 0) {
        systemImagesGrid.innerHTML = `
            <div class="system-image-item">
                <h3>No PNG Images Found</h3>
                <p>No PNG images were found in the /usr/share/remarkable directory.</p>
            </div>
        `;
        return;
    }
    
    systemImagesGrid.innerHTML = '';
    images.forEach(image => {
        const imageItem = document.createElement('div');
        imageItem.className = 'system-image-item';
        imageItem.setAttribute('data-path', image.path);
        imageItem.setAttribute('data-filename', image.filename);
        
        imageItem.innerHTML = `
            <img src="uploader.php?action=get_system_image_thumbnail&path=${encodeURIComponent(image.path)}" 
                 alt="${image.filename}" class="system-image-thumbnail">
            <h3>${image.filename}</h3>
            <p>Size: ${formatFileSize(image.size)}</p>
            <!--<p>Path: ${image.path}</p>-->
        `;
        
        // Add click event to open preview
        imageItem.addEventListener('click', () => {
            openImagePreview(image);
        });
        
        systemImagesGrid.appendChild(imageItem);
    });
}

// Format file size in a human-readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Open image preview modal
function openImagePreview(image) {
    if (!imagePreviewModal || !previewImage || !previewImageName) return;
    
    // Set modal content
    previewImageName.textContent = `Image Preview: ${image.filename}`;
    previewImage.src = `uploader.php?action=get_system_image_full&path=${encodeURIComponent(image.path)}`;
    
    // Store the current image path on the replace button for later use
    replaceImageBtn.setAttribute('data-target-path', image.path);
    replaceImageBtn.setAttribute('data-target-filename', image.filename);
    
    // Show the modal
    imagePreviewModal.style.display = 'block';
}

// Close image preview modal
function closeImagePreviewModal() {
    if (!imagePreviewModal) return;
    
    imagePreviewModal.style.display = 'none';
    previewImage.src = '';
}

// Load local templates for the replacement dropdown
function loadLocalTemplatesForReplacement() {
    if (!replacementSelect) return;
    
    fetch('uploader.php?action=get_local_templates')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.templates && data.templates.length > 0) {
                // Clear the dropdown (except the first placeholder option)
                while (replacementSelect.options.length > 1) {
                    replacementSelect.remove(1);
                }
                
                // Add templates to dropdown
                data.templates.forEach(template => {
                    const option = document.createElement('option');
                    option.value = template.filename;
                    option.textContent = template.name;
                    replacementSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            log(`Error loading templates for replacement: ${error.message}`, 'error');
        });
}

// Handle the replace image action
function handleReplaceImage() {
    const selectedTemplate = replacementSelect.value;
    if (!selectedTemplate) {
        log('Please select a template to use as replacement', 'error');
        return;
    }
    
    const targetPath = replaceImageBtn.getAttribute('data-target-path');
    const targetFilename = replaceImageBtn.getAttribute('data-target-filename');
    
    if (!targetPath || !targetFilename) {
        log('Missing target information', 'error');
        return;
    }
    
    log(`Replacing system image "${targetFilename}" with template "${selectedTemplate}"...`, 'info');
    
    const formData = new FormData();
    formData.append('action', 'replace_system_image');
    formData.append('target_path', targetPath);
    formData.append('replacement_filename', selectedTemplate);
    
    fetch('uploader.php', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            log(`System image "${targetFilename}" replaced successfully!`, 'success');
            closeImagePreviewModal();
            // Reload system images to show the updated image
            loadSystemImages();
        } else {
            log(`Failed to replace system image: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        log(`Error replacing system image: ${error.message}`, 'error');
    });
}

// Export functions to make them available to the main.js
window.initSystemImagesTab = initSystemImagesTab;