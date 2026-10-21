# Deployment saat ini: Cloudflare Workers + static assets

Screenshot dashboard menunjukkan proyek `smsku` menggunakan Workers Builds, bukan Pages. Repository kini menyertakan `worker.mjs` dan `wrangler.jsonc` agar API berjalan sebagai Worker, sehingga bindings D1 dan secrets dapat ditambahkan.

Pertahankan deploy command `npx wrangler deploy`. Build command di dashboard boleh tetap kosong: Wrangler menjalankan `node scripts/prepare-assets.mjs` dari konfigurasi sebelum deployment. Skrip menyalin hanya aset website ke `dist`; modul backend, tes, dan panduan tidak dipublikasikan sebagai file statis.

Setelah deployment berhasil, muat ulang Settings. Pesan "Bindings cannot be added to a Worker that only has static assets" seharusnya tidak muncul lagi. Tambahkan D1 binding `SMS_DB` dan secrets gateway. Label menu Workers dapat berbeda dari panduan Pages di bawah. Setelah membuat binding melalui dashboard, sinkronkan ID database ke `d1_databases` dalam konfigurasi Wrangler agar deployment berikutnya mempertahankannya; jangan mengganti binding database produksi dengan placeholder.

`keep_vars: true` mempertahankan variabel teks yang dikelola melalui dashboard; secrets tetap disimpan di Cloudflare. Itu bukan pengganti deklarasi D1 binding. Tidak ada credential ditanam di kode.

Validasi lokal: `node scripts/prepare-assets.mjs`, `node tests/worker.test.mjs`, `node tests/cloud-sms.test.mjs`. Deployment langsung dan pengaturan akun Cloudflare masih memerlukan tindakan pengguna.

---

# SMSKU Cloud SMS — setup lewat HP, tanpa PC

Mode utama menerima SMS dari SIM sendiri melalui SMSGate Cloud webhooks. Tidak perlu tunnel atau PC. Cloudflare Pages Functions dan database D1 harus dikonfigurasi; mengunggah kode ke GitHub saja belum mengaktifkan penerimaan SMS.

## 1. HP Android
Aktifkan Cloud Server dan Start on boot di SMSGate. Pakai kredensial Cloud Server, bukan Local Server. Buka Settings → Webhooks → Signing Key. Simpan nilai itu di Cloudflare, bukan di chat atau GitHub. Jika kredensial pernah terekspos, ganti terlebih dahulu sesuai pengaturan aplikasi.

## 2. Cloudflare dari browser HP
- Buat D1 database bernama `smsku-sms` di bagian Storage & databases → D1 (nama menu dapat berubah).
- Buka Workers & Pages → smsku → Settings → Bindings. Tambahkan D1 binding dengan nama variabel `SMS_DB`, pilih database `smsku-sms`.
- Tambahkan konfigurasi Production berikut di Variables and Secrets; simpan credential sebagai Secret:

| Nama | Isi |
| --- | --- |
| SMSKU_ACCESS_TOKEN | Kode akses pribadi acak minimal 32 karakter; dibuat sendiri, bukan password provider |
| SMSGATE_CLOUD_USER | Username di bagian Cloud Server aplikasi |
| SMSGATE_CLOUD_PASSWORD | Password Cloud Server aplikasi (Secret) |
| SMSGATE_DEVICE_ID | Device ID pada bagian Cloud Server |
| SMSGATE_SIGNING_KEY | Nilai Settings → Webhooks → Signing Key (Secret) |
| SMSGATE_NUMBER | Nomor SIM sebenarnya dalam format +62… |
| SMSKU_PUBLIC_URL | https://sms.purbalink.web.id (opsional jika memakai domain ini) |

`SMS_DB` adalah binding D1, bukan variabel teks. Perubahan binding/secrets memerlukan redeploy. Proyek harus mendukung Pages Functions; upload statis saja tidak cukup.

## 3. Daftarkan gateway
Setelah deployment sukses, buka website → SMS → masukkan SMSKU_ACCESS_TOKEN → klik **Hubungkan Cloud SMS**. Server membuat tabel dan mendaftarkan webhook `sms:received` untuk perangkat yang dipilih. Kredensial provider tidak pernah dikirim ke browser. Tidak perlu menyalin SQL atau menjalankan terminal. Setup berulang memeriksa webhook yang sama sebelum mendaftarkan lagi.

## 4. Uji SMS nyata
Tunggu sinkronisasi Cloud Server. Kirim SMS percobaan biasa ke SIM. Di SMSKU klik **Hubungkan & baca SMS**. Deteksi OTP membaca isi pesan yang diterima; hasil angka adalah kandidat, bukan jaminan OTP. SMS diperbarui manual, sedangkan email tetap diperiksa otomatis. Pendaftaran sukses belum membuktikan SMS berhasil diterima.

Jika belum muncul: periksa SMSGate Settings → Webhooks → Registered webhooks dan Webhook Queue. Respons 401 biasanya menandakan Signing Key/waktu HP tidak cocok. Respons 403 menunjukkan Device ID tidak cocok. Respons 503 menunjukkan D1 atau konfigurasi belum siap. HP memerlukan internet dan izin SMS.

## Penyimpanan dan keamanan
Webhook memverifikasi HMAC-SHA256 dari body asli + X-Timestamp, menerima waktu dalam rentang ±5 menit, dan membatasi perangkat. Retry dideduplikasi dengan pasangan device ID dan envelope event ID. Pesan tujuh hari terakhir tersedia melalui API privat; baris lama dibersihkan saat webhook SMS berikutnya masuk (tanpa webhook baru, data lama tetap berada di database sampai dibersihkan). Isi SMS tidak dimasukkan ke service-worker cache. Nomor, SIM, internet, dan kuota Cloudflare tetap mengikuti biaya masing-masing layanan.

SMS Cloud diprioritaskan sebelum jalur lokal/berbayar. Inbox kosong tidak memicu cadangan berbayar. Tidak ada pembelian nomor, isi saldo, pengiriman SMS, atau ekspor riwayat lama otomatis. Jalur lokal dan cadangan Twilio sebelumnya tetap tersedia.

## Validasi
`node tests/cloud-sms.test.mjs` (Node 24+) menguji signature, batas waktu, perangkat yang salah, format payload, deduplikasi, inbox privat, serta registrasi webhook dan setup berulang dengan SQLite asli dan API mock. Pengujian perangkat nyata/Cloudflare belum dilakukan dari lingkungan ini.

Referensi: https://docs.sms-gate.app/features/webhooks/ dan https://developers.cloudflare.com/pages/functions/bindings/

---

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
