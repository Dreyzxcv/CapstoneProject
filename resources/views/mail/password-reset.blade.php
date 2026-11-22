@php
    $logoPath = public_path('images/foresttrack-logo.png');
    // Embedded (CID) so the logo shows even on localhost / private networks.
    // Falls back to an absolute URL when rendered outside a real send (previews, tests).
    $logo = isset($message) && file_exists($logoPath)
        ? $message->embed($logoPath)
        : asset('images/foresttrack-logo.png');
@endphp
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <title>Reset your ForestTrack password</title>
    <style>
        body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
        img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
        @media only screen and (max-width: 620px) {
            .container { width: 100% !important; }
            .px { padding-left: 22px !important; padding-right: 22px !important; }
            .btn-table { width: 100% !important; }
            .btn { display: block !important; text-align: center !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#F6FAF7;">

{{-- Preheader (inbox preview text) --}}
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F6FAF7;">
    Use this link to set a new password. It expires in {{ $expire }} minutes.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F6FAF7" style="background-color:#F6FAF7;">
    <tr>
        <td align="center" style="padding:32px 12px;">

            <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

                {{-- Card --}}
                <tr>
                    <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #E2EDE6;border-radius:12px;overflow:hidden;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                            {{-- Accent bar --}}
                            <tr>
                                <td height="4" bgcolor="#059669" style="height:4px;line-height:4px;font-size:0;background-color:#059669;">&nbsp;</td>
                            </tr>

                            {{-- Brand header (soft green, like the GuestLayout logo panel) --}}
                            <tr>
                                <td align="center" bgcolor="#F6FAF7" style="background-color:#F6FAF7;border-bottom:1px solid #E2EDE6;padding:28px 24px 24px 24px;">
                                    <img src="{{ $logo }}" alt="ForestTrack" width="72" style="display:block;margin:0 auto;border:0;width:72px;height:auto;">
                                    <div style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:26px;font-weight:bold;color:#166534;">
                                        ForestTrack
                                    </div>
                                    <div style="padding-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:#6b7f72;">
                                        DENR-PENRO Catanduanes
                                    </div>
                                </td>
                            </tr>

                            {{-- Body --}}
                            <tr>
                                <td class="px" style="padding:36px 40px 12px 40px;font-family:Arial,Helvetica,sans-serif;">
                                    <h1 style="margin:0 0 14px 0;font-size:22px;line-height:30px;font-weight:bold;color:#14532d;">Hello,</h1>

                                    <p style="margin:0 0 28px 0;font-size:15px;line-height:24px;color:#475569;">
                                        We received a request to reset the password for your ForestTrack account.
                                        Click the button below to choose a new password.
                                    </p>

                                    {{-- Button --}}
                                    <table role="presentation" class="btn-table" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
                                        <tr>
                                            <td align="center" bgcolor="#166534" style="background-color:#166534;border-radius:8px;">
                                                <a href="{{ $url }}" class="btn" target="_blank"
                                                   style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">
                                                    Reset Password
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    {{-- Expiry notice --}}
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                                        <tr>
                                            <td bgcolor="#F6FAF7" style="background-color:#F6FAF7;border:1px solid #E2EDE6;border-left:4px solid #059669;border-radius:6px;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#166534;">
                                                This link will expire in <strong>{{ $expire }} minutes</strong>.
                                            </td>
                                        </tr>
                                    </table>

                                    {{-- Security note --}}
                                    <p style="margin:0 0 28px 0;font-size:14px;line-height:22px;color:#475569;">
                                        <strong style="color:#14532d;">Didn&rsquo;t request this?</strong>
                                        You can safely ignore this email and your password will stay the same.
                                        If you keep receiving these emails, please contact your System Administrator.
                                    </p>
                                </td>
                            </tr>

                            {{-- Fallback URL --}}
                            <tr>
                                <td class="px" style="padding:0 40px 36px 40px;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td style="border-top:1px solid #E2EDE6;padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#64748b;">
                                                If the button doesn&rsquo;t work, copy and paste this link into your browser:
                                                <br>
                                                <a href="{{ $url }}" target="_blank" style="color:#059669;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">{{ $url }}</a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>

                {{-- Footer --}}
                <tr>
                    <td align="center" style="padding:24px 16px 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7f72;">
                        ForestTrack &middot; DENR-PENRO Catanduanes<br>
                        &copy; {{ now()->year }} ForestTrack. All rights reserved.
                    </td>
                </tr>
            </table>

        </td>
    </tr>
</table>
</body>
</html>