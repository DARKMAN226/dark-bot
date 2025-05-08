// whatsapp.js

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');
const { formatNumber } = require('./utilis');

async function startWhatsAppBot() {
  // Chargement dynamique des plugins depuis le dossier plugins/
  const plugins = {};
  const pluginsDir = path.resolve(__dirname, config.PATHS.PLUGINS);
  fs.readdirSync(pluginsDir).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const plugin = require(path.join(pluginsDir, file));
        if (plugin.name && typeof plugin.run === 'function') {
          plugins[plugin.name.toLowerCase()] = plugin;
          console.log(`Plugin chargé: ${plugin.name}`);
        }
      } catch (err) {
        console.error(`Erreur lors du chargement du plugin ${file}:`, err);
      }
    }
  });

  // Authentification Baileys avec multi-fichiers dans le dossier session/
  const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, config.PATHS.SESSION));

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: config.DEBUG ? 'debug' : 'silent' }),
    // Optionnel : tu peux ajouter d'autres options ici
  });

  // Sauvegarde automatique des credentials à chaque mise à jour
  sock.ev.on('creds.update', saveCreds);

  // Gestion des événements de connexion
  sock.ev.on('connection.update', update => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connexion fermée, raison:', lastDisconnect?.error?.toString() || 'inconnue', 'Reconnecte:', shouldReconnect);
      if (shouldReconnect) startWhatsAppBot();
      else console.log('Déconnecté volontairement, arrêt du bot.');
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
    }
  });

  // Gestion des messages entrants
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return; // Ignorer ses propres messages

    // Récupérer le texte du message (support conversation simple et extendedTextMessage)
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    // Vérifier que le message commence par le préfixe défini
    if (!text.startsWith(config.PREFIX)) return;

    // Extraire la commande et les arguments
    const [command, ...args] = text.slice(config.PREFIX.length).trim().split(/\s+/);
    const cmd = command.toLowerCase();

    console.log(`Commande reçue: ${cmd} - Arguments: ${args.join(' ')}`);

    // Vérifier si la commande existe parmi les plugins chargés
    if (plugins[cmd]) {
      try {
        // Exécuter la commande en passant le contexte nécessaire
        await plugins[cmd].run(sock, msg, args, {
          botNumber: formatNumber(config.BOT_NUMBER),
          admins: config.ADMINS.map(formatNumber),
          prefix: config.PREFIX,
          plugins,
          ownerName: config.OWNER_NAME,
          paths: config.PATHS,
          osInfo: {
            type: os.type(),
            platform: os.platform(),
            arch: os.arch(),
            uptime: os.uptime(),
            totalMem: os.totalmem(),
            freeMem: os.freemem(),
          },
        });
      } catch (error) {
        console.error(`Erreur dans la commande ${cmd}:`, error);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Une erreur est survenue lors de l'exécution de la commande *${cmd}*.`,
        });
      }
    } else {
      // Commande inconnue
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❓ Commande inconnue : *${cmd}*.\nTape ${config.PREFIX}menu pour la liste des commandes.`,
      });
    }
  });
}

module.exports = { startWhatsAppBot };
