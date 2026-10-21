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

## Hybrid SMS (free first)
Cloudflare Pages Function: functions/api/sms.js. Redeploy as a Pages project supporting Functions; direct static-only upload does not run this endpoint.

1. Install SMS Gateway for Android from https://sms-gate.app on your own phone with an active SIM. Enable Local Server and the required SMS permissions. Test GET /inbox locally using the app's username/password.
2. Expose ONLY the gateway service to your Cloudflare Function through a protected HTTPS tunnel. A private LAN address such as 192.168.x.x cannot be reached directly by Cloudflare. Keep gateway Basic authentication enabled; use a dedicated phone if you do not want other SMS previews to appear.
3. Add Cloudflare Pages environment variables/secrets and redeploy:
   - SMSKU_ACCESS_TOKEN: a long random private access code (at least 32 random characters). Enter this code in the app; never enter provider credentials in the browser.
   - SMSGATE_URL: HTTPS base URL reaching the Android Local Server, without /inbox.
   - SMSGATE_USER, SMSGATE_PASSWORD: gateway credentials (secrets).
   - SMSGATE_NUMBER: your actual SIM number.
4. Optional paid fallback: configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (secret), TWILIO_NUMBER. Use an already provisioned, SMS-capable receiving number. This code never buys a number, sends messages or tops up a balance. Availability of Indonesian numbers and acceptance by OTP senders are not guaranteed.
5. Select Gratis dahulu to use only the SIM. Hybrid requires confirmation for every paid-enabled read; the SIM is always attempted first. An empty free inbox never triggers paid fallback. Provider errors may trigger fallback only after consent. Carrier/SIM, data, hosting quotas and provider fees may still apply.

SMSGate /inbox returns contentPreview; long SMS content may be truncated. SMS OTP extraction applies only to the returned preview. Refresh SMS manually with the connection button. Email polling remains automatic.

The access code protects the SMS API. Use HTTPS, keep the code private, and rotate it through Cloudflare when needed. SMS responses are never stored in the service worker cache. The UI does not retain the access code across reloads.

SMS adapter behavior has mock tests for authentication, default free routing, no fallback on an empty free inbox, paid consent, provider failure fallback and no-store responses. Real devices/providers and Cloudflare deployment remain unverified until configured.
