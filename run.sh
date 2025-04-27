#!/bin/bash

# Launch PHP built-in server in the background
php -S localhost:6500

# Optional: Wait briefly to ensure server starts before opening browser
sleep 1

# Launch default browser in a new window
xdg-open "http://localhost:6500"
