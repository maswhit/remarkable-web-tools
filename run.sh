#!/bin/bash

# Launch PHP built-in server in the background, capture its PID
php -S localhost:6500 > /dev/null 2>&1 &
PHP_PID=$!

# Optional: Wait briefly to ensure server starts before opening browser
sleep 1

# Launch default browser
xdg-open "http://localhost:6500"

# Wait for user to press ENTER to stop server
read -p "Press ENTER to stop the server..."

# Kill the PHP server
kill $PHP_PID
