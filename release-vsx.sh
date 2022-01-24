#!/usr/bin/env bash

# Add the release token to .env as variable TOKEN. Like this:
# TOKEN=my_token

if [ ! -f .env ]; then
    echo ".env file not found!"
    exit 1
fi

# ugly hax to read .env file
export $(grep -v '^#' .env | xargs -d '\n')

DIRTY_VER=$(cat package.json | grep \"version\")
VER=$(node release-vsx-helper.js $DIRTY_VER)

DIRTY_NAME=$(cat package.json | grep \"name\")
NAME=$(node release-vsx-helper.js $DIRTY_NAME)

COMMAND="npx ovsx publish $NAME-$VER.vsix -p $TOKEN"

echo
echo "NAME: $NAME"
echo "VERSION: $VER"
echo "TOKEN: $TOKEN"
echo
echo "This command will be run:"
echo
echo $COMMAND
echo
read -p "Is that okay? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
  echo "DOING RELEASE"
  echo
  echo
  echo
  $COMMAND
fi