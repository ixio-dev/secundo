#!/bin/sh
# Packed with secundo - https://github.com/ixio/secundo

set -eu

# --- configuration (injected by secundo pack) ---
APP_ID="__SECUNDO_APP_ID__"
APP_PAYLOAD_HASH="__SECUNDO_PAYLOAD_HASH__"
PUBKEY_B64="__SECUNDO_PUBKEY_B64__"
SIGNATURE_B64="__SECUNDO_SIGNATURE_B64__"
ENTRY="__SECUNDO_ENTRY__"
INTERPRETER="__SECUNDO_INTERPRETER__"
INTERPRETER_ARGS_JSON='__SECUNDO_INTERPRETER_ARGS__'
# -------------------------------------------------

# Derived
HOME_DIR="${HOME:-/root}"
SECUNDO_HOME="${HOME_DIR}/.secundo/lib"
INSTALL_DIR="${SECUNDO_HOME}/${APP_ID}/${APP_PAYLOAD_HASH}"
TMPDIR="${TMPDIR:-/tmp}"
SELF="$0"
MARKER="__SECUNDO_PAYLOAD__"
ORIGINAL_PWD="$(pwd)"

err() {
    printf '%s\n' "secundo: $*" 1>&2
}

safe_mkdirp() {
    # mkdir -p but fail if cannot create
    if ! mkdir -p "$1"; then
        err "cannot create directory $1"
        exit 1
    fi
}

# find the line number where the payload begins
_payload_start_line() {
    awk -v marker="$MARKER" '{
      if ($0 == marker) { print NR + 1; exit }
    }' "$SELF"
}

# compute sha256 (hex, lowercase) of payload (base64 stream after marker)
_compute_payload_sha256_hex() {
    start=$( _payload_start_line )
    if [ -z "$start" ]; then
        err "payload marker not found in $SELF"
        return 1
    fi

    # Tail from marker line to EOF, decode base64, compute sha256
    # Use sha256sum if available, otherwise use openssl dgst -sha256
    if command -v sha256sum >/dev/null 2>&1; then
        tail -n +"$start" "$SELF" | base64 -d 2>/dev/null | sha256sum | awk '{print $1}'
    else
        # openssl fallback: prints "(stdin)= <hex>"
        tail -n +"$start" "$SELF" | base64 -d 2>/dev/null | openssl dgst -sha256 | awk '{print $2}'
    fi
}

# extract payload to a target directory (creates dir if needed)
_extract_payload_to() {
    target="$1"
    start=$( _payload_start_line )
    if [ -z "$start" ]; then
        err "payload marker not found"
        return 1
    fi

    # decode -> gunzip -> tar -x into target
    # pipe failures will cause script to exit due to set -e
    tail -n +"$start" "$SELF" \
        | base64 -d \
        | gzip -d \
        | tar -xf - -C "$target"
}

# write temp files for pubkey, signature
_write_pub_and_sig() {
    pubkey_file="$1/pubkey.pem"
    sig_file="$1/sig.bin"
    tmp_raw="$1/pubkey.raw"

    # Decode raw Ed25519 public key (32 bytes)
    printf '%s' "$PUBKEY_B64" | base64 -d > "$tmp_raw" 2>/dev/null || {
        err "failed to decode public key"
        return 1
    }

    # Create PEM file: ASN.1 prefix + raw key, then base64 encode the whole thing
    # ASN.1 prefix for Ed25519 public key: 302a300506032b6570032100 (12 bytes)
    {
        echo "-----BEGIN PUBLIC KEY-----"
        {
            printf '\x30\x2a\x30\x05\x06\x03\x2b\x65\x70\x03\x21\x00'
            cat "$tmp_raw"
        } | base64
        echo "-----END PUBLIC KEY-----"
    } > "$pubkey_file" 2>/dev/null || {
        err "failed to create PEM public key"
        return 1
    }

    rm -f "$tmp_raw"

    # Decode signature (64 bytes for Ed25519)
    printf '%s' "$SIGNATURE_B64" | base64 -d > "$sig_file" 2>/dev/null || {
        err "failed to decode embedded signature"
        return 1
    }

    echo "$pubkey_file" "$sig_file"
}

_verify_signature() {
    # Best-effort signature verification using openssl's pkeyutl (Ed25519 support
    # requires a relatively recent OpenSSL). If openssl is not available or the
    # verification command fails, this function returns non-zero.
    #
    # Signature scheme used by packer:
    #   sign( SHA256(manifest.json) || SHA256(payload-bytes) )
    #
    # We reconstruct the same input and ask openssl to verify the detached signature.
    tmp="$1"
    pubkey_file="$tmp/pubkey.pem"
    sig_file="$tmp/sig.bin"
    manifest_file="$2"   # path to .secundo/manifest.json inside extracted dir

    # compute manifest sha256 (binary)
    openssl dgst -sha256 -binary "$manifest_file" > "$tmp/manifest.sha" 2>/dev/null || return 2

    # compute payload sha256 (binary). We already have the payload hash HEX (APP_PAYLOAD_HASH).
    # convert hex -> binary using printf %b with escape sequences
    printf '%b' "$(printf '%s' "$APP_PAYLOAD_HASH" | sed 's/\(..\)/\\x\1/g')" > "$tmp/payload.sha" 2>/dev/null || {
        # fallback: compute actual binary sha256 by decoding the payload stream
        start=$( _payload_start_line )
        tail -n +"$start" "$SELF" | base64 -d 2>/dev/null | openssl dgst -sha256 -binary -out "$tmp/payload.sha" 2>/dev/null || return 2
    }

    # concat manifest.sha || payload.sha
    cat "$tmp/manifest.sha" "$tmp/payload.sha" > "$tmp/combined.sha"

    # Try pkeyutl verify with -rawin (required for Ed25519 - uses raw message, not digest)
    if command -v openssl >/dev/null 2>&1; then
        if openssl pkeyutl -verify -pubin -inkey "$pubkey_file" -sigfile "$sig_file" -rawin -in "$tmp/combined.sha" >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    fi

    return 2
}

# ensure presence of decode tools
for cmd in base64 gzip tar awk; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        err "required tool '$cmd' not found in PATH"
        exit 1
    fi
done

# If already installed, reuse
if [ -d "$INSTALL_DIR" ]; then
    # run directly from existing install
    cd "$INSTALL_DIR" || { err "cannot cd to $INSTALL_DIR"; exit 1; }
    # run the entrypoint with interpreter
    # interpreter args is a JSON array; try to eval it safely
    case "$INTERPRETER_ARGS_JSON" in
        'null'|'') INTERPRETER_ARGS_LIST=;;
        *) INTERPRETER_ARGS_LIST=$(printf '%s' "$INTERPRETER_ARGS_JSON" | sed -e 's/^\[//' -e 's/\]$//' -e 's/","/","/g' -e 's/^"//' -e 's/"$//' -e 's/","/" "/g');;
    esac

    # exec interpreter with args, passing original PWD via environment
    # shellcheck disable=SC2086
    SECUNDO_ORIGINAL_PWD="$ORIGINAL_PWD" exec $INTERPRETER $INTERPRETER_ARGS_LIST "$ENTRY" "$@"
fi

# Installation path does not exist: extract and verify

# create parent directory for install
safe_mkdirp "$(dirname "$INSTALL_DIR")"
# use a temporary extraction dir to avoid partial installs on failure
TMP_EXTRACT_DIR="$(mktemp -d "${TMPDIR%/}/secundo-extract-XXXX")" || {
    err "cannot create temporary directory"
    exit 1
}

# extract into tmp dir
if ! _extract_payload_to "$TMP_EXTRACT_DIR"; then
    err "failed to extract payload"
    rm -rf "$TMP_EXTRACT_DIR"
    exit 1
fi

# sanity: ensure manifest exists
MANIFEST_PATH="$TMP_EXTRACT_DIR/.secundo/manifest.json"
if [ ! -f "$MANIFEST_PATH" ]; then
    err "manifest not found in payload"
    rm -rf "$TMP_EXTRACT_DIR"
    exit 1
fi

# signature verification
# The manifest inside the payload is unsigned (no signature/publicKey fields).
# We verify: SHA256(manifest.json) || SHA256(payload-hash) using signature from stub.
TMP_SIG_DIR="$(mktemp -d "${TMPDIR%/}/secundo-sig-XXXX")" || TMP_SIG_DIR="$TMP_EXTRACT_DIR"

# Write public key and signature to temp files
_write_pub_and_sig "$TMP_SIG_DIR" >/dev/null || {
    err "failed to prepare signature verification files"
    rm -rf "$TMP_EXTRACT_DIR"
    [ "$TMP_SIG_DIR" != "$TMP_EXTRACT_DIR" ] && rm -rf "$TMP_SIG_DIR" || true
    exit 1
}

# Temporarily disable exit-on-error for verification (we handle the error ourselves)
set +e
_verify_signature "$TMP_SIG_DIR" "$MANIFEST_PATH"
sig_status=$?
set -e

# Clean up signature temp dir if different from extract dir
[ "$TMP_SIG_DIR" != "$TMP_EXTRACT_DIR" ] && rm -rf "$TMP_SIG_DIR" 2>/dev/null || true

if [ $sig_status -eq 0 ]; then
    : # signature valid
elif [ $sig_status -eq 1 ]; then
    err "signature verification failed - the executable may be corrupted or tampered with"
    rm -rf "$TMP_EXTRACT_DIR"
    exit 1
else
    # openssl not available or verification could not be completed
    err "warning: signature verification unavailable (openssl not found or unsupported)"
    err "warning: proceeding without verification - use at your own risk"
fi

# move tmp extract into final install dir atomically
if ! mv "$TMP_EXTRACT_DIR" "$INSTALL_DIR"; then
    # fallback: copy then remove
    cp -a "$TMP_EXTRACT_DIR" "$INSTALL_DIR" || {
        err "failed to move extracted files to $INSTALL_DIR"
        rm -rf "$TMP_EXTRACT_DIR"
        exit 1
    }
    rm -rf "$TMP_EXTRACT_DIR"
fi

# set permissions (best-effort)
find "$INSTALL_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
find "$INSTALL_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true

# optional create symlink current -> version
safe_mkdirp "${SECUNDO_HOME}/${APP_ID}"
ln -sfn "${APP_PAYLOAD_HASH}" "${SECUNDO_HOME}/${APP_ID}/current" 2>/dev/null || true

# run the entrypoint
cd "$INSTALL_DIR" || { err "cannot cd to $INSTALL_DIR"; exit 1; }

case "$INTERPRETER_ARGS_JSON" in
    'null'|'') INTERPRETER_ARGS_LIST=;;
    *) INTERPRETER_ARGS_LIST=$(printf '%s' "$INTERPRETER_ARGS_JSON" | sed -e 's/^\[//' -e 's/\]$//' -e 's/^"//' -e 's/"$//' -e 's/","/" "/g');;
esac

# exec interpreter with args, passing original PWD via environment
# shellcheck disable=SC2086
SECUNDO_ORIGINAL_PWD="$ORIGINAL_PWD" exec $INTERPRETER $INTERPRETER_ARGS_LIST "$ENTRY" "$@"

exit 0

__SECUNDO_PAYLOAD__
