## License

This project is licensed under the MIT License with the following restriction:

- You can use, modify, and distribute the code freely.
- You cannot sell or use the code for commercial purposes.

See the LICENSE file for more details.

## Installation

1. Clone this repository:

   ```
   git clone https://github.com/Ker35/NameSync.git
   cd NameSync
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Copy the `.env.example` to `.env`:

   ```
   mv .env.example .env
   ```

4. Add your configuration values to the `.env` file:

   ```
    DISCORD_TOKEN=-Your_Discord_Token_-
    GUILD_ID=-Discord_Server_ID-
    NOTIFY_CHANNEL_ID=-Discord_Channel_ID-
    NAMEMC_API_URL=-NamelessMC_API_URL-
    NAMEMC_API_KEY=-NamelessMC_API_Key-
   ```

5. Run the bot with pm2 for process management:

   ```
   pm2 start index.js --name "namesync"
   ```

6. To kill the pm2 process:

   ```
   pm2 stop namesync
   ```
