const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  VoiceConnectionStatus,
  AudioReceiveStream,
  EndBehaviorType,
} = require('@discordjs/voice');
const { PassThrough } = require('stream');

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// Mapeie os nomes exatos dos seus canais de voz
const CHANNEL_NAMES = {
  PARTY_MAIN:    'PARTY MAIN',
  LIDER_SW1:     'LIDER SWITCH 1',
  LIDER_SW2:     'LIDER SWITCH 2',
  LIDER_PARTY:   'LIDER PARTY',
  PARTY_SW1:     'PARTY SWITCH 1',
  PARTY_SW2:     'PARTY SWITCH 2',
  PARTY3:        'PARTY 3',
  PARTY4:        'PARTY 4',
  PARTY5:        'PARTY 5',
};

// Regras: quem fala em X → bot retransmite para Y
const ROUTING = {
  PARTY_MAIN:  ['LIDER_SW1', 'LIDER_SW2', 'LIDER_PARTY'],
  PARTY_SW1:   ['LIDER_SW1'],
  PARTY_SW2:   ['LIDER_SW2'],
  PARTY3:      ['LIDER_PARTY'],
  PARTY4:      ['LIDER_PARTY'],
  PARTY5:      ['LIDER_PARTY'],
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  const channels = {};

  // Encontra todos os canais pelo nome
  for (const [key, name] of Object.entries(CHANNEL_NAMES)) {
    channels[key] = guild.channels.cache.find(
      c => c.name === name && c.isVoiceBased()
    );
    if (!channels[key]) console.warn(`Canal não encontrado: ${name}`);
  }

  // Conecta o bot em todos os canais
  const connections = {};
  for (const [key, channel] of Object.entries(channels)) {
    if (!channel) continue;
    connections[key] = joinVoiceChannel({
      channelId: channel.id,
      guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    console.log(`Conectado em: ${channel.name}`);
  }

  // Configura o roteamento de áudio
  for (const [sourceKey, destKeys] of Object.entries(ROUTING)) {
    const sourceConn = connections[sourceKey];
    if (!sourceConn) continue;

    sourceConn.receiver.speaking.on('start', (userId) => {
      const audioStream = sourceConn.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 500 },
      });

      for (const destKey of destKeys) {
        const destConn = connections[destKey];
        if (!destConn) continue;

        const player = createAudioPlayer();
        const resource = createAudioResource(audioStream);
        destConn.subscribe(player);
        player.play(resource);
      }
    });
  }
});

client.login(TOKEN);
