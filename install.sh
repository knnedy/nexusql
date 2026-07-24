#!/usr/bin/env sh
set -e

REPO="knnedy/nexusql"
BIN_NAME="nexusql"
INSTALL_DIR="/usr/local/bin"

# brand colors (matches NexusQL's teal/coral palette)
TEAL='\033[38;2;93;202;165m'
CORAL='\033[38;2;216;90;48m'
DIM='\033[2m'
RESET='\033[0m'

info()    { printf "${TEAL}  ➜${RESET}  %s\n" "$1"; }
success() { printf "${TEAL}  ✓${RESET}  %s\n" "$1"; }
error()   { printf "${CORAL}  ✗${RESET}  %s\n" "$1"; exit 1; }

printf "\n  ${TEAL}NexusQL${RESET} installer\n\n"

# verify required tools exist
for cmd in curl tar; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    error "Missing required dependency: $cmd"
  fi
done

# detect OS
OS="$(uname -s)"
case "$OS" in
  Linux)  OS="linux" ;;
  Darwin) OS="darwin" ;;
  *)      error "unsupported OS: $OS. Use the Windows .zip release asset instead if applicable." ;;
esac

# detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
  *)       error "unsupported architecture: $ARCH" ;;
esac

info "detected platform: ${OS}/${ARCH}"

# fetch latest version — redirect parsing first, API as fallback
info "fetching latest release..."
VERSION=$(curl -sI "https://github.com/${REPO}/releases/latest" | grep -Fi 'location:' | tr -d '\r' | awk -F/ '{print $NF}')

if [ -z "$VERSION" ]; then
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"tag_name":[[:space:]]*"([^"]+)".*/\1/')"
fi

if [ -z "$VERSION" ]; then
  error "could not determine latest version. check your internet connection."
fi

info "latest version: ${VERSION}"

# build download URL
VERSION_NUM="${VERSION#v}"
FILENAME="${BIN_NAME}_${VERSION_NUM}_${OS}_${ARCH}.tar.gz"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${FILENAME}"

info "downloading ${FILENAME}..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL "$URL" -o "${TMP_DIR}/${FILENAME}" || error "download failed: $URL"

# verify checksum
info "verifying checksum..."
curl -fsSL "https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt" \
  -o "${TMP_DIR}/checksums.txt" || error "failed to download checksums.txt"

(cd "$TMP_DIR" && grep "$FILENAME" checksums.txt | sha256sum -c - >/dev/null 2>&1) \
  || error "checksum verification failed — download may be corrupted"

info "extracting..."
tar -xzf "${TMP_DIR}/${FILENAME}" -C "$TMP_DIR"

# ensure target directory exists before testing write permissions
if [ ! -d "$INSTALL_DIR" ]; then
  info "creating installation directory ${INSTALL_DIR}..."
  sudo mkdir -p "$INSTALL_DIR"
fi

# check if we need sudo to write to install dir
if [ -w "$INSTALL_DIR" ]; then
  mv "${TMP_DIR}/${BIN_NAME}" "${INSTALL_DIR}/${BIN_NAME}"
  chmod +x "${INSTALL_DIR}/${BIN_NAME}"
else
  info "requesting sudo to install to ${INSTALL_DIR}..."
  sudo mv "${TMP_DIR}/${BIN_NAME}" "${INSTALL_DIR}/${BIN_NAME}"
  sudo chmod +x "${INSTALL_DIR}/${BIN_NAME}"
fi

# verify installation using absolute path
if [ -x "${INSTALL_DIR}/${BIN_NAME}" ]; then
  INSTALLED_VERSION=$("${INSTALL_DIR}/${BIN_NAME}" -version 2>/dev/null || echo "$VERSION")

  success "installed: ${INSTALLED_VERSION}"
  success "run ${TEAL}nexusql${RESET} to start"
  printf "\n  ${DIM}to uninstall: sudo rm ${INSTALL_DIR}/${BIN_NAME}${RESET}\n\n"

  case ":$PATH:" in
    *:"$INSTALL_DIR":*) ;;
    *) printf "\n  ${CORAL}  ⚠  ${RESET}${INSTALL_DIR} is not in your PATH. Add it to your shell profile.\n\n" ;;
  esac
else
  error "installation failed — could not execute binary."
fi