# Humanitas VPS Deployment Guide

Complete guide to deploy Humanitas on your own VPS with local PostgreSQL database.

---

## Table of Contents

1. [VPS Requirements](#1-vps-requirements)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Install Dependencies](#3-install-dependencies)
4. [Setup PostgreSQL Database](#4-setup-postgresql-database)
5. [Prepare Application](#5-prepare-application)
6. [Configure Environment](#6-configure-environment)
7. [Deploy with Docker](#7-deploy-with-docker)
8. [Setup Domain & SSL](#8-setup-domain--ssl)
9. [Monitoring & Maintenance](#9-monitoring--maintenance)
10. [Troubleshooting](#10-troubleshooting)
11. [Optional AI Setup](#11-optional-ai-setup)

---

## 1. VPS Requirements

### Minimum Specifications
- **OS**: Ubuntu 22.04 LTS (recommended)
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 100 Mbps

### Recommended for Production
- **CPU**: 8 cores
- **RAM**: 16 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps

### Supported VPS Providers
- DigitalOcean
- Linode
- Vultr
- AWS EC2
- Google Cloud
- Azure
- Any Ubuntu-based VPS

---

## 2. Initial Server Setup

### Step 1: Connect to Your VPS

```bash
ssh root@your-vps-ip
```

### Step 2: Create a New User (Security Best Practice)

```bash
# Create user
adduser humanitas

# Add to sudo group
usermod -aG sudo humanitas

# Switch to new user
su - humanitas
```

### Step 3: Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Step 4: Setup Firewall

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 3. Install Dependencies

### Step 1: Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install prerequisites
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y

# Add Docker's GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io -y

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker ${USER}

# Verify installation
docker --version
```

**Logout and login again** for group changes to take effect.

### Step 2: Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### Step 3: Install Git

```bash
sudo apt install git -y
git --version
```

### Step 4: Install Nginx (For SSL/Reverse Proxy)

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 4. Setup PostgreSQL Database

### Step 1: Install PostgreSQL 15

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Add GPG key
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Install PostgreSQL
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15 -y

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

### Step 2: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL prompt, run these commands:
```

```sql
-- Create database
CREATE DATABASE humanitas;

-- Create user with strong password
CREATE USER humanitas_user WITH ENCRYPTED PASSWORD 'YourStrongPassword123!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE humanitas TO humanitas_user;

-- Grant schema privileges
\c humanitas
GRANT ALL ON SCHEMA public TO humanitas_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO humanitas_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO humanitas_user;

-- Exit
\q
```

### Step 3: Configure PostgreSQL for Local Connections

```bash
# Edit postgresql.conf
# sudo -u postgres psql -c "SHOW config_file;" checks the route of the file
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Find and modify:
```conf
listen_addresses = 'localhost'  # Listen on localhost only
max_connections = 200            # Increase connections
shared_buffers = 2GB             # Adjust based on your RAM (25% of RAM)
```

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add this line (for local Docker connections):
```conf
# Docker containers
host    all             all             172.17.0.0/16           md5
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Step 4: Test Connection

```bash
# Test connection
psql -h localhost -U humanitas_user -d humanitas -W

# If successful, exit with:
\q
```

### Step 5: Setup Connection String

Your DATABASE_URL will be:
```
postgresql://humanitas_user:YourStrongPassword123!@172.17.0.1:5432/humanitas
```

**Note**: `172.17.0.1` is the Docker host IP from container perspective.

---

## 5. Prepare Application

### Step 1: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone your repository
git clone https://github.com/yourusername/Humanitas.git
cd Humanitas
```

**If using private repository**:
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Display public key
cat ~/.ssh/id_ed25519.pub

# Add this key to GitHub → Settings → SSH Keys
# Then clone with SSH
git clone git@github.com:yourusername/Humanitas.git
```

### Step 2: Verify Files

```bash
# Check docker-compose.yml exists
ls -la docker-compose.yml

# Check Dockerfiles exist
ls -la humanitas_frontend/Dockerfile
ls -la tenant-admin_frontend/Dockerfile
ls -la humanitas_backend/admin-backend/Dockerfile
ls -la humanitas_backend/tenant-backend/main_rest_apis/Dockerfile
ls -la humanitas_backend/tenant-backend/calculation_service/Dockerfile
```

---

## 6. Configure Environment

### Step 1: Create Production `.env` File

```bash
cd ~/Humanitas
nano .env
```

Paste this configuration:

```env
# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
# Local PostgreSQL on VPS (172.17.0.1 is Docker host from container)
DATABASE_URL=postgresql://humanitas_user:YourStrongPassword123!@172.17.0.1:5432/humanitas

# ============================================================================
# SECURITY SECRETS (CHANGE THESE!)
# ============================================================================
JWT_SECRET=change-this-to-a-long-random-string-minimum-32-characters
JWT_REFRESH_SECRET=another-long-random-string-for-refresh-tokens-64-chars
COOKIE_SECRET=yet-another-random-string-for-cookies-at-least-32-chars

# ============================================================================
# DOMAIN CONFIGURATION (Update with your domain)
# ============================================================================
FRONTEND_URL=https://yourdomain.com
ADMIN_FRONTEND_URL=https://admin.yourdomain.com

# API URLs (internal Docker network)
ADMIN_BACKEND_URL=http://admin-api:3000/api/v1
ADMIN_API_URL=https://api.yourdomain.com/api/v1
TENANT_API_URL=https://api.yourdomain.com/tenant/v1
SOCKET_URL=https://api.yourdomain.com

# ============================================================================
# CORS ORIGINS (Update with your domains)
# ============================================================================
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com,https://api.yourdomain.com

# ============================================================================
# OPTIONAL SETTINGS
# ============================================================================
BCRYPT_SALT_ROUNDS=12
NODE_ENV=production
DEBUG=false
```

**Save**: `Ctrl+X`, then `Y`, then `Enter`

### Step 2: Generate Strong Secrets

```bash
# Generate random secrets
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 64  # Use for JWT_REFRESH_SECRET
openssl rand -base64 32  # Use for COOKIE_SECRET
```

Copy these values into your `.env` file.

### Step 3: Secure the `.env` File

```bash
chmod 600 .env
```

---

## 7. Deploy with Docker

### Step 1: Update docker-compose for Local Database

Your `docker-compose.yml` should already be configured from previous steps. Verify the DATABASE_URL uses `172.17.0.1`.

### Step 2: Build and Start Services

```bash
cd ~/Humanitas

# Build all images (first time will take 10-20 minutes)
docker-compose build

# Start all services
docker-compose up -d

# Check running containers
docker ps
```

**Expected output**: 8 containers running
- admin-frontend
- tenant-frontend
- admin-api
- tenant-api
- tenant-worker
- python-api
- python-worker
- humanitas-nginx

### Step 3: Check Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker logs tenant-api -f

# Check for errors
docker-compose logs | grep -i error
```

### Step 4: Verify Database Connection

```bash
# Check tenant-api can connect to database
docker logs tenant-api | grep -i "database\|connection"

# Should see: "Database connection established" or similar
```

### Step 5: Initialize Database (First Time Only)

If your app has migrations:

```bash
# Run migrations for admin backend
docker exec admin-api npm run migration:run

# Run migrations for tenant backend
docker exec tenant-api npm run migration:run
```

---

## 8. Setup Domain & SSL

### Step 1: Point Domain to VPS

In your domain registrar (GoDaddy, Namecheap, etc.):

**Add A Records**:
```
Type    Name        Value (Your VPS IP)
A       @           203.0.113.45
A       www         203.0.113.45
A       admin       203.0.113.45
A       api         203.0.113.45
```

Wait 5-10 minutes for DNS propagation.

**Verify**:
```bash
dig yourdomain.com
dig admin.yourdomain.com
```

### Step 2: Install Certbot (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Step 3: Obtain SSL Certificates

```bash
# Stop nginx temporarily
sudo systemctl stop nginx

# Get certificates for all domains
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com -d api.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Share email? (Optional)
```

Certificates will be saved in `/etc/letsencrypt/live/yourdomain.com/`

### Step 4: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/humanitas
```

Paste this complete configuration:

```nginx
# Tenant Frontend
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:1300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin Frontend
server {
    listen 80;
    listen [::]:80;
    server_name admin.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Gateway
server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Admin API
    location /admin/ {
        proxy_pass http://localhost:3000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Tenant API
    location /tenant/ {
        proxy_pass http://localhost:3001/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Python API
    location /calc/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Replace** `yourdomain.com` with your actual domain.

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/humanitas /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 5: Auto-Renew SSL Certificates

```bash
# Test renewal
sudo certbot renew --dry-run

# Setup auto-renewal (already configured by certbot)
sudo systemctl status certbot.timer
```

---

## 9. Monitoring & Maintenance

### Setup Process Monitoring

#### Install PM2 Alternative for Docker

```bash
# Create restart script
nano ~/restart-services.sh
```

```bash
#!/bin/bash
cd ~/Humanitas
docker-compose up -d
```

```bash
chmod +x ~/restart-services.sh
```

#### Setup Auto-Start on Reboot

```bash
sudo nano /etc/systemd/system/humanitas.service
```

```ini
[Unit]
Description=Humanitas Application
After=docker.service postgresql.service
Requires=docker.service postgresql.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/humanitas/Humanitas
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=humanitas

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl daemon-reload
sudo systemctl enable humanitas.service

# Test it
sudo systemctl start humanitas.service
sudo systemctl status humanitas.service
```

### Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/docker-containers
```

```conf
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
```

### Database Backups

```bash
# Create backup script
nano ~/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/humanitas/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump humanitas > $BACKUP_DIR/humanitas_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "humanitas_*.sql" -mtime +7 -delete

echo "Backup completed: humanitas_$DATE.sql"
```

```bash
chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add line:
```cron
0 2 * * * /home/humanitas/backup-db.sh >> /home/humanitas/backup.log 2>&1
```

### Monitoring Commands

```bash
# Check all services
docker ps

# Check resource usage
docker stats

# View logs
docker-compose logs -f tenant-worker

# Check disk space
df -h

# Check memory
free -h

# Check PostgreSQL
sudo systemctl status postgresql
```

---

## 10. Troubleshooting

### Issue: Container Won't Start

```bash
# Check logs
docker logs container-name

# Rebuild
docker-compose up -d --build container-name

# Check database connection
docker exec tenant-api env | grep DATABASE
```

### Issue: Can't Connect to Database

```bash
# From VPS, test connection
psql -h 172.17.0.1 -U humanitas_user -d humanitas

# Check PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Issue: SSL Not Working

```bash
# Test nginx config
sudo nginx -t

# Check certificates
sudo certbot certificates

# Renew manually
sudo certbot renew
```

### Issue: Out of Disk Space

```bash
# Clean old Docker images
docker system prune -a

# Check disk usage
du -sh /var/lib/docker
```

### Issue: High Memory Usage

```bash
# Check what's using memory
docker stats

# Restart specific service
docker-compose restart tenant-api
```

---

## Quick Reference Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart service
docker-compose restart tenant-api

# Rebuild and restart
docker-compose up -d --build

# Check status
docker ps

# Database backup
~/backup-db.sh

# Update application
cd ~/Humanitas
git pull
docker-compose up -d --build

# Check nginx
sudo nginx -t
sudo systemctl restart nginx
```

---

## Post-Deployment Checklist

- [ ] All 8 containers running (`docker ps`)
- [ ] Database accessible from containers
- [ ] SSL certificates installed and working
- [ ] Domain names pointing to VPS
- [ ] Automatic SSL renewal configured
- [ ] Database backups scheduled
- [ ] Auto-start on reboot enabled
- [ ] Firewall configured
- [ ] Strong passwords set in `.env`
- [ ] CORS origins updated for production
- [ ] Monitoring setup complete

---

## Security Recommendations

1. **Change default passwords** in PostgreSQL
2. **Use strong JWT secrets** (32+ characters)
3. **Enable automatic security updates**:
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```
4. **Setup fail2ban**:
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```
5. **Regular backups** (automated daily)
6. **Monitor logs** regularly
7. **Keep Docker updated**
8. **Disable root SSH** login

---

## 11. Optional AI Setup

Humanitas includes powerful AI features (database querying, routing, document generation) supporting multiple providers. You can configure this in the Admin Panel -> AI Settings.

### Option A: Cloud Providers (Google/OpenAI/Anthropic)
You do not need to install anything on your VPS for these providers. Simply enter your API Keys in the Admin Dashboard:
- **Google Gemini**: Standard API key from Google AI Studio.
- **OpenAI**: Standard API key from OpenAI Platform.
- **Anthropic**: Standard API key from Anthropic Console.
- **Vertex AI**: This is mapped internally to use the Gemini provider API so no Service Account configuration is required on your VPS, just provide your Vertex-compatible API Key.

### Option B: Local AI (Ollama)
If you want complete data privacy without sending data to third parties, you can run Ollama directly on your VPS.

```bash
# 1. Install Ollama on your VPS
curl -fsSL https://ollama.com/install.sh | sh

# 2. Start the Ollama service
sudo systemctl enable ollama
sudo systemctl start ollama

# 3. Pull the required model (we recommend llama3 for standard setups)
ollama run llama3
```

In the Humanitas Admin Panel, select **Ollama** as your provider and leave the endpoint as `http://localhost:11434`. Note that running Ollama locally requires a VPS with significantly more RAM (16GB+ minimum) and ideally a GPU for acceptable performance.

---

## Summary

✅ **VPS Setup** - Ubuntu server configured  
✅ **Dependencies** - Docker, PostgreSQL installed  
✅ **Database** - PostgreSQL running locally  
✅ **Application** - 8 services deployed  
✅ **SSL** - HTTPS enabled with Let's Encrypt  
✅ **Domain** - Custom domain configured  
✅ **Monitoring** - Auto-restart, backups, logs  
✅ **Security** - Firewall, SSL, strong passwords  

**Your Humanitas application is now running in production on your VPS!** 🚀
