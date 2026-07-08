# Deploying the WalletCare API with HTTPS

The Vercel frontend is served over HTTPS, so the browser refuses to call the
API over plain HTTP (`Mixed Content` error). The fix is to put the API behind
HTTPS. This guide uses **Caddy** as a reverse proxy on the droplet — it gets and
auto-renews a free Let's Encrypt certificate with almost no config.

Droplet IP: `142.93.216.4` · API runs on port `5000`.

---

## 1. Point a domain at the droplet

Create a DNS **A record** with your DNS provider:

```
api.yourdomain.com   ->   142.93.216.4
```

Wait until it resolves (`ping api.yourdomain.com` shows the droplet IP).
No domain? See "No domain?" at the bottom.

## 2. Install Caddy (Ubuntu)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 3. Configure Caddy

Copy `deploy/Caddyfile` from this repo to `/etc/caddy/Caddyfile`, replacing
`api.yourdomain.com` with your real subdomain, then reload:

```bash
sudo nano /etc/caddy/Caddyfile      # or scp the file up and edit the domain
sudo systemctl reload caddy
```

That's the whole config:

```
api.yourdomain.com {
    reverse_proxy 127.0.0.1:5000
}
```

## 4. Open the firewall for HTTP/HTTPS

Caddy needs 80 (for the ACME challenge) and 443 (HTTPS):

```bash
sudo ufw allow 80
sudo ufw allow 443
```

Optional hardening: the API no longer needs to be reachable directly, so you
can stop exposing 5000 publicly (Caddy reaches it via localhost):

```bash
sudo ufw deny 5000
```

## 5. Keep the API running (pm2)

If it isn't already managed, run it under pm2 so it survives reboots/crashes:

```bash
sudo npm i -g pm2
cd /path/to/My-Wallet-Care-API
pm2 start src/server.js --name walletcare-api
pm2 save
pm2 startup      # run the command it prints
```

## 6. Point the frontend at the HTTPS API

In the **Vercel project → Settings → Environment Variables**, set:

```
NEXT_PUBLIC_API_URL = https://api.yourdomain.com/api
```

Then **redeploy** the frontend (env vars only take effect on a new build).

CORS already allows your `*.vercel.app` origins, so no backend env change is
needed. Verify:

```bash
curl -i https://api.yourdomain.com/api/health          # -> {"status":"ok"}
```

Log in on the Vercel site — the Mixed Content error is gone.

---

## No domain?

Two options:

- **Get one** — a cheap domain (or a free subdomain from a dynamic-DNS
  provider) is enough; point its A record at `142.93.216.4` and follow the
  steps above. This is the recommended production path.
- **Cloudflare Tunnel** — gives the droplet an HTTPS hostname without opening
  ports or managing certs. Requires a domain added to a (free) Cloudflare
  account. Ask and I'll write those steps instead.

For throwaway testing only, `cloudflared tunnel --url http://localhost:5000`
prints a temporary `https://<random>.trycloudflare.com` URL — but it changes
every run, so it's not suitable for a real deployment.
