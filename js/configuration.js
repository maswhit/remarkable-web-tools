// Configuration tab variables
let loadConfigBtn;
let backupConfigBtn;
let enableEditBtn;
let cancelEditBtn;
let saveConfigBtn;
let configView;
let configEditor;
let configViewContainer;
let configEditContainer;
let currentConfig = '';

// Initialize the configuration tab functionality
function initConfigurationTab() {
    // Get DOM elements after the tab content is loaded
    loadConfigBtn = document.getElementById('load-config-btn');
    backupConfigBtn = document.getElementById('backup-config-btn');
    enableEditBtn = document.getElementById('enable-edit-btn');
    cancelEditBtn = document.getElementById('cancel-edit-btn');
    saveConfigBtn = document.getElementById('save-config-btn');
    configView = document.getElementById('config-view');
    configEditor = document.getElementById('config-editor');
    configViewContainer = document.getElementById('config-view-container');
    configEditContainer = document.getElementById('config-edit-container');
    
    // Set up event listeners
    setupConfigListeners();
    
    // Check connection status
    updateButtonsByConnectionStatus();
    
    // Listen for connection events
    document.addEventListener('remarkableConnected', handleRemarkableConnected);
    document.addEventListener('remarkableDisconnected', handleRemarkableDisconnected);
}

// Setup event listeners for configuration actions
function setupConfigListeners() {
    // Load config button
    if (loadConfigBtn) {
        loadConfigBtn.addEventListener('click', loadConfiguration);
    }
    
    // Backup config button
    if (backupConfigBtn) {
        backupConfigBtn.addEventListener('click', backupConfiguration);
    }
    
    // Enable edit button
    if (enableEditBtn) {
        enableEditBtn.addEventListener('click', function() {
            // Show a confirmation dialog
            if (confirm('Are you sure you want to edit the configuration file? Incorrect changes may affect your device.')) {
                enableEditing();
            }
        });
    }
    
    // Cancel edit button
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEditing);
    }
    
    // Save config button
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', function() {
            // Show a confirmation dialog
            if (confirm('WARNING: You are about to modify your device configuration and restart the device. Are you sure you want to proceed?')) {
                saveConfiguration();
            }
        });
    }
}

// Handle reMarkable connected event
function handleRemarkableConnected() {
    updateButtonsByConnectionStatus(true);
}

// Handle reMarkable disconnected event
function handleRemarkableDisconnected() {
    updateButtonsByConnectionStatus(false);
}

// Update buttons based on connection status
function updateButtonsByConnectionStatus(isConnected = null) {
    // If not provided, check the connection indicator
    if (isConnected === null) {
        isConnected = document.getElementById('connection-indicator').classList.contains('connected');
    }
    
    // Enable/disable buttons based on connection status
    if (loadConfigBtn) loadConfigBtn.disabled = !isConnected;
    if (backupConfigBtn) backupConfigBtn.disabled = !isConnected || !currentConfig;
    if (enableEditBtn) enableEditBtn.disabled = !isConnected || !currentConfig;
    
    // Update view if disconnected
    if (!isConnected && configView) {
        configView.innerHTML = '<p class="config-placeholder">Connect to your reMarkable device to view the configuration.</p>';
        currentConfig = '';
    }
}

// Load the configuration file from the device
function loadConfiguration() {
    log('Loading configuration from device...', 'info');
    
    fetch('uploader.php?action=get_device_config')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Store current config
                currentConfig = data.config;
                
                // Format and display the config
                configView.innerHTML = formatConfigForDisplay(currentConfig);
                
                // Enable the edit button
                if (enableEditBtn) enableEditBtn.disabled = false;
                
                // Enable the backup button
                if (backupConfigBtn) backupConfigBtn.disabled = false;
                
                log('Configuration loaded successfully', 'success');
            } else {
                configView.innerHTML = `<p class="config-placeholder">Error: ${data.message}</p>`;
                log(`Failed to load configuration: ${data.message}`, 'error');
                
                // Disable the edit button
                if (enableEditBtn) enableEditBtn.disabled = true;
            }
        })
        .catch(error => {
            configView.innerHTML = `<p class="config-placeholder">Error: ${error.message}</p>`;
            log(`Error loading configuration: ${error.message}`, 'error');
            
            // Disable the edit button
            if (enableEditBtn) enableEditBtn.disabled = true;
        });
}

// Format the configuration text for display
function formatConfigForDisplay(configText) {
    // Escape HTML entities
    const escaped = configText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // Add syntax highlighting (simple version)
    return escaped
        .replace(/^(#.*)/gm, '<span style="color: #888;">$1</span>') // Comments
        .replace(/^([a-zA-Z0-9_]+)=/gm, '<span style="color: #007bff;">$1</span>=') // Variable names
        .replace(/=([^=\n]+)$/gm, '=<span style="color: #28a745;">$1</span>'); // Values
}

// Enable editing mode
function enableEditing() {
    // Hide view container
    if (configViewContainer) configViewContainer.classList.add('hidden');
    
    // Show edit container
    if (configEditContainer) configEditContainer.classList.remove('hidden');
    
    // Set editor content
    if (configEditor) configEditor.value = currentConfig;
    
    // Focus the editor
    if (configEditor) configEditor.focus();
    
    log('Editing mode enabled. Be careful with your changes.', 'info');
}

// Cancel editing mode
function cancelEditing() {
    // Hide edit container
    if (configEditContainer) configEditContainer.classList.add('hidden');
    
    // Show view container
    if (configViewContainer) configViewContainer.classList.remove('hidden');
    
    log('Editing canceled.', 'info');
}

// Save the configuration file
function saveConfiguration() {
    const newConfig = configEditor.value;
    
    // Check if there are any changes
    if (newConfig === currentConfig) {
        log('No changes detected in the configuration.', 'info');
        cancelEditing();
        return;
    }
    
    log('Saving configuration to device...', 'info');
    
    // Disable the save button while saving
    if (saveConfigBtn) saveConfigBtn.disabled = true;
    if (cancelEditBtn) cancelEditBtn.disabled = true;
    
    const formData = new FormData();
    formData.append('action', 'save_device_config');
    formData.append('config', newConfig);
    
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
            log(`Configuration saved successfully. ${data.restart ? 'Device is restarting...' : ''}`, 'success');
            
            // Update current config
            currentConfig = newConfig;
            
            // Update the view
            configView.innerHTML = formatConfigForDisplay(currentConfig);
            
            // Exit edit mode
            cancelEditing();
            
            // If device is restarting, update connection status
            if (data.restart) {
                setConnectionStatus('disconnected', 'Disconnected (reMarkable is restarting)');
                
                // Wait for device to restart
                setTimeout(() => {
                    log('Waiting for reMarkable to come back online...', 'info');
                    
                    // Try to reconnect after some time
                    setTimeout(() => {
                        checkConnection();
                    }, 20000); // Wait 20 seconds before trying to reconnect
                }, 5000);
            }
        } else {
            log(`Failed to save configuration: ${data.message}`, 'error');
        }
        
        // Re-enable the buttons
        if (saveConfigBtn) saveConfigBtn.disabled = false;
        if (cancelEditBtn) cancelEditBtn.disabled = false;
    })
    .catch(error => {
        log(`Error saving configuration: ${error.message}`, 'error');
        
        // Re-enable the buttons
        if (saveConfigBtn) saveConfigBtn.disabled = false;
        if (cancelEditBtn) cancelEditBtn.disabled = false;
    });
}

// Backup the configuration file
function backupConfiguration() {
    if (!currentConfig) {
        log('No configuration loaded to backup.', 'error');
        return;
    }
    
    log('Creating backup of configuration...', 'info');
    
    const blob = new Blob([currentConfig], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Generate timestamp for filename
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
    
    a.href = url;
    a.download = `xochitl_config_backup_${timestamp}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('Configuration backup created. Download started.', 'success');
}

// Export function to make it available to the main.js
window.initConfigurationTab = initConfigurationTab;