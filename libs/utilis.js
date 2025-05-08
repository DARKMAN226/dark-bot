// utilis.js

/**
 * Formate un numéro WhatsApp en ajoutant le suffixe @s.whatsapp.net si absent
 * @param {string} number - Numéro au format international sans suffixe
 * @returns {string} - Numéro formaté WhatsApp
 */
function formatNumber(number) {
    if (number.endsWith('@s.whatsapp.net')) return number;
    return `${number}@s.whatsapp.net`;
  }
  
  /**
   * Prépare une liste de mentions à partir d'un tableau de numéros
   * @param {string[]} numbers - Liste de numéros WhatsApp (format international)
   * @returns {string[]} - Liste formatée pour mentions Baileys
   */
  function prepareMentions(numbers) {
    return numbers.map(formatNumber);
  }
  
  module.exports = {
    formatNumber,
    prepareMentions,
  };
  