#!/bin/bash

# Run migrations and cache
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Start queue worker in background
php artisan queue:work --daemon --tries=3 &

# Start scheduler in background
php artisan schedule:work &

# Start PHP-FPM in background
php-fpm -D

# Start Nginx in foreground (keeps container alive)
nginx -g "daemon off;"