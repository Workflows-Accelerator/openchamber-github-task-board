# Chromium environment for this sandbox, rebuilt from Debian bookworm packages.
#
# The installed Chromium 156 headless shell needs 20 shared libraries and a
# fontconfig configuration that this container does not ship
# (`libglib-2.0.so.0: cannot open shared object file`, then
# `FATAL: SkFontMgr_FontConfigInterface.cpp:163 Not implemented`). Both are
# supplied by extracting the Debian packages under /tmp/opencode; nothing is
# installed into the system, and the workspace is not modified.
#
# Usage:  source scripts/browser-env.sh   (from verifications/V4-2/)
LIBROOT=/tmp/opencode/v4-2-libs
DEBIAN=https://deb.debian.org/debian

export LD_LIBRARY_PATH="$LIBROOT/root/usr/lib/x86_64-linux-gnu:$LIBROOT/root/lib/x86_64-linux-gnu"
export FONTCONFIG_FILE="$LIBROOT/fonts.conf"
export H2_CHROME=/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell

if [ ! -f "$LIBROOT/root/usr/lib/x86_64-linux-gnu/libglib-2.0.so.0" ]; then
  mkdir -p "$LIBROOT/root" "$LIBROOT/fontcache"
  curl -s -o "$LIBROOT/Packages.gz" "$DEBIAN/dists/bookworm/main/binary-amd64/Packages.gz"
  gunzip -c "$LIBROOT/Packages.gz" > "$LIBROOT/Packages"
  for pkg in libglib2.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxrandr2 libxrender1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 \
    libdbus-1-3 libgbm1 libdrm2 libnspr4 libnss3 libxkbcommon0 libcairo2 libpango-1.0-0 \
    libpixman-1-0 libfontconfig1 libfreetype6 libuuid1 libxau6 libxdmcp6 libbsd0 libmd0 \
    libselinux1 libpcre2-8-0 libffi8 libgcrypt20 libgpg-error0 libsystemd0 liblzma5 \
    libzstd1 liblz4-1 libcap2 libmount1 libblkid1 libacl1 libattr1 libwayland-server0 \
    libwayland-client0 libxi6 fonts-dejavu-core; do
    file=$(awk -v pkg="$pkg" 'BEGIN{RS="";FS="\n"} {name="";ver="";f="";for(i=1;i<=NF;i++){if($i~/^Package: /)name=substr($i,10);else if($i~/^Version: /)ver=substr($i,10);else if($i~/^Filename: /)f=substr($i,11)} if(name==pkg && ver !~ /-dbg/)print f}' "$LIBROOT/Packages" | head -1)
    [ -n "$file" ] && curl -s -o "$LIBROOT/pkg.deb" "$DEBIAN/$file" && dpkg-deb -x "$LIBROOT/pkg.deb" "$LIBROOT/root"
  done
  cat > "$LIBROOT/fonts.conf" <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$LIBROOT/root/usr/share/fonts</dir>
  <cachedir>$LIBROOT/fontcache</cachedir>
  <match target="pattern"><edit name="dpi" mode="assign"><double>96</double></edit></match>
</fontconfig>
EOF
fi
