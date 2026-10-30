#!/bin/sh
# Run from the project root (the folder that contains package.json).
rm -fv src/routes/_authed/calendar_v2.tsx \
       src/routes/_authed/clients/clients.index.tsx \
       src/package.json \
       src/.npmrc
