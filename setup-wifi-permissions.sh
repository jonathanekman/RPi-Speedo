#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-time setup so the dashboard app can control Wi-Fi (NetworkManager) from
# the Network tab without hitting "Not authorized to control networking".
#
#   Run ONCE on the Raspberry Pi:  sudo bash setup-wifi-permissions.sh
#
# It (1) adds your user to the "netdev" group and (2) installs a polkit rule
# granting netdev members permission to control NetworkManager. Both polkit
# backends are covered (JS .rules for polkit >= 0.106, .pkla for older).
# Reboot (or log out/in) afterwards so the group change + rules take effect.
# ---------------------------------------------------------------------------
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo:  sudo bash $0" >&2
  exit 1
fi

# The real (non-root) user the app runs as.
TARGET_USER="${SUDO_USER:-${USER:-pi}}"
echo "Target user: $TARGET_USER"

# 1) Group membership -------------------------------------------------------
usermod -aG netdev "$TARGET_USER"
echo "Added $TARGET_USER to the 'netdev' group."

# 2) polkit JS rule (polkit >= 0.106, e.g. Raspberry Pi OS Bookworm) ---------
RULES_DIR=/etc/polkit-1/rules.d
mkdir -p "$RULES_DIR"
cat > "$RULES_DIR/50-dashboard-networkmanager.rules" <<'EOF'
// Allow members of the "netdev" group to control NetworkManager (scan,
// add/activate/modify/delete connections) without interactive auth.
polkit.addRule(function(action, subject) {
    if (action.id.indexOf("org.freedesktop.NetworkManager.") === 0 &&
        subject.isInGroup("netdev")) {
        return polkit.Result.YES;
    }
});
EOF
echo "Installed polkit JS rule -> $RULES_DIR/50-dashboard-networkmanager.rules"

# 3) polkit .pkla fallback (older polkit "local authority" backend) ----------
PKLA_DIR=/etc/polkit-1/localauthority/50-local.d
mkdir -p "$PKLA_DIR"
cat > "$PKLA_DIR/10-dashboard-networkmanager.pkla" <<'EOF'
[Let netdev group control NetworkManager]
Identity=unix-group:netdev
Action=org.freedesktop.NetworkManager.*
ResultAny=yes
ResultInactive=yes
ResultActive=yes
EOF
echo "Installed polkit .pkla fallback -> $PKLA_DIR/10-dashboard-networkmanager.pkla"

# 4) Reload polkit so the rule is picked up (best effort) --------------------
systemctl restart polkit 2>/dev/null || systemctl restart polkitd 2>/dev/null || true

echo
echo "Done. Reboot (or log out and back in) so the group change takes effect:"
echo "    sudo reboot"
