# reMarkable Web Tools

**reMarkable Web Tools** is a lightweight web-based GUI that enables users to manage and interact with their reMarkable tablet through a browser. It includes:

- ✅ Upload and manage custom **templates**
- ✅ View and replace **system screen images** (e.g., sleeping, poweroff)
- ✅ Edit the raw **configuration file** directly
- ✅ Upload documents via the **reMarkable Cloud API**

---

## 🚀 Features

- **Web-based interface** — no app install required
- **Template manager** — upload and organize custom PNG templates
- **System image replacer** — customize default tablet screens
- **Config editor** — modify tablet settings with safety validation
- **Document uploader** — send PDFs via API, right from the browser
- **Secure auth** — API login and SSH credentials handled in-browser
- **Local IP & Password** — configurable via hamburger menu

---

## 📦 Requirements

- **PHP** (any recent version with built-in server support)
- [`rmapi`](https://github.com/ddvk/rmapi) — reMarkable CLI tool  
  Must be installed and available in your system `$PATH`

---

## 🛠️ Installation & Usage

### Option 1: Local Launch (Development Use)

Use the included script:

```bash
./run.sh
```

- This launches a PHP web server at [http://localhost:6500](http://localhost:6500)
- The tool will open automatically in your default browser
- All data is stored locally unless uploading via API

---

### Option 2: Add to Existing Web Server

If you already have a PHP-enabled web server (e.g., Apache or Nginx), simply place the `remarkable-web-tools` folder into your web root.

> ⚠️ **Important:** Outside the Cloud API, your reMarkable device must be on the **same local network** as the server. SSH-based actions (e.g., editing system images or config) will not work remotely.

---

## 🔐 Authentication & Setup

To connect to your reMarkable device:

1. Click the **☰ hamburger menu** in the top-left corner of the interface.
2. Enter:
   - Your **local IP address** of the reMarkable device
   - Your **device password** (used for SSH)
3. If uploading via the Cloud API:
   - Click **"Authenticate with reMarkable"**
   - Follow the browser-based login flow

---
