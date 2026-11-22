<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword
{
    /**
     * Same URL (token + email) and same expiry as Laravel's default;
     * only the email design changes.
     */
    protected function buildMailMessage($url): MailMessage
    {
        $expire = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('Reset your ForestTrack password')
            ->view(
                ['mail.password-reset', 'mail.password-reset-text'], // html, plain-text
                ['url' => $url, 'expire' => $expire],
            );
    }
}