# Cloudflare DNS Manager

A small self-hosted web UI for managing DNS records across your Cloudflare zones, with a built-in **dynamic DNS updater** that keeps selected `A` records pointed at your current public IP. Useful for home servers on a residential connection whose IP changes.

- Browse every zone in your account and its DNS records; create, edit and delete records
- Flip a toggle on any `A` record to put it under **auto-update**: it is re-pointed to your public IPv4 address whenever that changes (checked every 1–1440 minutes)
- Select records and update them to your current IP in one click
- Self-healing: if a managed record is deleted and recreated in Cloudflare, it is found again by name
- Update log of every change the updater made
- One Node.js process, no database, no Docker. The server itself has zero npm dependencies

## Requirements

- **Node.js 20 or newer.** Check with `node -v`. Install from [nodejs.org](https://nodejs.org), with `brew install node`, or with [nvm](https://github.com/nvm-sh/nvm).
- A Cloudflare account with at least one domain using Cloudflare DNS.

## 1. Create a Cloudflare API token

The app talks to Cloudflare with a scoped API token. It never needs your Global API Key; don't use it.

1. Log in to the Cloudflare dashboard and open **My Profile → API Tokens**: <https://dash.cloudflare.com/profile/api-tokens>
2. Click **Create Token**.
3. Next to **Edit zone DNS**, click **Use template**.
4. Under **Permissions**, keep `Zone` · `DNS` · `Edit`, then click **+ Add more** and add `Zone` · `Zone` · `Read`. This lets the app list your domains.
5. Under **Zone Resources**, choose which domains the app may touch:
   - `Include` · `All zones` for everything, or
   - `Include` · `Specific zone` · *your domain* (add one row per domain) to limit it.
6. Leave **Client IP Address Filtering** empty. Your IP changes, which is the point of this tool.
7. Click **Continue to summary**, then **Create Token**.
8. **Copy the token now.** Cloudflare shows it only once. If you lose it, roll or recreate it from the same page.

Check that the token works:

```bash
curl -s https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer PASTE_YOUR_TOKEN_HERE"
```

You should see `"success": true` and `"status": "active"`.

## 2. Install and run

```bash
git clone https://github.com/cassioiks/cloudflare-manager.git
cd cloudflare-manager

cp .env.example .env
chmod 600 .env          # only your user can read the token
# Open .env in an editor and paste your token after CF_API_TOKEN=

npm install             # build tools for the web UI
npm run build           # builds the UI into dist/
npm start
```

Open <http://localhost:5480>.

The first auto-update check runs about 5 seconds after startup, then on the configured interval. Stop the server with `Ctrl+C`.

## 3. Use it

1. Each domain appears as a card listing its DNS records.
2. On an `A` record, flip the toggle in the **Auto** column. From now on the updater keeps that record pointed at your public IP.
3. Use the **Auto-Update Schedule** panel to change how often it checks, or turn auto-update off.
4. The **Public IP** banner at the top shows your current IP and warns when a managed record doesn't match it.
5. To fix records right away, tick them (or click **Select all A**), then click **Update IP (n)**.
6. The **Update Log** at the bottom lists every change the updater made.

To create a record already pointed at your IP, click **+ Add Record**, choose type `A` and click **My IP**. That fills in your IP and ticks **Auto-update IP**.

## Configuration

All settings live in `.env`. Variables set in the real environment (shell, systemd, launchd) take precedence over `.env`.

| Variable        | Default     | Description |
|-----------------|-------------|-------------|
| `CF_API_TOKEN`  | *(required)*| Cloudflare API token from step 1. |
| `PORT`          | `5480`      | Port for the web UI. |
| `HOST`          | `127.0.0.1` | Address to listen on. `127.0.0.1` means this machine only. Use `0.0.0.0` to allow other devices on your network. |
| `BASIC_AUTH`    | *(empty)*   | `user:password`. When set, the UI and API ask for these credentials. |
| `ALLOWED_HOSTS` | *(empty)*   | Comma-separated hostnames allowed when `BASIC_AUTH` is not set (see below). |
| `DATA_DIR`      | `./data`    | Where state is stored. |

### Accessing it from other devices

The UI can change your DNS, so it only listens on `127.0.0.1` by default. To use it from your laptop or phone while it runs on a home server:

```ini
HOST=0.0.0.0
BASIC_AUTH=admin:a-long-random-password
```

Then open `http://<server-ip>:5480` and log in.

Without `BASIC_AUTH`, the server only answers requests addressed to `localhost` or an IP address. This blocks [DNS rebinding](https://en.wikipedia.org/wiki/DNS_rebinding) attacks from malicious websites. To reach it by a hostname such as `homeserver.local`, either set `BASIC_AUTH` or add the name to `ALLOWED_HOSTS`.

Do not port-forward this app to the internet. For remote access, use a VPN such as Tailscale or WireGuard, or put it behind Cloudflare Access.

## Run it in the background

### Linux (systemd)

Create `/etc/systemd/system/cloudflare-manager.service`, replacing the user and paths (find Node's path with `which node`):

```ini
[Unit]
Description=Cloudflare DNS Manager
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/cloudflare-manager
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflare-manager
journalctl -u cloudflare-manager -f      # view logs
```

### macOS (launchd)

Create `~/Library/LaunchAgents/local.cloudflare-manager.plist`, replacing the paths (find Node's path with `which node`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>local.cloudflare-manager</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>server/index.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/youruser/cloudflare-manager</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/youruser/Library/Logs/cloudflare-manager.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/youruser/Library/Logs/cloudflare-manager.log</string>
</dict>
</plist>
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.cloudflare-manager.plist   # start now and at login
launchctl bootout   gui/$(id -u)/local.cloudflare-manager                                 # stop and unload
tail -f ~/Library/Logs/cloudflare-manager.log                                             # view logs
```

A Mac that is asleep can't update DNS. For always-on use, run it on a machine that stays awake, such as a Raspberry Pi, NAS or home server.

## Updating

```bash
git pull
npm install
npm run build
# then restart: Ctrl+C and `npm start`, or
# sudo systemctl restart cloudflare-manager, or
# launchctl kickstart -k gui/$(id -u)/local.cloudflare-manager
```

### Coming from the Docker version (1.x)

The data format is unchanged. Stop the container with `docker compose down` and keep the `data/` folder where it is. Your token moves from the Compose environment into `.env`. Then follow step 2. If you used to open the UI from another machine, also set `HOST=0.0.0.0` and `BASIC_AUTH`.

## How it works

- **Public IP:** asks `api.ipify.org`, then `ifconfig.me`, then `icanhazip.com`, and uses the first valid IPv4 address.
- **Auto-update:** on every tick, each managed record whose last known value differs from the current IP is updated (`PUT`) to type `A`, the new IP and TTL 120, keeping its proxied setting. If Cloudflare returns 404 because the record was recreated, the app looks it up by name and retries once.
- **State:** `data/config.json` holds managed records, the schedule and the last IP. `data/update_log.json` holds the last 100 updates. The token is read from `.env` and never written anywhere else.

```
frontend/            React + Tailwind UI (built into dist/ by Vite)
server/index.js      HTTP server: JSON API, static files, auth
server/cloudflare.js Cloudflare API client
server/updater.js    Public IP lookup and the auto-update scheduler
server/store.js      Reads and writes data/*.json
server/env.js        Loads .env
```

### Development

Run these in two terminals:

```bash
npm run dev:server   # API on :5480, restarts on changes
npm run dev          # UI on http://localhost:5173 with hot reload, proxies /api to :5480
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CF_API_TOKEN is not set` | `.env` is missing or not in the project folder, or the token line is empty. |
| `Invalid API Token` or `Authentication error` | The token was mistyped, expired or deleted. Run the `curl` check from step 1. |
| No domains appear | The token lacks `Zone · Zone · Read`, or its Zone Resources don't include those domains. Edit the token in the Cloudflare dashboard. |
| `The UI has not been built yet` | Run `npm run build`, then restart. |
| `Host "…" is not allowed` | You opened it by hostname without `BASIC_AUTH`. Set `BASIC_AUTH` or add the hostname to `ALLOWED_HOSTS`. |
| `Port 5480 is already in use` | Set another `PORT` in `.env`. |
| `Could not determine public IP` | The machine has no internet access, or the IP services are blocked by a firewall or DNS filter. |
| IPv6 / `AAAA` records | Not supported by auto-update. Only `A` records (IPv4) are kept in sync. |

## License

[MIT](LICENSE)
