// plugins/addregles.js
const groupRules = {}; // En mémoire, tu peux remplacer par un stockage persistant

module.exports = {
  name: 'addregles',
  description: 'Ajouter/modifier les règles du groupe (usage: !addregles texte)',
  async run(sock, msg, args) {
    if (!msg.key.remoteJid.endsWith('@g.us')) {
      return await sock.sendMessage(msg.key.remoteJid, { text: 'Commande réservée aux groupes.' });
    }
    if (!args.length) {
      return await sock.sendMessage(msg.key.remoteJid, { text: 'Veuillez fournir le texte des règles.' });
    }
    const rulesText = args.join(' ');
    groupRules[msg.key.remoteJid] = rulesText;
    await sock.sendMessage(msg.key.remoteJid, { text: '✅ Règles mises à jour.' });
  },
  getRules(groupId) {
    return groupRules[groupId] || null;
  },
};
