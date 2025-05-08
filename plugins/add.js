// plugins/add.js
module.exports = {
    name: 'add',
    description: 'Ajouter un membre au groupe (utilisation : !add numéro)',
    async run(sock, msg, args) {
      try {
        if (!msg.key.participant && !msg.key.remoteJid.endsWith('@g.us')) {
          return await sock.sendMessage(msg.key.remoteJid, { text: 'Cette commande doit être utilisée dans un groupe.' });
        }
  
        if (!args[0]) {
          return await sock.sendMessage(msg.key.remoteJid, { text: 'Veuillez fournir un numéro à ajouter (ex: 22677123456).' });
        }
  
        const number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await sock.groupAdd(msg.key.remoteJid, [number]);
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ ${args[0]} ajouté au groupe.` });
      } catch (error) {
        console.error('Erreur add:', error);
        await sock.sendMessage(msg.key.remoteJid, { text: '❌ Impossible d’ajouter ce membre. Vérifiez le numéro et les permissions du bot.' });
      }
    },
  };
  