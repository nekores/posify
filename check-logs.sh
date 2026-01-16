#!/bin/bash
# Script to run Posify app with logs visible in terminal

APP_PATH="/Applications/Posify.app/Contents/MacOS/Posify"

if [ ! -f "$APP_PATH" ]; then
    echo "App not found at: $APP_PATH"
    echo "Please update the APP_PATH in this script to point to your app location"
    exit 1
fi

echo "Starting Posify with logs..."
echo "=================================="
echo ""

# Run the app - all console.log statements will appear here
"$APP_PATH"

