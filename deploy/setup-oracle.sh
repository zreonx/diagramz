#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    Diagramz - Oracle Cloud Always Free Setup     "
echo "=================================================="

# 1. Open Oracle Cloud iptables firewall for ports 80 and 443
echo "[1/5] Configuring firewall rules for Oracle Cloud..."
if command -v iptables >/dev/null 2>&1; then
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    if command -v netfilter-persistent >/dev/null 2>&1; then
        sudo netfilter-persistent save 2>/dev/null || true
    fi
fi

# 2. Install Docker & Docker Compose if missing
echo "[2/5] Checking Docker installation..."
if ! command -v docker >/dev/null 2>&1; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "Docker installed successfully."
fi

# 3. Setup production environment file
echo "[3/5] Setting up environment variables..."
if [ ! -f .env.production ]; then
    cp .env.production.example .env.production
    # Generate random secrets for JWT and DB password
    RAND_DB_PASS=$(openssl rand -hex 16)
    RAND_JWT_ACCESS=$(openssl rand -hex 32)
    RAND_JWT_REFRESH=$(openssl rand -hex 32)

    sed -i "s/replace_with_a_secure_random_db_password/$RAND_DB_PASS/" .env.production
    sed -i "s/replace_with_a_64_character_random_hex_string_access/$RAND_JWT_ACCESS/" .env.production
    sed -i "s/replace_with_a_64_character_random_hex_string_refresh/$RAND_JWT_REFRESH/" .env.production

    echo "Generated new .env.production with secure random secrets."
    echo "You can edit .env.production later to set your domain name."
else
    echo ".env.production already exists. Keeping current settings."
fi

# 4. Build and start containers
echo "[4/5] Building and launching containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 5. Wait for API and DB health
echo "[5/5] Waiting for services to initialize..."
sleep 8
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=================================================="
echo " Diagramz API is now running on Oracle Cloud! "
echo " HTTP Endpoint: http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')"
echo "=================================================="
