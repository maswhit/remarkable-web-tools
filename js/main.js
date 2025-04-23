// Core variables
const connectionStatus = document.getElementById('connection-status');
const connectionIndicator = document.getElementById('connection-indicator');
const refreshConnectionBtn = document.getElementById('refresh-connection');
const logContainer = document.getElementById('log-container');
const saveSettingsBtn = document.getElementById('save-settings');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContentContainer = document.getElementById('tab-content-container');

// Settings fields
const remarkableIpField = document.getElementById('remarkable-ip');
const remarkableUserField = document.getElementById('remarkable-user');
const remarkablePasswordField = document.getElementById('remarkable-password');

// Tab configuration - Add new tabs here
const tabs = {
    'templates': {
        title: 'Templates',
        file: 'templates-tab.html',
        init: function() {
            // Initialize templates tab (handled in templates.js)
            if (typeof initTemplatesTab === 'function') {
                initTemplatesTab();
            }
        }
    },
    'future': {
        title: 'Future Tab',
        file: 'future-tab.html',
        init: function() {
            // Future tab initialization
            console.log('Future tab initialized');
        }
    }
    // Add more tabs as needed:
    // 'newtab': {
    //     title: 'New Tab',
    //     file: 'newtab-tab.html',
    //     init: function() { /* initialization code */ }
    // }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load settings
    loadSettings();
    
    // Check connection on load
    checkConnection();
    
    // Setup tab navigation
    setupTabs();
    
    // Load the initial active tab
    loadActiveTab();
});

// Sidebar functions
function openNav() {
    document.getElementById("sidebar").style.width = "300px";
}

function closeNav() {
    document.getElementById("sidebar").style.width = "0";
}

// Tab functions
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Load the corresponding tab content
            const tabId = button.getAttribute('data-tab');
            loadTabContent(tabId);
        });
    });
}

// Load tab content via AJAX
function loadTabContent(tabId) {
    if (!tabs[tabId]) {
        console.error(`Tab ${tabId} not defined in configuration`);
        return;
    }
    
    const tabConfig = tabs[tabId];
    
    // Create fetch request to get the tab HTML
    fetch(tabConfig.file)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            // Set the tab content
            tabContentContainer.innerHTML = html;
            
            // Initialize the tab
            tabConfig.init();
            
            // Log tab load
            log(`${tabConfig.title} tab loaded`, 'info');
        })
        .catch(error => {
            tabContentContainer.innerHTML = `<div class="card"><h2>Error Loading Tab</h2><p>Could not load ${tabConfig.title}: ${error.message}</p></div>`;
            log(`Error loading ${tabConfig.title} tab: ${error.message}`, 'error');
        });
}

// Load the currently active tab
function loadActiveTab() {
    const activeButton = document.querySelector('.tab-button.active');
    if (activeButton) {
        const tabId = activeButton.getAttribute('data-tab');
        loadTabContent(tabId);
    }
}

// Settings functions
function loadSettings() {
    fetch('uploader.php?action=get_settings')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                remarkableIpField.value = data.settings.REMARKABLE_IP || '';
                remarkableUserField.value = data.settings.REMARKABLE_USER || 'root';
                remarkablePasswordField.value = data.settings.REMARKABLE_PASSWORD || '';
                log('Settings loaded successfully', 'success');
            } else {
                log(`Failed to load settings: ${data.message}`, 'info');
            }
        })
        .catch(error => {
            log(`Error loading settings: ${error.message}`, 'error');
        });
}

// Save settings event listener
saveSettingsBtn.addEventListener('click', function() {
    const settings = {
        REMARKABLE_IP: remarkableIpField.value,
        REMARKABLE_USER: remarkableUserField.value,
        REMARKABLE_PASSWORD: remarkablePasswordField.value
    };
    
    log('Saving settings...', 'info');
    
    fetch('uploader.php?action=save_settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            log('Settings saved successfully', 'success');
            closeNav();
            checkConnection();
        } else {
            log(`Failed to save settings: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        log(`Error saving settings: ${error.message}`, 'error');
    });
});

// Refresh connection button
refreshConnectionBtn.addEventListener('click', () => {
    checkConnection();
});

// Logging function - Available globally for all modules
function log(message, type = 'info') {
    if (!message) return;
    
    try {
        const entry = document.createElement('p');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        if (logContainer) {
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        console.log(`[${type}] ${message}`);
    } catch (error) {
        console.error("Error in logging:", error);
    }
}

// Check connection to reMarkable
function checkConnection() {
    setConnectionStatus('connecting', 'Connecting to reMarkable...');
    
    fetch('uploader.php?action=check_connection')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                setConnectionStatus('connected', 'Connected to reMarkable');
                
                // If the templates tab is loaded, refresh its data
                if (typeof refreshTemplateData === 'function') {
                    refreshTemplateData();
                }
                
                // Dispatch a custom event that other modules can listen for
                document.dispatchEvent(new CustomEvent('remarkableConnected'));
            } else {
                setConnectionStatus('disconnected', `Failed to connect: ${data.message}`);
                
                // Dispatch a custom event for disconnection
                document.dispatchEvent(new CustomEvent('remarkableDisconnected'));
            }
        })
        .catch(error => {
            setConnectionStatus('disconnected', `Connection error: ${error.message}`);
            
            // Dispatch a custom event for disconnection
            document.dispatchEvent(new CustomEvent('remarkableDisconnected'));
        });
}

// Set connection status UI
function setConnectionStatus(status, message) {
    if (connectionStatus) {
        connectionStatus.textContent = message;
    }
    
    if (connectionIndicator) {
        connectionIndicator.className = 'status-indicator ' + status;
    }
    
    log(message, status === 'connected' ? 'success' : status === 'connecting' ? 'info' : 'error');
}

// Make commonly needed functions and variables available globally
window.log = log;
window.checkConnection = checkConnection;
window.setConnectionStatus = setConnectionStatus;
