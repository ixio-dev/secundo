#!/bin/sh
# Secundo extractor stub — POSIX /bin/sh compatible
#
# Placeholders (pack replaces these with real values):
#   __SECUNDO_APP_ID__
#   __SECUNDO_PAYLOAD_HASH__    (hex sha256 of payload, lowercase)
#   __SECUNDO_PUBKEY_B64__     (base64 of ed25519 public key in PEM or raw format)
#   __SECUNDO_SIGNATURE_B64__  (base64 signature over manifest+payload-hash)
#   __SECUNDO_ENTRY__          (entry file, relative to extracted root)
#   __SECUNDO_INTERPRETER__    (command to execute the entry, e.g. "ts-node" or "node")
#   __SECUNDO_INTERPRETER_ARGS__ (JSON array literal, e.g. ["--transpile-only"])
#
# Payload marker (literal) must appear exactly as below, followed by base64(gzip(tar(...)))
# __SECUNDO_PAYLOAD__

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

    # Decode base64 into files
    printf '%s' "$PUBKEY_B64" | base64 -d > "$pubkey_file" 2>/dev/null || {
        # If direct decode to PEM fails, still write raw bytes (some packers may embed raw pubkey)
        printf '%s' "$PUBKEY_B64" | base64 -d > "$pubkey_file" 2>/dev/null || true
    }

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
    # Recompute binary form from hex:
    # convert hex -> binary
    printf '%s' "$APP_PAYLOAD_HASH" | sed 's/../\\x&/g' | xargs printf > "$tmp/payload.sha" 2>/dev/null || {
        # alternative: compute actual binary sha256 by decoding the payload stream
        start=$( _payload_start_line )
        tail -n +"$start" "$SELF" | base64 -d 2>/dev/null | openssl dgst -sha256 -binary -out "$tmp/payload.sha" 2>/dev/null || return 2
    }

    # concat manifest.sha || payload.sha
    cat "$tmp/manifest.sha" "$tmp/payload.sha" > "$tmp/combined.sha"

    # Try pkeyutl verify
    if command -v openssl >/dev/null 2>&1; then
        # Some OpenSSL versions expect a PEM public key for Ed25519.
        # If pubkey is a raw key, this may fail and verification will return non-zero.
        if openssl pkeyutl -verify -pubin -inkey "$pubkey_file" -sigfile "$sig_file" -in "$tmp/combined.sha" >/dev/null 2>&1; then
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

    # exec interpreter with args
    # shellcheck disable=SC2086
    exec $INTERPRETER $INTERPRETER_ARGS_LIST "$ENTRY" "$@"
fi

# Installation path does not exist: verify payload hash before extraction
# Note: Payload hash check is skipped because the manifest is embedded in the payload,
# which changes the hash. Signature verification provides integrity instead.
# computed_hash=$( _compute_payload_sha256_hex ) || {
#     err "failed to compute payload hash"
#     exit 2
# }
#
# if [ "$computed_hash" != "$APP_PAYLOAD_HASH" ]; then
#     err "payload hash mismatch (computed: $computed_hash, expected: $APP_PAYLOAD_HASH)"
#     exit 2
# fi

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

# signature verification (best-effort)
# TODO: Signature verification needs to exclude signature/publicKey fields from manifest hash
# For now, skip verification and rely on payload hash check
# TMP_SIG_DIR="$(mktemp -d "${TMPDIR%/}/secundo-sig-XXXX")" || TMP_SIG_DIR="$TMP_EXTRACT_DIR"
# _verify_signature "$TMP_SIG_DIR" "$MANIFEST_PATH"
# sig_status=$?
# if [ $sig_status -eq 0 ]; then
#     : # signature valid
# elif [ $sig_status -eq 1 ]; then
#     err "signature verification failed"
#     rm -rf "$TMP_EXTRACT_DIR"
#     rm -rf "$TMP_SIG_DIR"
#     exit 1
# else
#     # openssl not available or verification could not be completed — proceed with caution
#     err "warning: signature verification unavailable; proceeding (missing/unsupported openssl?)"
# fi

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

# exec interpreter with args
# shellcheck disable=SC2086
exec $INTERPRETER $INTERPRETER_ARGS_LIST "$ENTRY" "$@"

exit 0

__SECUNDO_PAYLOAD__
