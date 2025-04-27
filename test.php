<?php
// Direct test script for uploading PDFs to reMarkable
// Save this as rmapi-test.php in your web directory

// Set error reporting for debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Handle file upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['pdf_file'])) {
    $file = $_FILES['pdf_file'];
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        die("Upload error: " . $file['error']);
    }
    
    // Temporary directory for this upload
    $tempDir = sys_get_temp_dir() . '/rmapi_' . uniqid();
    mkdir($tempDir, 0755, true);
    
    // Create config directory
    mkdir($tempDir . '/.config/rmapi', 0755, true);
    
    // Move uploaded file to temp directory
    $tempFile = $tempDir . '/' . $file['name'];
    if (!move_uploaded_file($file['tmp_name'], $tempFile)) {
        die("Failed to move uploaded file");
    }
    
    // Run rmapi directly with HOME set to our temp directory
    putenv("HOME=" . $tempDir);
    $command = "rmapi put " . escapeshellarg($tempFile) . " 2>&1";
    
    echo "<h1>Running Command:</h1>";
    echo "<pre>$command</pre>";
    
    echo "<h1>Output:</h1>";
    echo "<pre>";
    
    // Execute command and display output in real-time
    $descriptorspec = array(
        0 => array("pipe", "r"), // stdin
        1 => array("pipe", "w"), // stdout
        2 => array("pipe", "w")  // stderr
    );
    
    $process = proc_open($command, $descriptorspec, $pipes);
    
    if (is_resource($process)) {
        // Close stdin
        fclose($pipes[0]);
        
        // Read stdout
        while ($line = fgets($pipes[1])) {
            echo htmlspecialchars($line);
            flush();
        }
        
        // Read stderr
        while ($line = fgets($pipes[2])) {
            echo htmlspecialchars($line);
            flush();
        }
        
        // Close pipes
        fclose($pipes[1]);
        fclose($pipes[2]);
        
        // Close process
        $return_value = proc_close($process);
        echo "\nProcess returned: $return_value";
    } else {
        echo "Failed to execute command";
    }
    
    echo "</pre>";
    
    // Clean up
    unlink($tempFile);
    rmdir($tempDir . '/.config/rmapi');
    rmdir($tempDir . '/.config');
    rmdir($tempDir);
    
    echo "<p>Temporary files cleaned up.</p>";
    exit;
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>rmapi Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        pre {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>rmapi Test</h1>
    <p>This page tests uploading PDFs to reMarkable using rmapi directly.</p>
    
    <form method="post" enctype="multipart/form-data">
        <div>
            <label for="pdf_file">Select PDF File:</label>
            <input type="file" id="pdf_file" name="pdf_file" accept=".pdf" required>
        </div>
        <div style="margin-top: 10px;">
            <button type="submit">Upload and Test</button>
        </div>
    </form>
</body>
</html>