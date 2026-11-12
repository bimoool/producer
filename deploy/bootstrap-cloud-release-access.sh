#!/usr/bin/env bash
# Installs only the cloud release SSH public key. Does not modify applications.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Run in the VPS root console.' >&2; exit 1; }
[ ! -L /root/.ssh ] && [ ! -L /root/.ssh/authorized_keys ] || { echo 'Unexpected SSH symlink; stop for review.' >&2; exit 1; }
umask 077
mkdir -p /root/.ssh
touch /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
entry='restrict ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC6dOoH3MHGhFZNV+I6CNhwGSledmRGguwVwrndlnSxC producer-release-5963019 '
entry="${entry% }"
if ! grep -qxF -- "$entry" /root/.ssh/authorized_keys; then
  printf '%s\n' "$entry" >> /root/.ssh/authorized_keys
fi
printf '%s\n' 'Release public key installed. Existing keys retained.'
printf '%s\n' 'Public server identity for VPS_KNOWN_HOSTS (not a secret):'
printf '192.241.141.47 '
cut -d ' ' -f 1,2 /etc/ssh/ssh_host_ed25519_key.pub
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
