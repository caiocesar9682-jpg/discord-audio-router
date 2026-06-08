const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const { pipeline } = require('stream');

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const CHANNEL_NAMES = {
  PARTY_MAIN:  'PARTY MAIN',
  LIDER_SW1:   'LIDER SWITCH 1',
  LIDER_SW2:   'LIDER SWITCH 2',
  LIDER_PARTY: 'LIDER PARTY',
  PARTY_SW1:   'PARTY SWITCH 1',
  PARTY_SW2:   'PARTY SWITCH 2',
  PARTY3:      'PARTY 3',
  PARTY4:      'PARTY 4',
  PARTY5:      'PARTY 5',
};

const ROUTING = {
  PARTY_MAIN:  ['LIDER_SW1', 'LIDER_SW2', 'LIDER_PARTY'],
  PARTY_SW1:   ['LIDER_SW1'],
  PARTY_SW2:   ['LIDER_SW2'],
  PARTY3:      ['LIDER_PARTY'],
  PARTY4:      ['LIDER_PARTY'],
  PARTY5:      ['LIDER_PARTY'],
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once('ready', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  const channels = {};
  for (const [key, name] of Object.entries(CHANNEL_NAMES)) {
    channels[key] = guild.channels.cache.find(
      c => c.name === name && c.isVoiceBased()
    );
    if (!channels[key]) console.warn(`⚠️ Canal não encontrado: ${name}`);
    else console.log(`📢 Canal encontrado: ${name}`);
  }

  const connections = {};
  for (const [key, channel] of Object.entries(channels)) {
    if (!channel) continue;
    try {
      connections[key] = joinVoiceChannel({
        channelId: channel.id,
        guildId: GUILD_ID,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });
      console.log(`🔗 Conectado em: ${channel.name}`);
    } catch (e) {
      console.error(`❌ Erro ao conectar em ${channel.name}:`, e);
    }
  }

  // Aguarda 3 segundos para todas as conexões estabilizarem
  await new Promise(r => setTimeout(r, 3000));

  for (const [sourceKey, destKeys] of Object.entries(ROUTING)) {
    const sourceConn = connections[sourceKey];
    if (!sourceConn) {
      console.warn(`⚠️ Conexão não encontrada para: ${sourceKey}`);
      continue;
    }

    console.log(`🎙️ Monitorando áudio em: ${CHANNEL_NAMES[sourceKey]}`);

    sourceConn.receiver.speaking.on('start', (userId) => {
      console.log(`🗣️ Alguém falou em ${CHANNEL_NAMES[sourceKey]} (userId: ${userId})`);

      try {
        const audioStream = sourceConn.receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
          },
        });

        for (const destKey of destKeys) {
          const destConn = connections[destKey];
          if (!destConn) continue;

          try {
            const player = createAudioPlayer({
              behaviors: { noSubscriber: NoSubscriberBehavior.Play },
            });
            const resource = createAudioResource(audioStream);
            destConn.subscribe(player);
            player.play(resource);
            console.log(`📡 Retransmitindo de ${CHANNEL_NAMES[sourceKey]} → ${CHANNEL_NAMES[destKey]}`);
          } catch (e) {
            console.error(`❌ Erro ao retransmitir para ${destKey}:`, e);
          }
        }
      } catch (e) {
        console.error(`❌ Erro ao capturar áudio de ${sourceKey}:`, e);
      }
    });
  }

  console.log('🚀 Sistema de roteamento de áudio ativo!');
});

client.login(TOKEN);
