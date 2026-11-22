# Deployment Guide

This guide covers deploying the Poker Dealer application to a Digital Ocean droplet with Docker, plus notes for other hosts.

## What the app needs in production

Read this before you start. Each item below will stop players from getting into a game if it is missed.

- **HTTPS is required.** With `NODE_ENV=production` the login cookie is marked `Secure`, so logging in over plain HTTP does not stick. Browsers also refuse camera and microphone access for the built-in video on plain HTTP. You need a domain name and a certificate (Step 7).
- **Jitsi (8x8 JaaS) JWT tokens are required.** Every player needs their own token in a `JWT_<USERNAME>` variable, and the shared TV display needs `JWT_COMMUNITY`. Without them `/game` and `/community` return a 500 error.
- **The tokens must be passed into the container.** `docker-compose.yml` on its own does not do this. Step 4 adds a small override file that does.
- **There are no passwords.** Players log in by picking their name from a list. Anyone who can reach the site can log in as any player, so share the URL only with your group.

## Digital Ocean Deployment

### Prerequisites

- A Digital Ocean account
- A domain name pointed at the droplet (needed for HTTPS)
- An 8x8 JaaS account with a JWT for each player and one for the community display
- Basic knowledge of SSH and Linux commands

### Step 1: Create a Droplet

1. Log in to your Digital Ocean account
2. Click "Create" → "Droplets"
3. Choose an image:
   - **Distribution**: Ubuntu LTS (22.04 or newer)
   - **Plan**: Basic ($6/month is sufficient for small groups)
4. Choose a datacenter region close to your users
5. **Authentication**: Add your SSH key
6. **Hostname**: Choose a memorable name (e.g., "poker-dealer")
7. Click "Create Droplet"

### Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@your_droplet_ip
```

Update the system:
```bash
apt update && apt upgrade -y
```

Install Docker. The install script includes the Compose plugin (`docker compose`):
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify installation
docker --version
docker compose version
```

This guide uses `docker compose` (with a space). The older standalone `docker-compose` command is no longer maintained.

### Step 3: Get the Code and Configure It

Create the application directory and clone the repository:
```bash
mkdir -p /opt/poker-dealer
cd /opt/poker-dealer
git clone https://github.com/pelauimagineering/poker-dealer.git .
```

Create the environment file. There is no `.env.example` in the repository, so create `.env` from scratch:
```bash
nano .env
```

```env
# Phrase a player must type to reset the game from the UI.
# Write it in lower case: the app lower-cases what the player types before comparing.
# If unset, the app falls back to a default that is visible in the source code.
RESET_PHRASE=<choose-your-own-phrase>

# Jitsi (8x8 JaaS) tokens, one per player. The name after JWT_ is the
# player's user name in upper case.
JWT_GARY=<token>
JWT_NEAVE=<token>
JWT_HARISH=<token>
JWT_CHRIS=<token>
JWT_TONY=<token>
JWT_SEYMOUR=<token>
JWT_KERWIN=<token>
JWT_WAYNE=<token>
JWT_DEE=<token>
JWT_LORENZO=<token>
JWT_JB=<token>
JWT_EVAN=<token>

# Jitsi token for the public /community display
JWT_COMMUNITY=<token>
```

Notes on the environment:

- `PORT`, `NODE_ENV` and `DATABASE_PATH` are already set by `docker-compose.yml`. You do not need them in `.env` for a Docker deployment.
- `SESSION_SECRET` appears in `docker-compose.yml` but the app does not read it. You can leave it unset.
- Never commit `.env`. It is listed in `.gitignore` and `.dockerignore`.
- On startup the server logs `WARNING: Missing JWT env vars: ...` and lists any token it could not find. Check the logs for this line after every deploy.

**Adding a player later** takes two code changes and one token: add them to the list in `scripts/init-db.js`, add a matching entry in `server/jwt-config.js`, and set their `JWT_<USERNAME>` in `.env`. A player without the `jwt-config.js` entry or the token can log in, then gets a "Video conferencing not configured" error.

### Step 4: Build and Run with Docker

Create `docker-compose.override.yml` next to `docker-compose.yml`. Compose picks it up automatically, and it is already in `.gitignore`:
```yaml
services:
  poker-dealer:
    # Pass everything in .env (the JWT tokens and RESET_PHRASE) to the app
    env_file: .env
    # Only listen on localhost; Nginx is the public entry point
    ports: !override
      - "127.0.0.1:3000:3000"
```

Why the `ports` line matters: Docker publishes ports straight through the firewall, bypassing UFW. Without this override, port 3000 is reachable from the internet even though Step 5 does not open it. `!override` needs Docker Compose 2.24 or newer.

Build the image and start the application:
```bash
docker compose build
docker compose up -d
```

The image build creates the database and seeds the players, and the first start copies it into the `poker-dealer-data` volume. You do not need to initialize the database by hand on a new install.

Check that it is running:
```bash
docker compose ps
docker compose logs --tail 50
curl http://localhost:3000/api/health
```

The health check should return `{"status":"ok",...}`, and the logs should not contain the `Missing JWT env vars` warning.

### Step 5: Configure Firewall

Enable UFW firewall:
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 6: Set Up Nginx Reverse Proxy

Install Nginx:
```bash
apt install nginx -y
```

Create Nginx configuration:
```bash
nano /etc/nginx/sites-available/poker-dealer
```

Add the following configuration. The app opens its WebSocket on the site root, so one `location /` block with the upgrade headers covers both pages and WebSocket traffic:
```nginx
server {
    listen 80;
    server_name your_domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/poker-dealer /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 7: Set Up SSL with Let's Encrypt (Required)

Install Certbot:
```bash
apt install certbot python3-certbot-nginx -y
```

Obtain SSL certificate:
```bash
certbot --nginx -d your_domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

Auto-renewal is set up automatically. Test it with:
```bash
certbot renew --dry-run
```

### Step 8: Access Your Application

- Players: `https://your_domain.com`
- Shared TV display (no login): `https://your_domain.com/community`

Log in as one player and confirm the game page loads with video before game night.

## Maintenance

### Viewing Logs
```bash
docker compose logs -f
```

### Restarting the Application
```bash
docker compose restart
```

To restart with a clean table (clears the game state and logs everyone out), use the reset option in the app, which asks for `RESET_PHRASE`.

### Updating the Application
```bash
cd /opt/poker-dealer
git pull
docker compose build
docker compose up -d

# Apply database changes to the existing database
docker compose exec poker-dealer node scripts/init-db.js
docker compose restart
```

Do not skip the `init-db.js` step. The database lives in a volume that survives updates, so new columns and newly added players only reach it when this script runs. It is safe to run repeatedly: it adds what is missing and leaves existing players, sessions and game state alone.

### Backup Database

The container does not include the `sqlite3` command-line tool, so copy the database file while the app is stopped:
```bash
docker compose stop
docker cp poker-dealer:/app/database/poker-dealer.db ./backup-$(date +%Y%m%d).db
docker compose start
```

### Restore Database
```bash
docker compose stop

# Copy the backup into the container
docker cp backup.db poker-dealer:/app/database/poker-dealer.db

# Hand the file back to the app's user, otherwise the database is read-only
docker compose run --rm --no-deps --user root --entrypoint chown poker-dealer node:node /app/database/poker-dealer.db

docker compose start
```

## Alternative Deployment Methods

### Direct Node.js Installation (Without Docker)

Install a current Node.js LTS release (the app needs Node 18 or newer; Node 18 itself is end-of-life):
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
```

Clone and set up:
```bash
mkdir -p /opt/poker-dealer
cd /opt/poker-dealer
git clone https://github.com/pelauimagineering/poker-dealer.git .
npm install --omit=dev
npm run db:init
```

Create `.env` as in Step 3 and add the server settings, which Docker would otherwise provide:
```env
PORT=3000
NODE_ENV=production
```

Install PM2 for process management and start the application:
```bash
npm install -g pm2
pm2 start server/index.js --name poker-dealer
pm2 save
pm2 startup
```

Then follow Steps 5 to 7 for the firewall, Nginx and SSL. To update, run `git pull`, `npm install --omit=dev`, `npm run db:init` and `pm2 restart poker-dealer`.

### Using Other Cloud Providers

#### AWS EC2
Follow the same steps as Digital Ocean, but:
1. Launch an EC2 instance (Ubuntu LTS)
2. Configure Security Groups to allow ports 80 and 443 only
3. Use an Elastic IP for a static IP address

#### Google Cloud Platform
1. Create a Compute Engine instance
2. Configure firewall rules for HTTP/HTTPS
3. Follow the same Docker deployment steps

#### Heroku and similar platforms
Not recommended. The app stores everything in a SQLite file, and platforms with an ephemeral filesystem erase it on every restart or deploy.

## Monitoring

### Health Checks
The application includes a health check endpoint at `/api/health`. Docker also runs this check itself; `docker compose ps` shows the result.

Set up monitoring with:
- UptimeRobot (free)
- Pingdom
- Digital Ocean Monitoring (built-in)

### Resource Monitoring
```bash
# View container stats
docker stats poker-dealer

# View system resources
htop
```

## Security Best Practices

1. **Keep the URL private**: there are no passwords, so anyone with the link can log in as any player
2. **Use HTTPS**: the app does not work without it in production
3. **Firewall**: open only ports 80 and 443, and keep port 3000 bound to localhost (Step 4)
4. **Set `RESET_PHRASE`**: otherwise the default phrase from the source code applies
5. **Protect `.env`**: it holds the Jitsi tokens; run `chmod 600 .env`
6. **Regular Updates**: keep the system and dependencies updated
7. **Backup**: regularly back up the database

## Troubleshooting

### Container won't start
```bash
docker compose logs
docker compose ps
```

### "Video conferencing not configured" (500 error)
- The player's `JWT_<USERNAME>` or `JWT_COMMUNITY` is missing. Check the startup logs for `Missing JWT env vars`
- Confirm `docker-compose.override.yml` exists and contains `env_file: .env`, then run `docker compose up -d`
- If the variable is set and the error remains, the player has no entry in `server/jwt-config.js`

### Login returns to the login page
- The site is being used over plain HTTP. In production the login cookie is only sent over HTTPS
- Verify the SSL certificate is valid

### WebSocket connection fails
- Ensure the Nginx `location /` block has the `Upgrade` and `Connection` headers
- Check firewall rules
- Verify the SSL certificate

### Game state stops saving after an update
- Run the `init-db.js` step from "Updating the Application"; the database is missing columns added in a newer version

### Database locked or read-only errors
```bash
docker compose down
docker compose up -d
```
If the error started after a restore, re-run the `chown` step from "Restore Database".

### Out of memory
- Upgrade to a larger droplet
- Monitor with `docker stats`

## Scaling Considerations

The app keeps one game in memory in one process, backed by one SQLite file. It is built for a single table of friends and cannot be run as multiple instances behind a load balancer without code changes.

## Support

For issues or questions:
1. Check the application logs
2. Review the README.md
3. Open an issue on GitHub
