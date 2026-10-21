# SMSKU ID — Personal SMS & temporary inbox PWA

Static responsive app for Cloudflare Pages. No build command; publish repository root.

## Implemented
- Responsive layout, Icons8 Fluency icons, light/dark theme.
- Temporary inbox via Mail.tm: create address, copy, list/read plain text messages, delete individual messages, load subsequent pages.
- Automatic inbox refresh every 20 seconds while the page is visible and online.
- Numeric OTP candidates from subjects/previews and opened message bodies; copy buttons. These are heuristic candidates, not guaranteed OTPs.
- Session token in sessionStorage to restore access on reload in the same tab. No password stored; closing the tab may end local access. Clearing a session does not delete the provider account.
- Install prompt where supported, browser-menu instructions otherwise; offline interface cache. Email and SMS require connectivity.

## Not integrated
SMS reception needs a real provider number or an owned SIM gateway, authenticated server endpoints, and provider credentials stored as server secrets. No number is fabricated. No SMS subscription or purchase is performed by this app.

Mail.tm is a receive-only integration here. Sending email requires another provider and a verified sender; there is no simulated send button.

## Deployment
Push to the Cloudflare-linked branch. Set framework to None, no build command, repository root as static output. Custom domain: sms.purbalink.web.id. Actual deployment must be checked in Cloudflare.

## Verification
Node syntax checks and mocked behavior checks for DELETE 204, rate-limit errors, OTP deduplication, pagination, session clearing and DOM bindings. Live Mail.tm delivery, SMS delivery, browser installation, and Cloudflare deployment were not verified in this environment.

## Credits
Interface icons: https://icons8.com
Temporary email service: https://mail.tm
