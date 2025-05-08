// plugins/tagadmin.js
module.exports = {
    name: 'tagadmin',
    description: 'Mentionner les admins du groupe',
    async run(sock, msg) {
      try {
        if (!msg.key.remoteJid.endsWith('@g.us')) {
          return await sock.sendMessage(msg.key.remoteJid, { text: 'Commande réservée aux groupes.' });
        }
        const metadata = await sock.groupMetadata(msg.key.remoteJid);
        const admins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
        if (admins.length === 0) {
          return await sock.sendMessage(msg.key.remoteJid, { text: 'Aucun admin trouvé dans ce groupe.' });
        }
        const text = '🛡️ Mention des admins :';
        await sock.sendMessage(msg.key.remoteJid, { text, mentions: admins });
      } catch (error) {
        console.error('Erreur tagadmin:', error);
        await sock.sendMessage(msg.key.remoteJid, { text: '❌ Impossible de mentionner les admins.' });
      }
    },
  };
  