// plugins/regles.js
module.exports = {
    name: 'regles',
    description: 'Affiche les règles du groupe',
    async run(sock, msg) {
      const rulesText = `
  📜 *Règles du groupe* 📜
  
  1. Respectez tous les membres.
  2. Pas de spam ou publicité.
  3. Pas de contenu inapproprié.
  4. Utilisez les commandes avec respect.
  5. Écoutez les admins.
  
  Merci de votre compréhension !
  `;
  
      await sock.sendMessage(msg.key.remoteJid, { text: rulesText.trim() });
    },
  };
  