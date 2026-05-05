#!/bin/bash

DATE=$(date '+%Y-%m-%d %H:%M')

if [ -z "$1" ]; then
  COMMIT_MSG="$DATE"
else
  COMMIT_MSG="$DATE - $1"
fi

git add .
git commit -m "$COMMIT_MSG"
git push
