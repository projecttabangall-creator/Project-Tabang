#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/project-tabang}"
WEBAPP_URL="${WEBAPP_URL:-https://project-tabang---claude-code.web.app}"
PI_USER="${PI_USER:-$USER}"
PYTHON_BIN="${PYTHON_BIN:-}"
CHROMIUM_BIN="${CHROMIUM_BIN:-}"
INSTALL_LOCAL_FRONTEND="${INSTALL_LOCAL_FRONTEND:-0}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Project directory not found: $PROJECT_DIR"
  exit 1
fi

if [ -z "$PYTHON_BIN" ]; then
  if [ -x "$PROJECT_DIR/fingerprint-service/.venv/bin/python" ]; then
    PYTHON_BIN="$PROJECT_DIR/fingerprint-service/.venv/bin/python"
  else
    PYTHON_BIN="/usr/bin/python3"
  fi
fi

if [ -z "$CHROMIUM_BIN" ]; then
  CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium || true)"
fi

if [ -z "$CHROMIUM_BIN" ]; then
  echo "Chromium was not found. Install it with: sudo apt-get install -y chromium-browser"
  exit 1
fi

sudo tee /etc/systemd/system/tabang-fingerprint.service >/dev/null <<EOF
[Unit]
Description=Project Tabang Fingerprint Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$PROJECT_DIR/fingerprint-service
EnvironmentFile=$PROJECT_DIR/fingerprint-service/.env
ExecStart=$PYTHON_BIN app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if [ "$INSTALL_LOCAL_FRONTEND" = "1" ]; then
  sudo tee /etc/systemd/system/tabang-frontend.service >/dev/null <<EOF
[Unit]
Description=Project Tabang Local Frontend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/env npx serve -s packages/frontend/dist -l 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
fi

mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/tabang-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Project Tabang Kiosk
Exec=$CHROMIUM_BIN --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 $WEBAPP_URL
X-GNOME-Autostart-enabled=true
EOF

chmod +x "$HOME/.config/autostart/tabang-kiosk.desktop"

if ! grep -q "raspi-login-update-prompt.sh" "$HOME/.bashrc"; then
  cat >> "$HOME/.bashrc" <<EOF

# Ask before pulling Project Tabang updates whenever an interactive terminal logs in.
if [ -t 0 ] && [ -x "$PROJECT_DIR/scripts/raspi-login-update-prompt.sh" ]; then
  "$PROJECT_DIR/scripts/raspi-login-update-prompt.sh"
fi
EOF
fi

sudo systemctl daemon-reload
sudo systemctl enable tabang-fingerprint
sudo systemctl restart tabang-fingerprint

if [ "$INSTALL_LOCAL_FRONTEND" = "1" ]; then
  sudo systemctl enable tabang-frontend
  sudo systemctl restart tabang-frontend
fi

echo "Installed Project Tabang kiosk boot setup."
echo "Fingerprint service: sudo systemctl status tabang-fingerprint"
if [ "$INSTALL_LOCAL_FRONTEND" = "1" ]; then
  echo "Local frontend: sudo systemctl status tabang-frontend"
fi
echo "Kiosk URL: $WEBAPP_URL"
echo "Reboot to test Chromium autostart: sudo reboot"
