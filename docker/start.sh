#!/bin/bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php-fpm -D
nginx -g "daemon off;"