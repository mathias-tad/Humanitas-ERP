#!/bin/bash

# Humanitas Auto-Deployment Script (IP Only)

echo "==========================================="
echo "   Humanitas VPS Setup (IP-Based)"
echo "==========================================="

# 1. Check for Dependencies
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v nginx &> /dev/null; then
    echo "⚠️  Nginx not found. Installing Nginx..."
    sudo apt update && sudo apt install nginx -y
fi

# 2. Detect Public IP
echo ""
echo "🔍 Detecting Public IP..."
DETECTED_IP=$(curl -s ifconfig.me)

if [ -z "$DETECTED_IP" ]; then
    echo "⚠️  Could not auto-detect IP."
    read -p "   Please enter your VPS Public IP: " PUBLIC_IP
else
    echo "   Detected IP: $DETECTED_IP"
    read -p "   Use this IP? (y/n): " CONFIRM
    if [[ "$CONFIRM" != "y" ]]; then
        read -p "   Enter correct IP: " PUBLIC_IP
    else
        PUBLIC_IP=$DETECTED_IP
    fi
fi

echo ""
echo "✅ Using IP: $PUBLIC_IP"
echo ""

# 3. Generate Secrets
echo "🔑 Generating Secure Secrets..."
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH=$(openssl rand -base64 64)
COOKIE_SECRET=$(openssl rand -base64 32)

# 4. Create .env File
echo "📝 Creating .env file..."
cat > .env <<EOF
# ============================================================================
# AUTO-GENERATED CONFIGURATION
# ============================================================================

# Database (Local)
DATABASE_URL=postgresql://humanitas_user:YourStrongPassword123!@172.17.0.1:5432/humanitas

# Security Secrets
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH
COOKIE_SECRET=$COOKIE_SECRET

# Application URLs (IP-Based)
FRONTEND_URL=http://$PUBLIC_IP
ADMIN_FRONTEND_URL=http://$PUBLIC_IP:8080

# API URLs
ADMIN_BACKEND_URL=http://admin-api:3000/api/v1
ADMIN_API_URL=http://$PUBLIC_IP/api/v1
TENANT_API_URL=http://$PUBLIC_IP/tenant/v1
SOCKET_URL=http://$PUBLIC_IP
PYTHON_API_URL=http://$PUBLIC_IP/calc

# CORS Configuration
CORS_ORIGINS=http://$PUBLIC_IP,http://$PUBLIC_IP:8080

# Environment Settings
NODE_ENV=production
DEBUG=false
EOF

# 5. Generate Nginx Config
echo "⚙️  Generating Nginx configuration (humanitas.conf)..."
cat > humanitas.conf <<EOF
# =========================================================
# TENANT APP & API GATEWAY (PORT 80)
# =========================================================
server {
    listen 80 default_server;
    server_name _; 

    # 1. Tenant Frontend
    location / {
        proxy_pass http://localhost:1300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # 2. Admin API Proxy
    location /api/v1/ {
        proxy_pass http://localhost:3000/api/v1/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # 3. Tenant API Proxy
    location /tenant/v1/ {
        proxy_pass http://localhost:3001/api/v1/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        
        # WebSocket Support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 4. Socket.IO (Notifications)
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    # 5. Python Calculation Service
    location /calc/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host \$host;
    }
}

# =========================================================
# ADMIN APP (PORT 8080)
# =========================================================
server {
    listen 8080;
    server_name _;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }
}
EOF

# 6. Setup Instructions
echo ""
echo "==========================================="
echo "   ✅ Setup Complete!"
echo "==========================================="
echo ""
echo "Next Steps:"
echo "1. Apply Nginx Configuration:"
echo "   sudo mv humanitas.conf /etc/nginx/sites-available/humanitas"
echo "   sudo ln -s /etc/nginx/sites-available/humanitas /etc/nginx/sites-enabled/"
echo "   sudo rm /etc/nginx/sites-enabled/default"
echo "   sudo nginx -t && sudo systemctl restart nginx"
echo ""
echo "2. Start Application:"
echo "   docker-compose down"
echo "   docker-compose build"
echo "   docker-compose up -d"
echo ""
echo "3. Access your apps at:"
echo "   👉 Tenant: http://$PUBLIC_IP"
echo "   👉 Admin:  http://$PUBLIC_IP:8080"
