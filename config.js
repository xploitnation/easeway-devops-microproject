// Central configuration. Verify helpline numbers for your institution/country before any real use.
module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH || require('path').join(__dirname, 'data', 'easeway.db'),
  // Minimum number of distinct students needed before an aggregated figure is shown to counsellors
  K_THRESHOLD: 5,
  // Score at or below this (1-5 scale) triggers the support-information prompt
  CRISIS_SCORE: 2,
  CRISIS_KEYWORDS: /\b(suicid\w*|kill myself|end my life|want to die|self[- ]?harm|hurt myself|no reason to live)\b/i,
  HELPLINES: [
    { name: 'Tele-MANAS (India, 24x7 tele mental health)', number: '14416' },
    { name: 'Emergency services (India)', number: '112' },
    { name: 'Your campus counselling centre', number: 'Add your campus number in config.js' }
  ],
  DEMO_COUNSELLOR_PASSWORD: 'Counsel@123' // demo only - change for anything beyond a prototype
};
