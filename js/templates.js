// Template tab variables (will be initialized when the tab loads)
let templateForm;
let localTemplatesGrid;
let deviceTemplatesGrid;
let refreshLocalBtn;
let refreshDeviceBtn;
let restartBtn;

initTemplatesTab();

// Initialize the templates tab functionality
function initTemplatesTab() {
    // Get DOM elements after the tab content is loaded
    templateForm = document.getElementById('template-form');
    restartBtn = document.getElementById('restart-btn');
    localTemplatesGrid = document.getElementById('local-templates-grid');
    deviceTemplatesGrid = document.getElementById('device-templates-grid');
    refreshLocalBtn = document.getElementById('refresh-local');
    refreshDeviceBtn = document.getElementById('refresh-device');
    
    // Set up event listeners
    setupTemplateFormListener();
    setupRestartBtnListener();
    setupRefreshButtons();
    
    // Load template data
    refreshTemplateData();
    
    // Set connection-dependent UI elements
    updateUIByConnectionStatus();
    
    // Listen for connection events
    document.addEventListener('remarkableConnected', handleRemarkableConnected);
    document.addEventListener('remarkableDisconnected', handleRemarkableDisconnected);
}

// Refresh all template data
function refreshTemplateData() {
    loadLocalLibrary();
    
    // Only load device library if connected
    if (document.getElementById('connection-indicator').classList.contains('connected')) {
        loadDeviceLibrary();
    }
}

// Handle reMarkable connected event
function handleRemarkableConnected() {
    if (restartBtn) restartBtn.disabled = false;
    
    // Enable device upload buttons
    document.querySelectorAll('.upload-to-device-btn').forEach(btn => {
        btn.disabled = false;
    });
    
    // Load device library
    loadDeviceLibrary();
}

// Handle reMarkable disconnected event
function handleRemarkableDisconnected() {
    if (restartBtn) restartBtn.disabled = true;
    
    // Disable device upload buttons
    document.querySelectorAll('.upload-to-device-btn').forEach(btn => {
        btn.disabled = true;
    });
    
    // Show empty state for device library
    if (deviceTemplatesGrid) {
        deviceTemplatesGrid.innerHTML = '<div class="template-item"><h3>Not connected to device</h3><p>Please connect to your reMarkable to view device templates.</p></div>';
    }
}

// Update UI elements based on connection status
function updateUIByConnectionStatus() {
    const isConnected = document.getElementById('connection-indicator').classList.contains('connected');
    
    if (restartBtn) {
        restartBtn.disabled = !isConnected;
    }
    
    if (!isConnected && deviceTemplatesGrid) {
        deviceTemplatesGrid.innerHTML = '<div class="template-item"><h3>Not connected to device</h3><p>Please connect to your reMarkable to view device templates.</p></div>';
    }
}

// Set up template form submission
function setupTemplateFormListener() {
    if (templateForm) {
        templateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(templateForm);
            formData.append('action', 'upload_template');
            
            const templateName = formData.get('template_name');
            log(`Uploading template: ${templateName} to local library`, 'info');
            
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
                if (data.success) {
                    log(`Template "${templateName}" uploaded to local library successfully!`, 'success');
                    
                    // Reset form
                    templateForm.reset();
                    
                    // Refresh local library
                    loadLocalLibrary();
                } else {
                    log(`Upload failed: ${data.message}`, 'error');
                }
            })
            .catch(function(error) {
                log(`Upload error: ${error.message}`, 'error');
            });
        });
    }
}

// Setup restart button listener
function setupRestartBtnListener() {
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (!confirm('Are you sure you want to restart your reMarkable?')) {
                return;
            }
            
            log('Restarting reMarkable...', 'info');
            restartBtn.disabled = true;
            
            fetch('uploader.php?action=restart_remarkable')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        log('Restart command sent. Your reMarkable will reboot now.', 'success');
                        setConnectionStatus('disconnected', 'Disconnected (reMarkable is restarting)');
                        restartBtn.disabled = true;
                        
                        // Wait for device to restart
                        setTimeout(() => {
                            log('Waiting for reMarkable to come back online...', 'info');
                            
                            // Try to reconnect after some time
                            setTimeout(() => {
                                checkConnection();
                            }, 20000); // Wait 20 seconds before trying to reconnect
                        }, 5000);
                    } else {
                        log(`Restart failed: ${data.message}`, 'error');
                        restartBtn.disabled = false;
                    }
                })
                .catch(error => {
                    log(`Restart error: ${error.message}`, 'error');
                    restartBtn.disabled = false;
                });
        });
    }
}

// Setup refresh buttons
function setupRefreshButtons() {
    if (refreshLocalBtn) {
        refreshLocalBtn.addEventListener('click', () => {
            loadLocalLibrary();
        });
    }
    
    if (refreshDeviceBtn) {
        refreshDeviceBtn.addEventListener('click', () => {
            loadDeviceLibrary();
        });
    }
}

// Load local library templates
function loadLocalLibrary() {
    if (!localTemplatesGrid) return;
    
    fetch('uploader.php?action=get_local_templates')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                renderLocalTemplates(data.templates);
                log('Local templates loaded successfully', 'success');
            } else {
                localTemplatesGrid.innerHTML = '<div class="template-item"><h3>No local templates</h3><p>Upload templates to build your local library.</p></div>';
                log(`Failed to load local templates: ${data.message}`, 'error');
            }
        })
        .catch(error => {
            localTemplatesGrid.innerHTML = '<div class="template-item"><h3>Error loading templates</h3><p>Could not load local templates.</p></div>';
            log(`Error loading local templates: ${error.message}`, 'error');
        });
}

// Load device library templates
function loadDeviceLibrary() {
    if (!deviceTemplatesGrid) return;
    
    fetch('uploader.php?action=get_device_templates')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                renderDeviceTemplates(data.templates);
                log('Device templates loaded successfully', 'success');
            } else {
                deviceTemplatesGrid.innerHTML = '<div class="template-item"><h3>No custom templates on device</h3><p>Upload templates to the device.</p></div>';
                log(`Failed to load device templates: ${data.message}`, 'info');
            }
        })
        .catch(error => {
            deviceTemplatesGrid.innerHTML = '<div class="template-item"><h3>Error loading templates</h3><p>Could not load device templates.</p></div>';
            log(`Error loading device templates: ${error.message}`, 'error');
        });
}

// Render local templates
function renderLocalTemplates(templates) {
    if (!localTemplatesGrid) return;
    
    if (!templates || templates.length === 0) {
        localTemplatesGrid.innerHTML = '<div class="template-item"><h3>No local templates</h3><p>Upload templates to build your local library.</p></div>';
        return;
    }
    
    localTemplatesGrid.innerHTML = '';
    templates.forEach(template => {
        const templateEl = document.createElement('div');
        templateEl.className = 'template-item';
        templateEl.innerHTML = `
            <h3>${template.name}</h3>
            <p>Filename: ${template.filename}</p>
            <div class="template-actions">
                <button class="refresh-btn view-btn" data-filename="${template.filename}">View</button>
                <button class="upload-to-device-btn" data-filename="${template.filename}" data-name="${template.name}" ${document.getElementById('connection-indicator').classList.contains('connected') ? '' : 'disabled'}>Upload to Device</button>
            </div>
        `;
        localTemplatesGrid.appendChild(templateEl);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const filename = this.getAttribute('data-filename');
            window.open(`uploads/${filename}`, '_blank');
        });
    });
    
    document.querySelectorAll('.upload-to-device-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.disabled) return;
            
            const filename = this.getAttribute('data-filename');
            const name = this.getAttribute('data-name');
            uploadLocalToDevice(filename, name);
        });
    });
}

// Render device templates
function renderDeviceTemplates(templates) {
    if (!deviceTemplatesGrid) return;
    
    if (!templates || templates.length === 0) {
        deviceTemplatesGrid.innerHTML = '<div class="template-item"><h3>No custom templates on device</h3><p>Upload templates to the device.</p></div>';
        return;
    }
    
    deviceTemplatesGrid.innerHTML = '';
    templates.forEach(template => {
        const templateEl = document.createElement('div');
        templateEl.className = 'template-item';
        templateEl.innerHTML = `
            <h3>${template.name}</h3>
            <p>Filename: ${template.filename}</p>
            <div class="template-actions">
                <button class="refresh-btn download-btn" data-filename="${template.filename}">Download</button>
            </div>
        `;
        deviceTemplatesGrid.appendChild(templateEl);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const filename = this.getAttribute('data-filename');
            downloadFromDevice(filename);
        });
    });
}

// Upload local template to device
function uploadLocalToDevice(filename, templateName) {
    log(`Uploading template "${templateName}" to device...`, 'info');
    
    const formData = new FormData();
    formData.append('action', 'upload_local_to_device');
    formData.append('filename', filename);
    formData.append('template_name', templateName);
    formData.append('icon_code', '\ue90d');
    
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
            log(`Template "${templateName}" uploaded to device successfully!`, 'success');
            // Refresh device library
            loadDeviceLibrary();
        } else {
            log(`Upload to device failed: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        log(`Upload to device error: ${error.message}`, 'error');
    });
}

// Download template from device
function downloadFromDevice(filename) {
    log(`Downloading template "${filename}" from device...`, 'info');
    
    fetch(`uploader.php?action=download_from_device&filename=${filename}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                log(`Template "${filename}" downloaded successfully!`, 'success');
                // Create download link
                const a = document.createElement('a');
                a.href = data.file_url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Refresh local library
                loadLocalLibrary();
            } else {
                log(`Download failed: ${data.message}`, 'error');
            }
        })
        .catch(error => {
            log(`Download error: ${error.message}`, 'error');
        });
}

// Export functions to make them available to the main.js
window.initTemplatesTab = initTemplatesTab;
window.refreshTemplateData = refreshTemplateData;