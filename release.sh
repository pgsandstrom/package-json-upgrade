#!/usr/bin/env bash

# Releases the extension to both the VS Code Marketplace and Open VSX.
#
# Add the release tokens to .env.local like this:
# MICROSOFT_RELEASE_TOKEN=my_token
# OPEN_VSX_RELEASE_TOKEN=my_token

set -e

if [ ! -f .env.local ]; then
    echo ".env.local file not found!"
    exit 1
fi

# ugly hax to read .env file (skip comments and blank lines)
export $(grep -v '^#' .env.local | grep -v '^[[:space:]]*$' | xargs -d '\n')

if [ -z "$MICROSOFT_RELEASE_TOKEN" ]; then
    echo "MICROSOFT_RELEASE_TOKEN not set in .env.local!"
    exit 1
fi

if [ -z "$OPEN_VSX_RELEASE_TOKEN" ]; then
    echo "OPEN_VSX_RELEASE_TOKEN not set in .env.local!"
    exit 1
fi

DIRTY_VER=$(cat package.json | grep \"version\")
VER=$(node release-helper.js $DIRTY_VER)

DIRTY_NAME=$(cat package.json | grep \"name\")
NAME=$(node release-helper.js $DIRTY_NAME)

VSIX="$NAME-$VER.vsix"

echo
echo "NAME: $NAME"
echo "VERSION: $VER"
echo "VSIX: $VSIX"
echo
echo "This will:"
echo "  1. Package the extension into $VSIX"
echo "  2. Publish $VSIX to the VS Code Marketplace"
echo "  3. Publish $VSIX to Open VSX"
echo
read -p "Is that okay? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

echo
echo "PACKAGING"
echo
npx vsce package

echo
echo "PUBLISHING TO VS CODE MARKETPLACE"
echo
npx vsce publish --packagePath "$VSIX" -p "$MICROSOFT_RELEASE_TOKEN"

echo
echo "PUBLISHING TO OPEN VSX"
echo
npx ovsx publish "$VSIX" -p "$OPEN_VSX_RELEASE_TOKEN"

echo
echo "DONE"
