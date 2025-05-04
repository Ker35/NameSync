require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startPolling(); // Start polling when the bot is ready
  setTimeout(() => {
    console.log("⏱️ 5 minutes have passed. Restarting bot...");
    client.destroy(); // Kill the bot
    process.exit(); // Exit the process to allow a restart
  }, 5 * 60 * 1000); // 5 minutes
});

// Send a message to a channel
async function sendChannelMessage(channelId, message) {
  const channel = await client.channels.fetch(channelId);
  if (channel) {
    channel.send(message);
  }
}

// Start polling NamelessMC API
async function startPolling() {
  const apiUrl = process.env.NAMEMC_API_URL
  const guildId = process.env.GUILD_ID;
  const apiKey = process.env.NAMEMC_API_KEY;
  const channelId = process.env.NOTIFY_CHANNEL_ID;

  // Start the polling loop
  const pollInterval = async () => {
    console.log('🔁 Polling NamelessMC API...');
    let nextPageUrl = apiUrl;
    let totalUsers = 0;

    try {
      // Loop through all pages of users
      while (nextPageUrl) {
        const response = await axios.get(nextPageUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        const responseData = response.data;
        const users = responseData.users;
        totalUsers += users.length;

        if (users.length === 0) {
          console.log('ℹ️ No more users to update.');
          break; // Exit the loop if no users are found
        }

        // Process each user
        for (const user of users) {
          const discordIntegration = user.integrations.find(
            (i) => i.integration === 'Discord' && i.verified
          );

          if (discordIntegration) {
            const discordId = discordIntegration.identifier;
            const namelessUsername = user.username; // NamelessMC username
          
            // Update the nickname only if needed
            const username = await updateNickname(discordId, namelessUsername, guildId);
            if (username) {
              await sendChannelMessage(
                channelId,
                `✅ Updated nickname for Discord ID: ${username} <@${discordId}> to "${namelessUsername}".`
              );
            }
          }
        }

        nextPageUrl = responseData.next_page || null; // Update URL for next page, or null if no more pages
      }
    } catch (err) {
      console.error('❌ API Error:', err.response?.status || '', err.message);
      await sendChannelMessage(
        channelId,
        `❌ API Error: ${err.response?.status || ''} ${err.message}`
      );
    }

    // Restart the polling after the 1-minute interval
    setTimeout(pollInterval, 60 * 1000); // Restart the polling loop after 1 minute
  };

  // Begin the polling interval
  pollInterval(); // Initial call to start the interval
}

// Update the nickname on Discord if it doesn't match
async function updateNickname(discordId, namelessUsername, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log('❌ Guild not found');
      return null;
    }
  
    try {
      // Force a fresh fetch of the member data from Discord API (so it picks up any changes)
      const member = await guild.members.fetch(discordId, { force: true });
  
      if (member) {
        // Explicitly fetch the nickname and username
        const discordNickname = member.nickname || "";  // Ensure we have an empty string if no nickname
        const discordUsername = member.user.username;
  
        // Debugging logs
        console.log(`Checking member: ${discordId}`);
        console.log(`NamelessMC Username: "${namelessUsername}"`);
        console.log(`Discord Username: "${discordUsername}"`);
        console.log(`Discord Nickname: "${discordNickname}"`);
  
        // If the Discord Nickname is empty or does not match the NamelessMC username, update it
        if (discordNickname !== namelessUsername || discordNickname === "") {
          // If the nickname is empty or not matching the NamelessMC username, explicitly set it
          await member.setNickname("");  // Force reset first to ensure it triggers a change
          await member.setNickname(namelessUsername);  // Now set the new nickname
          console.log(`✅ Updated nickname for ${discordId} to "${namelessUsername}"`);
          return member.user.username;  // Return Discord username to send a message
        } else {
          console.log(`ℹ️ Nickname for ${discordId} already matches the NamelessMC username "${namelessUsername}"`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to update nickname for ${discordId}:`, error);
    }
  
    return null;
}

// Slash Command to manually send total users in NamelessMC
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'totalusers') {
    const apiUrl = process.env.NAMEMC_API_URL;
    const apiKey = process.env.NAMEMC_API_KEY;
    let totalUsers = 0;
    
    try {
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      const responseData = response.data;
      const users = responseData.users;
      totalUsers = users.length;

      await interaction.reply(`📊 Total Users in NamelessMC: ${totalUsers}`);
    } catch (err) {
      console.error('❌ API Error:', err.response?.status || '', err.message);
      await interaction.reply(`❌ API Error: ${err.response?.status || ''} ${err.message}`);
    }
  }
});

// Register slash commands when the bot starts up
client.once('ready', async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('totalusers')
      .setDescription('Fetch the total number of users in NamelessMC'),
  ];

  await client.application.commands.set(commands);
  console.log('🔄 Slash commands registered');
});

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
