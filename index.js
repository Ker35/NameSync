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

// Parse ROLE_MAP from .env into a usable object
function parseRoleMap(envVar) {
  const map = {};
  if (!envVar) return map;

  envVar.split(',').forEach(pair => {
    const [group, roleId] = pair.split('=');
    if (group && roleId) {
      map[group.trim()] = roleId.trim();
    }
  });

  return map;
}

// Load role mapping from environment variable
const groupToDiscordRoleMap = parseRoleMap(process.env.ROLE_MAP);

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('totalusers')
      .setDescription('Fetch the total number of users in NamelessMC'),
  ];
  await client.application.commands.set(commands);
  console.log('🔄 Slash commands registered');

  startPolling();
  pollUsers();

  setTimeout(() => {
    console.log("⏱️ 5 minutes have passed. Restarting bot...");
    client.destroy();
    process.exit();
  }, 5 * 60 * 1000);
});

// Send a message to a channel
async function sendChannelMessage(channelId, message) {
  const channel = await client.channels.fetch(channelId);
  if (channel) {
    channel.send(message);
  }
}

// Function to update the nickname
async function updateNickname(discordId, namelessUsername) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
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

// Start polling NamelessMC API
async function startPolling() {
  const apiUrl = process.env.NAMEMC_API_URL;
  const apiKey = process.env.NAMEMC_API_KEY;
  const channelId = process.env.NOTIFY_CHANNEL_ID;

  // Start the polling loop
  const pollInterval = async () => {
    console.log('🔁 Polling NamelessMC API...');
    let nextPageUrl = `${apiUrl}?limit=100`; // Initialize with pagination query string
    let totalPollUsers = 0;

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
        totalPollUsers += users.length;

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
            const namelessUsername = user.username;
        
            const username = await updateNickname(discordId, namelessUsername);
            if (username) {
              await sendChannelMessage(
                channelId,
                `✅ Updated nickname for Discord ID: ${username} <@${discordId}> to "${namelessUsername}".`
              );
            }
        
            await syncUserDiscordRoles(user.id); // Sync roles inside the same loop
          }
        }        

        // Update the nextPageUrl for pagination (move to next page if available)
        nextPageUrl = responseData.next_page || null; 
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

// Declare this variable globally so it's accessible in both pollInterval and slash command
let totalUsers = 0;

// Polling function (to be executed at regular intervals)
async function pollUsers() {
  const apiUrl = process.env.NAMEMC_API_URL;
  const apiKey = process.env.NAMEMC_API_KEY;
  let nextPageUrl = `${apiUrl}?limit=100`;  // Start with the first page and 100 users per page

  try {
    let usersCount = 0;

    // Loop through all pages
    while (nextPageUrl) {
      const response = await axios.get(nextPageUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const responseData = response.data;

      // Count users on this page
      usersCount += responseData.users?.length || 0;

      // Log the number of users on this page
      console.log(`Users on this page: ${responseData.users?.length || 0}`);

      // Move to the next page if there is one
      nextPageUrl = responseData.next_page || null;
      console.log(`Next page URL: ${nextPageUrl}`);
    }

    // Update the global totalUsers variable
    totalUsers = usersCount;
    console.log(`Updated total users: ${totalUsers}`);

  } catch (err) {
    console.error('❌ API Error:', err.response?.status || '', err.message);
  }
}

async function syncUserDiscordRoles(userId) {
  const apiUrl = process.env.NAMEMC_API_URL;
  const apiKey = process.env.NAMEMC_API_KEY;
  const channelId = process.env.NOTIFY_CHANNEL_ID; // The Discord channel ID for role change messages

  try {
    // Fetch detailed data for a specific user
    const response = await axios.get(`${apiUrl}/${userId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const userData = response.data;

    // Skip if the user doesn't exist
    if (!userData.exists) {
      console.log(`⚠️ Skipping user ID ${userId}: user does not exist`);
      return;
    }

    // Get Discord ID directly or fall back to the integrations array
    let discordId = userData.discord_id;

    if (!discordId && Array.isArray(userData.integrations)) {
      const discordIntegration = userData.integrations.find(
        (i) => i.integration === 'Discord' && i.verified
      );
      if (discordIntegration) {
        discordId = discordIntegration.identifier;
        console.log(`🔄 Retrieved Discord ID from integrations for user ID ${userId}: ${discordId}`);
      }
    }

    // Skip if no Discord ID is found
    if (!discordId) {
      console.log(`⚠️ Skipping user ID ${userId}: Discord is not linked for this user`);
      return;
    }

    // Get user's NamelessMC group names
    const userGroups = userData.groups.map(group => group.name);

    // Get the guild (server) and fetch the Discord member
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.log('❌ Guild not found.');
      return;
    }

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      console.log(`❌ Could not find Discord member with ID ${discordId}`);
      return;
    }

    // Loop through group-role mappings
    for (const [groupName, roleId] of Object.entries(groupToDiscordRoleMap)) {
      const hasGroup = userGroups.includes(groupName);     // Has NamelessMC group?
      const hasRole = member.roles.cache.has(roleId);      // Has Discord role?

      if (hasGroup && !hasRole) {
        // Add role if group exists but Discord role is missing
        await member.roles.add(roleId);
        console.log(`✅ Added role "${groupName}" to ${member.user.tag}`);
        await sendChannelMessage(
          channelId,
          `✅ Added role "${groupName}" to ${member.user.tag}`
        );
      } else if (!hasGroup && hasRole) {
        // Remove role if group is gone but Discord role is still present
        await member.roles.remove(roleId);
        console.log(`🗑️ Removed role "${groupName}" from ${member.user.tag}`);
        await sendChannelMessage(
          channelId,
          `🗑️ Removed role "${groupName}" from ${member.user.tag}`
        );
      }
    }

  } catch (err) {
    console.error(`❌ Failed to sync roles for NamelessMC user ${userId}:`, err.message);
    await sendChannelMessage(
      process.env.NOTIFY_CHANNEL_ID,
      `❌ Error syncing roles for user ID ${userId}: ${err.message}`
    );
  }
}

// Slash Command to manually send total users in NamelessMC
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'totalusers') {
    try {
      await interaction.reply(`📊 Total Users in NamelessMC: ${totalUsers}`);
    } catch (err) {
      console.error('❌ Error sending reply:', err);
      await interaction.reply(`❌ Error: ${err.message}`);
    }
  }
});

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
