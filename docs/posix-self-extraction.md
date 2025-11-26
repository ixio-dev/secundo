```shell
#!/bin/sh

set -eu

APP_HOME="${HOME}/.secundo/lib"
APP_ID="__SECUNDO_APP_ID__"
APP_HASH="__SECUNDO_PAYLOAD_HASH__"
INTERPRETER="__SECUNDO_INTERPRETER__"
ENTRY="__SECUNDO_ENTRY__"
INTERPRETER_ARGS="__SECUNDO_INTERPRETER_ARGS__"
PUBKEY="__SECUNDO_PUBKEY_B64__"
SIGNATURE="__SECUNDO_SIGNATURE_B64__"

INSTALL_DIR="${APP_HOME}/${APP_ID}/${APP_HASH}"

verify_signature() {
    # Tooling required: openssl or minisign; choose logic at build time.
    # Here: openssl + ed25519.
    echo "$SIGNATURE" | base64 -d > "$TMPDIR/sig.bin"
    printf "%s" "$MANIFEST_JSON" | openssl dgst -sha256 -binary > "$TMPDIR/manifest.sha"
    printf "%s" "$PAYLOAD_BLOB" | openssl dgst -sha256 -binary > "$TMPDIR/payload.sha"
    cat "$TMPDIR/manifest.sha" "$TMPDIR/payload.sha" > "$TMPDIR/combined.sha"
    printf "%s" "$PUBKEY" | base64 -d > "$TMPDIR/pubkey.bin"
    openssl pkeyutl -verify -pubin -inkey "$TMPDIR/pubkey.bin" \
        -sigfile "$TMPDIR/sig.bin" -rawin -in "$TMPDIR/combined.sha"
}

extract_payload() {
    mkdir -p "$INSTALL_DIR"

    # Payload begins after marker
    PAYLOAD_START=$(awk '/^__SECUNDO_PAYLOAD__$/ {print NR + 1; exit; }' "$0")
    tail -n +$PAYLOAD_START "$0" \
        | base64 -d \
        | gzip -d \
        | tar -xf - -C "$INSTALL_DIR"
}

if [ ! -d "$INSTALL_DIR" ]; then
    extract_payload
fi

cd "$INSTALL_DIR"

exec "$INTERPRETER" $INTERPRETER_ARGS "$ENTRY" "$@"

exit 0

__SECUNDO_PAYLOAD__
```


```
+---------------------------------------------------------------+
| POSIX sh stub (text)                                          |
| with placeholders replaced:                                   |
|   APP_ID, HASH, PUBKEY, SIGNATURE, ENTRY, INTERPRETER, etc.  |
+---------------------------------------------------------------+
| newline                                                       |
| literal marker line: "__SECUNDO_PAYLOAD__"                    |
| newline                                                       |
+---------------------------------------------------------------+
| BASE64(GZIP(TAR(projectFiles)))                               |
| (continuous base64 stream until EOF)                          |
+---------------------------------------------------------------+
```

Manifest is stored inside the tar root as:

`.secundo/manifest.json`

This ensures:
- It is included in signed content
- Users can open the .sec file and extract it manually
- The extractor stub does not depend on external metadata

### Payload tar layout example:

```
/
  src/
     main.ts
  lib/
  assets/
  secundo.spec     # optional
  .secundo/
       manifest.json
```

