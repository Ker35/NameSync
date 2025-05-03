# NameSync

NameSync is a Node.js-based Discord bot that syncs verified NamelessMC usernames with Discord nicknames. It periodically polls the NamelessMC API and updates guild member nicknames accordingly.

## Features

- ✅ Polls the NamelessMC API every 60 seconds  
- 🔁 Automatically updates Discord nicknames for verified users  
- ♻️ Auto-restarts every 5 minutes using `pm2` to ensure reliability  
- 🔒 Secure API key handling with `.env` file  
- 🛠️ Slash command for manually checking the total number of users

## Installation

1. **Clone the repo:**  
   ```
   git clone https://github.com/Ker35/NameSync.git  
   cd NameSync  
   ```

2. **Install dependencies:**  
   ```
   npm install  
   ```

3. **Copy environment variables file and configure it:**  
   ```
   mv .env.example .env  
   ```  
   Then open `.env` and fill in your:  
   - `DISCORD_TOKEN`  
   - `GUILD_ID`  
   - `NOTIFY_CHANNEL_ID`  
   - `NAMEMC_API_URL`  
   - `NAMEMC_API_KEY`

4. **Run using PM2 (auto-restarts every 5 minutes):**  
   ```
   npm run pm2-start  
   ```

5. **Useful PM2 commands:**  
   - View logs:  
     ```
     pm2 logs NameSync  
     ```
   - Restart bot:  
     ```
     pm2 restart NameSync  
     ```
   - Stop bot:  
     ```
     pm2 stop NameSync  
     ```
   - Delete bot process:  
     ```
     pm2 delete NameSync  
     ```

## Slash Commands

If you added a slash command to show NamelessMC user totals, make sure to register your command with Discord using the Discord API or relevant tools.

## Project Structure

- `index.js` – main bot logic  
- `.env` – environment variables (excluded by `.gitignore`)  
- `package.json` – dependency and script definitions  
- `LICENSE.md` – usage and distribution terms  
- `README.md` – you're reading it!

## Contributing

Feel free to fork and make pull requests. If you improve it, we’d love to see it!

## License

This project is licensed under the **Modified MIT License**.

See [LICENSE.md](LICENSE.md) for more information.
```
