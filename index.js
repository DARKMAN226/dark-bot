const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
  } = require('baileys');
  const pino = require('pino');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { Boom } = require('@hapi/boom'); // Gestion des erreurs Baileys
  
  const config = require('./config');
  
  const PREFIX = config.PREFIX || '!';
  const BOT_NUMBER = config.BOT_NUMBER || '';
  const ADMINS = config.ADMINS || [];
  
  function formatNumber(number) {
    return number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
  }
  
  const botNumberFull = formatNumber(BOT_NUMBER);
  const adminFullNumbers = ADMINS.map(formatNumber);
  
  async function startBot() {
    console.log(`Démarrage de ${config.BOT_NAME || 'Dark-BOT'}...`);
  
    // Chargement dynamique des plugins
    const plugins = {};
    const pluginsPath = path.join(__dirname, 'plugins');
    fs.readdirSync(pluginsPath).forEach((file) => {
      if (file.endsWith('.js')) {
        try {
          const plugin = require(path.join(pluginsPath, file));
          if (plugin.name && typeof plugin.run === 'function') {
            plugins[plugin.name.toLowerCase()] = plugin;
            console.log(`Plugin chargé: ${plugin.name}`);
          }
        } catch (e) {
          console.error(`Erreur lors du chargement du plugin ${file}:`, e);
        }
      }
    });
  
    // Authentification Baileys (session multi-fichiers)
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, 'session'));
  
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: config.DEBUG ? 'debug' : 'silent' }),
    });
  
    sock.ev.on('creds.update', saveCreds);
  
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const err = new Boom(lastDisconnect?.error);
        const statusCode = err.output?.statusCode;
        console.log(`Connexion fermée, code: ${statusCode}, raison: ${err.message}`);
  
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('Reconnexion dans 5 secondes...');
          await new Promise((res) => setTimeout(res, 5000));
          startBot();
        } else {
          console.log('Déconnecté volontairement, arrêt du bot.');
        }
      } else if (connection === 'open') {
        console.log('Connecté à WhatsApp');
      }
    });
  
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
  
      const msg = messages[0];
      if (!msg.message) return;
      if (msg.key.fromMe) return;
  
      // Récupération du texte du message
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
      if (!text) return;
  
      if (!text.startsWith(PREFIX)) return;
  
      const [command, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
      const cmd = command.toLowerCase();
  
      console.log(`Commande reçue: ${cmd} - Arguments: ${args.join(' ')}`);
  
      if (plugins[cmd]) {
        try {
          await plugins[cmd].run(sock, msg, args, {
            botNumber: botNumberFull,
            admins: adminFullNumbers,
            prefix: PREFIX,
            plugins,
            os,
            botName: config.BOT_NAME || 'Dark-BOT',
          });
        } catch (err) {
          console.error(`Erreur dans la commande ${cmd}:`, err);
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Une erreur est survenue lors de l'exécution de la commande *${cmd}*.`,
          });
        }
      } else {
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❓ Commande inconnue: *${cmd}*.\nTape ${PREFIX}menu pour la liste des commandes.`,
        });
      }
    });
  }
  
  startBot().catch((err) => console.error('Erreur au démarrage du bot:', err));
  