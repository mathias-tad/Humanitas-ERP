# Humanitas VPS Deployment Guide (IP Only)

Complete guide to deploy Humanitas on your own VPS **using only an IP address** (no domain name).

---

## 1. Prerequisites
- **VPS** with Public IP Address (e.g., `203.0.113.45`)
- **OS**: Ubuntu 22.04 LTS
- **Ports**: 80, 8080, 22 (SSH)

---

## 2. Initial Setup

### Step 1: Firewall
Allow HTTP and the custom Admin port (8080).

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw enable
```

### Step 2: Install Dependencies
Follow "Install Dependencies" from the main guide (Docker, Git, Nginx).
**SKIP** Certbot installation (SSL requires a domain).

---

## 3. Configure Environment (Automated)

Instead of editing files manually, use the provided setup script which detects your IP and generates all configuration files.

1. **Make the script executable**:
   ```bash
   chmod +x setup_vps.sh
   ```

2. **Run the script**:
   ```bash
   ./setup_vps.sh
   ```

   The script will:
   - Detect your Public IP (and ask for confirmation)
   - Generate secure random secrets for JWT and Cookies
   - Create the `.env` file with the correct IP
   - Generate the `humanitas.conf` Nginx configuration file

---

## 4. Finalize Setup

After running the script, follow the instructions it prints:

1. **Apply Nginx Configuration**:
   ```bash
   sudo mv humanitas.conf /etc/nginx/sites-available/humanitas
   sudo ln -s /etc/nginx/sites-available/humanitas /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

2. **Start Deployment**:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

3. **Verify**:
   - Access **Tenant App**: `http://YOUR_VPS_IP`
   - Access **Admin App**: `http://YOUR_VPS_IP:8080`

---

## Note on Security
Since this setup runs over **HTTP** (no SSL), data is not encrypted in transit. This is fine for testing or internal networks, but **highly unsafe for production** with real user data. Browsers may flag the site as "Not Secure".

---

## Optional AI Setup (Ollama/Google/OpenAI)
If you wish to run the AI system locally with Ollama or via Cloud Providers, refer to **Section 11: Optional AI Setup** in the main `VPS_DEPLOYMENT_GUIDE.md` for instructions.
