<?php
// Prevent any output before JSON response
ob_start();

// Disable display of PHP errors; capture them in the JSON response instead
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Handle all PHP notices/warnings/errors as JSON
function handleError($errno, $errstr, $errfile, $errline) {
    ob_clean();
    echo json_encode([
        'success' => false,
        'message' => "PHP Error: $errstr in $errfile on line $errline"
    ]);
    exit;
}
set_error_handler('handleError');

// Handle fatal errors
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e !== null && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        ob_clean();
        echo json_encode([
            'success' => false,
            'message' => "Fatal Error: {$e['message']} in {$e['file']} on line {$e['line']}"
        ]);
        exit;
    }
});

// Always emit JSON
header('Content-Type: application/json');

// -----------------------------------------------------------------------------
// Load settings from settings.conf
// -----------------------------------------------------------------------------
function loadSettings(): array {
    $settingsPath = __DIR__ . '/settings.conf';
    $settings = [];
    
    if (!file_exists($settingsPath)) {
        // Create default settings file if it doesn't exist
        $defaultSettings = [
            'REMARKABLE_IP' => '',
            'REMARKABLE_USER' => 'root',
            'REMARKABLE_PASSWORD' => ''
        ];
        
        file_put_contents($settingsPath, json_encode($defaultSettings, JSON_PRETTY_PRINT));
        return $defaultSettings;
    }

    $json = file_get_contents($settingsPath);
    $settings = json_decode($json, true);
    
    if ($settings === null) {
        return [
            'REMARKABLE_IP' => '',
            'REMARKABLE_USER' => 'root',
            'REMARKABLE_PASSWORD' => ''
        ];
    }
    
    // Set environment variables
    foreach ($settings as $k => $v) {
        putenv("$k=$v");
        $_ENV[$k] = $v;
        $_SERVER[$k] = $v;
    }
    
    return $settings;
}

// Save settings to settings.conf
function saveSettings(array $settings): bool {
    $settingsPath = __DIR__ . '/settings.conf';
    
    // Validate required fields
    if (!isset($settings['REMARKABLE_IP']) || !isset($settings['REMARKABLE_USER'])) {
        return false;
    }
    
    // Write to file
    $result = file_put_contents($settingsPath, json_encode($settings, JSON_PRETTY_PRINT));
    
    if ($result === false) {
        return false;
    }
    
    // Set environment variables
    foreach ($settings as $k => $v) {
        putenv("$k=$v");
        $_ENV[$k] = $v;
        $_SERVER[$k] = $v;
    }
    
    return true;
}

// -----------------------------------------------------------------------------
// SSH helpers
// -----------------------------------------------------------------------------
function executeSSHCommand(string $cmd): array {
    $host = getenv('REMARKABLE_IP');
    $user = getenv('REMARKABLE_USER');
    $pwd  = getenv('REMARKABLE_PASSWORD');

    if (!$host || !$user) {
        return ['success' => false, 'message' => 'Missing SSH details in settings.conf'];
    }

    $auth = $pwd ? "sshpass -p '" . escapeshellarg($pwd) . "'" : '';
    $full = "$auth ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $user@$host '$cmd' 2>&1";
    exec($full, $out, $code);

    return ['success' => $code === 0, 'message' => implode("\n", $out), 'code' => $code];
}

function checkConnection(): array {
    return executeSSHCommand('echo "Connection test"');
}

// -----------------------------------------------------------------------------
// SCP upload
// -----------------------------------------------------------------------------
function uploadFile(string $local, string $remote): array {
    $host = getenv('REMARKABLE_IP');
    $user = getenv('REMARKABLE_USER');
    $pwd  = getenv('REMARKABLE_PASSWORD');

    if (!$host || !$user) {
        return ['success' => false, 'message' => 'Missing SSH details in settings.conf'];
    }

    $auth = $pwd ? "sshpass -p '" . escapeshellarg($pwd) . "'" : '';
    $scp  = "$auth scp -o ConnectTimeout=5 -o StrictHostKeyChecking=no '$local' $user@$host:'$remote' 2>&1";
    exec($scp, $out, $code);

    return ['success' => $code === 0, 'message' => implode("\n", $out), 'code' => $code];
}

function downloadFile(string $remote, string $local): array {
    $host = getenv('REMARKABLE_IP');
    $user = getenv('REMARKABLE_USER');
    $pwd  = getenv('REMARKABLE_PASSWORD');

    if (!$host || !$user) {
        return ['success' => false, 'message' => 'Missing SSH details in settings.conf'];
    }

    $auth = $pwd ? "sshpass -p '" . escapeshellarg($pwd) . "'" : '';
    $scp  = "$auth scp -o ConnectTimeout=5 -o StrictHostKeyChecking=no $user@$host:'$remote' '$local' 2>&1";
    exec($scp, $out, $code);

    return ['success' => $code === 0, 'message' => implode("\n", $out), 'code' => $code];
}

// -----------------------------------------------------------------------------
// Update templates.json with the fixed icon code
// -----------------------------------------------------------------------------
function updateTemplatesJson(string $templateName, string $filenameNoExt): array {
    $tmp      = tempnam(sys_get_temp_dir(), 'remarkable_tpl_');
    $host     = getenv('REMARKABLE_IP');
    $user     = getenv('REMARKABLE_USER');
    $pwd      = getenv('REMARKABLE_PASSWORD');
    $auth     = $pwd ? "sshpass -p '" . escapeshellarg($pwd) . "'" : '';
    
    // Always use the specified icon code
    $iconCode = "\ue90d";

    // Download templates.json
    $dl = "$auth scp -o ConnectTimeout=5 -o StrictHostKeyChecking=no "
        . "$user@$host:/usr/share/remarkable/templates/templates.json '$tmp' 2>&1";
    exec($dl, $dlOut, $dlCode);
    if ($dlCode !== 0) {
        return ['success' => false, 'message' => 'Download templates.json failed: ' . implode("\n", $dlOut)];
    }

    // Backup
    $backup = $tmp . '.bak';
    copy($tmp, $backup);

    $json = file_get_contents($tmp);
    $data = json_decode($json, true);
    if ($data === null) {
        return ['success' => false, 'message' => 'templates.json parse error: ' . json_last_error_msg()];
    }

    $newTpl = [
        'name'       => $templateName,
        'filename'   => $filenameNoExt,        // extension removed
        'iconCode'   => $iconCode,
        'categories' => ['Custom']
    ];

    // Detect structure and insert / replace
    $isArray      = isset($data[0]);
    $hasMainArray = false;
    foreach ($data as $k => $v) {
        if (is_array($v) && isset($v[0]) && is_array($v[0])) {
            $hasMainArray = true;
            $mainKey      = $k;
            break;
        }
    }

    if ($hasMainArray) {
        $found = false;
        foreach ($data[$mainKey] as $i => $tpl) {
            if (isset($tpl['filename']) && $tpl['filename'] === $filenameNoExt) {
                $data[$mainKey][$i] = $newTpl;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $data[$mainKey][] = $newTpl;
        }
    } elseif ($isArray) {
        $found = false;
        foreach ($data as $i => $tpl) {
            if (isset($tpl['filename']) && $tpl['filename'] === $filenameNoExt) {
                $data[$i] = $newTpl;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $data[] = $newTpl;
        }
    } else { // object style
        $key             = "custom_" . preg_replace('/[^a-z0-9_]/i', '_', $filenameNoExt);
        $data[$key] = $newTpl;
    }

    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT));

    // Upload templates.json
    $ul = "$auth scp -o ConnectTimeout=5 -o StrictHostKeyChecking=no '$tmp' "
        . "$user@$host:/usr/share/remarkable/templates/templates.json 2>&1";
    exec($ul, $ulOut, $ulCode);

    unlink($tmp);
    if (file_exists($backup)) unlink($backup);

    if ($ulCode !== 0) {
        return ['success' => false, 'message' => 'Upload templates.json failed: ' . implode("\n", $ulOut)];
    }

    return ['success' => true, 'message' => 'templates.json updated successfully'];
}

// Restart reMarkable UI service
function restartRemarkable(): array {
    return executeSSHCommand('systemctl restart xochitl');
}

// -----------------------------------------------------------------------------
// Get device templates (from Custom category)
// -----------------------------------------------------------------------------
function getDeviceTemplates(): array {
    $tmp = tempnam(sys_get_temp_dir(), 'remarkable_tpl_');
    
    // Download templates.json
    $download = downloadFile('/usr/share/remarkable/templates/templates.json', $tmp);
    if (!$download['success']) {
        return ['success' => false, 'message' => 'Failed to download templates.json: ' . $download['message']];
    }
    
    $json = file_get_contents($tmp);
    $data = json_decode($json, true);
    unlink($tmp);
    
    if ($data === null) {
        return ['success' => false, 'message' => 'templates.json parse error: ' . json_last_error_msg()];
    }
    
    $customTemplates = [];
    
    // Detect structure and extract Custom category templates
    $isArray = isset($data[0]);
    $hasMainArray = false;
    foreach ($data as $k => $v) {
        if (is_array($v) && isset($v[0]) && is_array($v[0])) {
            $hasMainArray = true;
            $mainKey = $k;
            break;
        }
    }
    
    if ($hasMainArray) {
        foreach ($data[$mainKey] as $tpl) {
            if (isset($tpl['categories']) && in_array('Custom', $tpl['categories'])) {
                $customTemplates[] = $tpl;
            }
        }
    } elseif ($isArray) {
        foreach ($data as $tpl) {
            if (isset($tpl['categories']) && in_array('Custom', $tpl['categories'])) {
                $customTemplates[] = $tpl;
            }
        }
    } else { // object style
        foreach ($data as $key => $tpl) {
            if (isset($tpl['categories']) && in_array('Custom', $tpl['categories'])) {
                $customTemplates[] = $tpl;
            }
        }
    }
    
    return ['success' => true, 'templates' => $customTemplates];
}

// -----------------------------------------------------------------------------
// Local Library Functions
// -----------------------------------------------------------------------------

// Create uploads directory if it doesn't exist
function initLocalLibrary() {
    $uploadsDir = __DIR__ . '/uploads';
    if (!file_exists($uploadsDir)) {
        mkdir($uploadsDir, 0755, true);
    }
    
    $libraryFile = $uploadsDir . '/library.json';
    if (!file_exists($libraryFile)) {
        file_put_contents($libraryFile, json_encode(['templates' => []]));
    }
    
    return ['uploadsDir' => $uploadsDir, 'libraryFile' => $libraryFile];
}

// Get local templates
function getLocalTemplates(): array {
    $library = initLocalLibrary();
    $libraryFile = $library['libraryFile'];
    
    if (!file_exists($libraryFile)) {
        return ['success' => false, 'message' => 'Library file not found'];
    }
    
    $json = file_get_contents($libraryFile);
    $data = json_decode($json, true);
    
    if ($data === null) {
        return ['success' => false, 'message' => 'Library file parse error: ' . json_last_error_msg()];
    }
    
    return ['success' => true, 'templates' => $data['templates']];
}

// Add template to local library
function addToLocalLibrary(string $filename, string $templateName): array {
    $library = initLocalLibrary();
    $libraryFile = $library['libraryFile'];
    
    $localTemplates = getLocalTemplates();
    if (!$localTemplates['success']) {
        return $localTemplates;
    }
    
    $templates = $localTemplates['templates'];
    
    // Check if template already exists
    foreach ($templates as $key => $template) {
        if ($template['filename'] === $filename) {
            // Update existing template
            $templates[$key]['name'] = $templateName;
            break;
        }
    }
    
    // Add new template if it doesn't exist
    $found = false;
    foreach ($templates as $template) {
        if ($template['filename'] === $filename) {
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        $templates[] = [
            'name' => $templateName,
            'filename' => $filename
        ];
    }
    
    // Save to library file
    $data = ['templates' => $templates];
    file_put_contents($libraryFile, json_encode($data, JSON_PRETTY_PRINT));
    
    return ['success' => true, 'message' => 'Template added to local library'];
}

// Upload template to local library
function uploadToLocalLibrary(): array {
    if (!isset($_FILES['template_file']) || $_FILES['template_file']['error'] !== UPLOAD_ERR_OK) {
        return [
            'success' => false,
            'message' => 'No file uploaded or an upload error occurred: ' .
                        ($_FILES['template_file']['error'] ?? 'unknown')
        ];
    }

    $library = initLocalLibrary();
    $uploadsDir = $library['uploadsDir'];
    
    $file = $_FILES['template_file'];
    $templateName = $_POST['template_name'] ?? 'Custom Template';
    $origName = $file['name'];
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    
    if ($ext !== 'png') {
        return ['success' => false, 'message' => 'Only PNG files are accepted'];
    }
    
    $safeName = preg_replace('/\s+/', '_', $templateName);
    $safeName = preg_replace('/[^a-zA-Z0-9_]/i', '_', $safeName);
    $finalFilename = $safeName . '.png';
    
    $destination = $uploadsDir . '/' . $finalFilename;
    
    // Check if file already exists
    if (file_exists($destination)) {
        // Generate unique filename
        $i = 1;
        $pathInfo = pathinfo($finalFilename);
        $nameWithoutExt = $pathInfo['filename'];
        
        while (file_exists($uploadsDir . '/' . $nameWithoutExt . '_' . $i . '.png')) {
            $i++;
        }
        
        $finalFilename = $nameWithoutExt . '_' . $i . '.png';
        $destination = $uploadsDir . '/' . $finalFilename;
    }
    
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        return ['success' => false, 'message' => 'Failed to move uploaded file'];
    }
    
    // Add to library
    $result = addToLocalLibrary($finalFilename, $templateName);
    if (!$result['success']) {
        return $result;
    }
    
    return ['success' => true, 'message' => 'Template uploaded to local library successfully'];
}

// -----------------------------------------------------------------------------
// Download a template from device and save to local library
// -----------------------------------------------------------------------------
function downloadFromDevice(string $filename): array {
    $library = initLocalLibrary();
    $uploadsDir = $library['uploadsDir'];
    
    // Download template PNG from device
    $remotePath = '/usr/share/remarkable/templates/' . $filename . '.png';
    $localPath = $uploadsDir . '/' . $filename . '.png';
    
    $download = downloadFile($remotePath, $localPath);
    if (!$download['success']) {
        return ['success' => false, 'message' => 'Failed to download template: ' . $download['message']];
    }
    
    // Get template name from templates.json
    $tmp = tempnam(sys_get_temp_dir(), 'remarkable_tpl_');
    $downloadJson = downloadFile('/usr/share/remarkable/templates/templates.json', $tmp);
    
    $templateName = $filename; // Default name if we can't find it
    
    if ($downloadJson['success']) {
        $json = file_get_contents($tmp);
        $data = json_decode($json, true);
        
        if ($data !== null) {
            // Try to find the template name
            $found = false;
            
            // Detect structure
            $isArray = isset($data[0]);
            $hasMainArray = false;
            foreach ($data as $k => $v) {
                if (is_array($v) && isset($v[0]) && is_array($v[0])) {
                    $hasMainArray = true;
                    $mainKey = $k;
                    break;
                }
            }
            
            if ($hasMainArray) {
                foreach ($data[$mainKey] as $tpl) {
                    if (isset($tpl['filename']) && $tpl['filename'] === $filename) {
                        $templateName = $tpl['name'];
                        $found = true;
                        break;
                    }
                }
            } elseif ($isArray) {
                foreach ($data as $tpl) {
                    if (isset($tpl['filename']) && $tpl['filename'] === $filename) {
                        $templateName = $tpl['name'];
                        $found = true;
                        break;
                    }
                }
            } else { // object style
                foreach ($data as $key => $tpl) {
                    if (isset($tpl['filename']) && $tpl['filename'] === $filename) {
                        $templateName = $tpl['name'];
                        $found = true;
                        break;
                    }
                }
            }
        }
        
        unlink($tmp);
    }
    
    // Add to local library
    addToLocalLibrary($filename . '.png', $templateName);
    
    // Return success with file URL
    $fileUrl = 'uploads/' . $filename . '.png';
    return ['success' => true, 'message' => 'Template downloaded successfully', 'file_url' => $fileUrl];
}

// -----------------------------------------------------------------------------
// Upload local template to device
// -----------------------------------------------------------------------------
function uploadLocalToDevice(string $filename, string $templateName): array {
    $library = initLocalLibrary();
    $uploadsDir = $library['uploadsDir'];
    
    $localPath = $uploadsDir . '/' . $filename;
    if (!file_exists($localPath)) {
        return ['success' => false, 'message' => 'Template file not found in local library'];
    }
    
    // Upload to device
    $remotePath = '/usr/share/remarkable/templates/' . $filename;
    $upload = uploadFile($localPath, $remotePath);
    
    if (!$upload['success']) {
        return ['success' => false, 'message' => 'Failed to upload template: ' . $upload['message']];
    }
    
    // Extract filename without extension for templates.json
    $filenameNoExt = pathinfo($filename, PATHINFO_FILENAME);
    
    // Update templates.json
    $updateJson = updateTemplatesJson($templateName, $filenameNoExt);
    
    if (!$updateJson['success']) {
        return ['success' => false, 'message' => 'Failed to update templates.json: ' . $updateJson['message']];
    }
    
    return ['success' => true, 'message' => 'Template uploaded to device successfully'];
}

// -----------------------------------------------------------------------------
// Settings Management
// -----------------------------------------------------------------------------

// Get current settings
function getSettings(): array {
    $settings = loadSettings();
    return ['success' => true, 'settings' => $settings];
}

// Save new settings
function saveSettingsFromRequest(): array {
    // Get JSON input
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($data === null) {
        return ['success' => false, 'message' => 'Invalid JSON: ' . json_last_error_msg()];
    }
    
    // Validate required fields
    if (!isset($data['REMARKABLE_IP']) || !isset($data['REMARKABLE_USER'])) {
        return ['success' => false, 'message' => 'Missing required settings: IP and User'];
    }
    
    // Save settings
    $result = saveSettings($data);
    
    if (!$result) {
        return ['success' => false, 'message' => 'Failed to save settings'];
    }
    
    return ['success' => true, 'message' => 'Settings saved successfully'];
}

// -----------------------------------------------------------------------------
// PDF Upload Functions
// -----------------------------------------------------------------------------

// Upload PDF to reMarkable with interactive authentication
function uploadPdfToRemarkable(): array {
    if (!isset($_FILES['pdf_file']) || $_FILES['pdf_file']['error'] !== UPLOAD_ERR_OK) {
        // Check if we have a pending PDF from a previous upload
        if (isset($_SESSION['pending_pdf']) && !empty($_POST['one_time_code'])) {
            $destination = $_SESSION['pending_pdf']['filepath'];
            
            if (!file_exists($destination)) {
                unset($_SESSION['pending_pdf']);
                return [
                    'success' => false,
                    'message' => 'Pending PDF file not found. Please upload again.'
                ];
            }
        } else {
            return [
                'success' => false,
                'message' => 'No file uploaded or an upload error occurred: ' .
                            ($_FILES['pdf_file']['error'] ?? 'unknown')
            ];
        }
    } else {
        $file = $_FILES['pdf_file'];
        
        // Check if it's a PDF
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($ext !== 'pdf') {
            return ['success' => false, 'message' => 'Only PDF files are accepted'];
        }
        
        // Create uploads directory if it doesn't exist
        $uploadsDir = __DIR__ . '/uploads/pdfs';
        if (!file_exists($uploadsDir)) {
            mkdir($uploadsDir, 0755, true);
        }
        
        // Create a config directory for rmapi
        $configDir = __DIR__ . '/uploads/.config/rmapi';
        if (!file_exists($configDir)) {
            mkdir($configDir, 0755, true);
        }
        
        // Generate a safe filename
        $safeName = preg_replace('/\s+/', '_', $file['name']);
        $safeName = preg_replace('/[^a-zA-Z0-9_.-]/i', '_', $safeName);
        $destination = $uploadsDir . '/' . $safeName;
        
        // If file already exists, add a unique identifier
        if (file_exists($destination)) {
            $pathInfo = pathinfo($safeName);
            $filename = $pathInfo['filename'];
            $extension = $pathInfo['extension'] ?? 'pdf';
            $destination = $uploadsDir . '/' . $filename . '_' . uniqid() . '.' . $extension;
        }
        
        // Move the uploaded file to our uploads directory
        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            return ['success' => false, 'message' => 'Failed to move uploaded file'];
        }
        
        // Store file info for later use if we need authentication
        $_SESSION['pending_pdf'] = [
            'filename' => basename($destination),
            'filepath' => $destination
        ];
    }
    
    // Check for one-time code
    $otc = isset($_POST['one_time_code']) ? trim($_POST['one_time_code']) : '';
    
    // Set HOME environment variable
    putenv("HOME=" . __DIR__ . "/uploads");
    
    if (empty($otc)) {
        // Try uploading without authentication first
        $command = "rmapi put " . escapeshellarg($destination) . " 2>&1";
        exec($command, $output, $returnCode);
        
        $outputText = implode("\n", $output);
        
        // Check if we need authentication
        if (strpos($outputText, "Enter one-time code") !== false || 
            strpos($outputText, "Code has the wrong length") !== false) {
            
            return [
                'success' => false,
                'needs_auth' => true,
                'message' => 'Authentication required to upload to reMarkable.'
            ];
        }
        
        // If upload succeeded
        if ($returnCode === 0) {
            // Clean up the file
            if (file_exists($destination)) {
                unlink($destination);
            }
            unset($_SESSION['pending_pdf']);
            
            return [
                'success' => true,
                'message' => 'PDF uploaded successfully to your reMarkable device.'
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Failed to upload PDF. Error: ' . $outputText
            ];
        }
    } else {
        // Validate code format
        if (strlen($otc) !== 8) {
            return [
                'success' => false,
                'needs_auth' => true,
                'message' => 'Invalid code. The one-time code should be 8 characters.'
            ];
        }
        
        // Instead of using expect, we'll pre-register the device in a separate step
        $registerCmd = "echo " . escapeshellarg($otc) . " | rmapi register 2>&1";
        exec($registerCmd, $registerOutput, $registerCode);
        
        $registerText = implode("\n", $registerOutput);
        
        // Now try to upload the file
        $uploadCmd = "rmapi put " . escapeshellarg($destination) . " 2>&1";
        exec($uploadCmd, $uploadOutput, $uploadCode);
        
        $uploadText = implode("\n", $uploadOutput);
        
        // Clean up the file if upload succeeded
        if ($uploadCode === 0) {
            if (file_exists($destination)) {
                unlink($destination);
            }
            unset($_SESSION['pending_pdf']);
            
            return [
                'success' => true,
                'message' => 'PDF uploaded successfully to your reMarkable device.'
            ];
        } else {
            // Check if authentication failed
            if (strpos($registerText, "Invalid code") !== false || 
                strpos($uploadText, "Invalid code") !== false) {
                
                return [
                    'success' => false,
                    'needs_auth' => true,
                    'message' => 'Invalid authentication code. Please try again.'
                ];
            }
            
            return [
                'success' => false,
                'message' => 'Failed to upload PDF. Registration: ' . $registerText . ' Upload: ' . $uploadText
            ];
        }
    }
}

// -----------------------------------------------------------------------------
// System Images Functions
// -----------------------------------------------------------------------------

// Get list of PNG images in /usr/share/remarkable directory (top-level only, no subdirectories)
function getSystemImages(): array {
    // Check connection first
    $connection = checkConnection();
    if (!$connection['success']) {
        return ['success' => false, 'message' => 'Not connected to reMarkable: ' . $connection['message']];
    }
    
    // Execute command to find PNG files in top-level directory only (no subdirectories)
    // Using find with maxdepth=1 to limit to just the top-level directory
    $findCmd = "find /usr/share/remarkable -maxdepth 1 -name '*.png' -type f | sort";
    $result = executeSSHCommand($findCmd);
    
    if (!$result['success']) {
        return ['success' => false, 'message' => 'Failed to list system images: ' . $result['message']];
    }
    
    // Process files
    $files = explode("\n", trim($result['message']));
    $images = [];
    
    foreach ($files as $file) {
        if (empty(trim($file))) continue;
        
        // Get file size
        $sizeCmd = "stat -c%s " . escapeshellarg($file);
        $sizeResult = executeSSHCommand($sizeCmd);
        $size = $sizeResult['success'] ? intval($sizeResult['message']) : 0;
        
        // Extract filename
        $filename = basename($file);
        
        $images[] = [
            'filename' => $filename,
            'path' => $file,
            'size' => $size
        ];
    }
    
    return ['success' => true, 'images' => $images];
}

// Get a thumbnail of a system image
function getSystemImageThumbnail(string $path): array {
    // Check connection first
    $connection = checkConnection();
    if (!$connection['success']) {
        return ['success' => false, 'message' => 'Not connected to reMarkable'];
    }
    
    // Create temp file
    $tmpFile = tempnam(sys_get_temp_dir(), 'remarkable_img_');
    
    // Download file
    $download = downloadFile($path, $tmpFile);
    if (!$download['success']) {
        return ['success' => false, 'message' => 'Failed to download image: ' . $download['message']];
    }
    
    // Return image data
    header('Content-Type: image/png');
    readfile($tmpFile);
    unlink($tmpFile);
    exit; // Exit after sending image data
}

// Get full system image
function getSystemImageFull(string $path): array {
    // Same implementation as thumbnail for now, 
    // but could be modified to serve full-size images differently if needed
    return getSystemImageThumbnail($path);
}

// Replace a system image with a template from local library
function replaceSystemImage(string $targetPath, string $replacementFilename): array {
    // Check connection first
    $connection = checkConnection();
    if (!$connection['success']) {
        return ['success' => false, 'message' => 'Not connected to reMarkable: ' . $connection['message']];
    }
    
    $library = initLocalLibrary();
    $uploadsDir = $library['uploadsDir'];
    
    $localPath = $uploadsDir . '/' . $replacementFilename;
    if (!file_exists($localPath)) {
        return ['success' => false, 'message' => 'Template file not found in local library'];
    }
    
    // Backup original file
    $backupCmd = "cp " . escapeshellarg($targetPath) . " " . escapeshellarg($targetPath . '.backup');
    $backupResult = executeSSHCommand($backupCmd);
    
    if (!$backupResult['success']) {
        return ['success' => false, 'message' => 'Failed to backup original file: ' . $backupResult['message']];
    }
    
    // Upload replacement file
    $upload = uploadFile($localPath, $targetPath);
    
    if (!$upload['success']) {
        return ['success' => false, 'message' => 'Failed to upload replacement: ' . $upload['message']];
    }
    
    // Set correct permissions
    $chmodCmd = "chmod 644 " . escapeshellarg($targetPath);
    $chmodResult = executeSSHCommand($chmodCmd);
    
    if (!$chmodResult['success']) {
        return ['success' => false, 'message' => 'Failed to set permissions: ' . $chmodResult['message']];
    }
    
    return ['success' => true, 'message' => 'System image replaced successfully'];
}

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------
try {
    // Load settings for every request
    loadSettings();

    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    // Check if we have a JSON input for actions that expect it
    if (empty($action) && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (strpos($contentType, 'application/json') !== false) {
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);
            $action = $data['action'] ?? '';
        }
    }
    
    switch ($action) {
        case 'check_connection':
            echo json_encode(checkConnection());
            break;
        case 'upload_template':
            echo json_encode(uploadToLocalLibrary());
            break;
        case 'get_local_templates':
            echo json_encode(getLocalTemplates());
            break;
        case 'get_device_templates':
            echo json_encode(getDeviceTemplates());
            break;
        case 'upload_local_to_device':
            $filename = $_POST['filename'] ?? '';
            $templateName = $_POST['template_name'] ?? '';
            if (!$filename || !$templateName) {
                echo json_encode(['success' => false, 'message' => 'Missing filename or template name']);
                break;
            }
            echo json_encode(uploadLocalToDevice($filename, $templateName));
            break;
        case 'download_from_device':
            $filename = $_GET['filename'] ?? '';
            if (!$filename) {
                echo json_encode(['success' => false, 'message' => 'Missing filename']);
                break;
            }
            echo json_encode(downloadFromDevice($filename));
            break;
        case 'restart_remarkable':
            echo json_encode(restartRemarkable());
            break;
        case 'get_settings':
            echo json_encode(getSettings());
            break;
        case 'save_settings':
            echo json_encode(saveSettingsFromRequest());
            break;
        case 'get_system_images':
            echo json_encode(getSystemImages());
            break;
        case 'get_system_image_thumbnail':
            $path = $_GET['path'] ?? '';
            if (!$path) {
                echo json_encode(['success' => false, 'message' => 'Missing path parameter']);
                break;
            }
            getSystemImageThumbnail($path);
            break;
        case 'get_system_image_full':
            $path = $_GET['path'] ?? '';
            if (!$path) {
                echo json_encode(['success' => false, 'message' => 'Missing path parameter']);
                break;
            }
            getSystemImageFull($path);
            break;
        case 'replace_system_image':
            $targetPath = $_POST['target_path'] ?? '';
            $replacementFilename = $_POST['replacement_filename'] ?? '';
            if (!$targetPath || !$replacementFilename) {
                echo json_encode(['success' => false, 'message' => 'Missing target path or replacement filename']);
                break;
            }
            echo json_encode(replaceSystemImage($targetPath, $replacementFilename));
            break;
            case 'upload_pdf':
                echo json_encode(uploadPdfToRemarkable());
                break;
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action: ' . $action]);
            break;
    }
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => 'Exception: ' . $e->getMessage()]);
}

// Flush output buffer
ob_end_flush();
?>