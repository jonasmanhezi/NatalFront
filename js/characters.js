// Personagens em SVG, desenho chapado no estilo "Natal de papel".
// Papai Noel (folclore) e um verdinho ranzinza original (não é cópia de nenhum personagem).
// Só cores sólidas, sem ids, para poder repetir o mesmo desenho várias vezes na página.

const INK = "#2b2230";
const LINE = "#e7d3bd";
const RED = "#e0453a";
const RED_D = "#b4332b";
const SKIN = "#f6c9a8";
const CHEEK = "#f59f95";
const GOLD = "#f2b33d";
const G = "#6fae3a";      // verde do ranzinza
const G_D = "#4d8a24";
const G_L = "#8cc556";
const EYE = "#ffe27a";

/** Cabeça do Noel centrada em (70, 62). */
const santaHead = `
  <path d="M46 42C48 18 70 6 92 14c12 4 20 16 22 30-6-8-14-12-20-12 1 4 2 7 2 10z" fill="${RED}"/>
  <path d="M92 14c12 4 20 16 22 30-3-4-7-7-11-9-2-9-6-16-11-21z" fill="${RED_D}" opacity=".35"/>
  <circle cx="114" cy="46" r="8.5" fill="#fff" stroke="${LINE}" stroke-width="2"/>
  <circle cx="70" cy="62" r="24" fill="${SKIN}"/>
  <path d="M44 64c-4 20 8 42 26 44 18-2 30-24 26-44-6 9-14 13-26 13s-20-4-26-13z" fill="#fff" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M70 73c-7-7-17-6-21 1 6 3 15 3 21 1 6 2 15 2 21-1-4-7-14-8-21-1z" fill="#fff" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="70" cy="67" r="5" fill="#f08e7b"/>
  <circle cx="54" cy="64" r="4" fill="${CHEEK}" opacity=".75"/>
  <circle cx="86" cy="64" r="4" fill="${CHEEK}" opacity=".75"/>
  <path d="M58 57q4-4.5 8 0M74 57q4-4.5 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M56 50q5-3.5 10 0M74 50q5-3.5 10 0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>
  <rect x="43" y="38" width="54" height="13" rx="6.5" fill="#fff" stroke="${LINE}" stroke-width="2"/>`;

/** Papai Noel acenando (meio corpo). */
export const SANTA = `<svg class="char santa" viewBox="0 0 140 150" aria-hidden="true">
  <path d="M28 150c0-36 18-54 42-54s42 18 42 54z" fill="${RED}"/>
  <path d="M36 112c-10 8-13 22-10 38h14c-1-12 1-22 6-30z" fill="${RED_D}"/>
  <rect x="63" y="98" width="14" height="52" fill="#fff" stroke="${LINE}" stroke-width="2"/>
  <rect x="30" y="128" width="80" height="10" fill="${INK}"/>
  <rect x="61" y="125" width="18" height="16" rx="3" fill="none" stroke="${GOLD}" stroke-width="4"/>
  <g class="wave">
    <path d="M96 112c12-10 20-24 22-40l13 3c-2 20-14 36-28 46z" fill="${RED}"/>
    <ellipse cx="124" cy="73" rx="10" ry="6" transform="rotate(12 124 73)" fill="#fff" stroke="${LINE}" stroke-width="2"/>
    <circle cx="127" cy="60" r="9" fill="#fff" stroke="${LINE}" stroke-width="2"/>
    <circle cx="118" cy="62" r="4" fill="#fff" stroke="${LINE}" stroke-width="2"/>
  </g>
  ${santaHead}
</svg>`;

/** Papai Noel conferindo a lista (cadastro). */
export const SANTA_LIST = `<svg class="char santa-list" viewBox="0 0 150 150" aria-hidden="true">
  <path d="M28 150c0-36 18-54 42-54s42 18 42 54z" fill="${RED}"/>
  <rect x="63" y="98" width="14" height="52" fill="#fff" stroke="${LINE}" stroke-width="2"/>
  <g class="list">
    <path d="M84 98h50v52H84z" fill="#fffdf6" stroke="${LINE}" stroke-width="2"/>
    <rect x="80" y="92" width="58" height="9" rx="4.5" fill="#f3e6d4" stroke="${LINE}" stroke-width="2"/>
    <path d="M92 112l3 3 6-6M92 126l3 3 6-6M92 140l3 3 6-6" fill="none" stroke="#2c8c58" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M106 112h20M106 126h16M106 140h20" stroke="#cdbba6" stroke-width="3" stroke-linecap="round"/>
  </g>
  <circle cx="84" cy="120" r="8" fill="#fff" stroke="${LINE}" stroke-width="2"/>
  ${santaHead}
</svg>`;

/** Verdinho ranzinza de braços cruzados, com gorro torto. */
export const GRUMPY = `<svg class="char grumpy" viewBox="0 0 140 150" aria-hidden="true">
  <path d="M28 150c-2-34 16-52 42-52s44 18 42 52z" fill="${G}"/>
  <path d="M28 150l4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7 4-7z" fill="${G_D}" opacity=".25"/>
  <g class="arms">
    <rect x="34" y="116" width="62" height="17" rx="8.5" transform="rotate(9 65 124)" fill="${G_D}"/>
    <circle cx="96" cy="130" r="9" fill="${G_D}"/>
    <rect x="44" y="114" width="62" height="17" rx="8.5" transform="rotate(-9 75 122)" fill="${G_L}"/>
    <circle cx="42" cy="128" r="9" fill="${G_L}"/>
    <path d="M38 126q4 3 8 0" fill="none" stroke="${G_D}" stroke-width="2" stroke-linecap="round"/>
  </g>
  <path d="M34 68c-7 1-11 7-9 13 2 5 7 6 10 3M106 68c7 1 11 7 9 13-2 5-7 6-10 3" fill="${G}" stroke="${G_D}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M32 60L26 44l14 6 2-16 10 12 8-16 6 14 8-16 6 16 8-12 6 16 6-12 2 16 12-6-6 14c6 12 4 30-6 40-8 8-20 12-32 12s-24-4-32-12c-10-10-12-28-6-40z" fill="${G}"/>
  <g class="brows">
    <path d="M46 64l20 7M94 64l-20 7" stroke="${G_D}" stroke-width="7" stroke-linecap="round"/>
  </g>
  <ellipse cx="57" cy="77" rx="9" ry="7" fill="${EYE}"/>
  <ellipse cx="83" cy="77" rx="9" ry="7" fill="${EYE}"/>
  <circle cx="54" cy="78" r="3.6" fill="${INK}"/>
  <circle cx="80" cy="78" r="3.6" fill="${INK}"/>
  <path d="M46 73h22M72 73h22" stroke="${G}" stroke-width="5"/>
  <ellipse cx="70" cy="88" rx="5" ry="3.5" fill="${G_D}"/>
  <path d="M57 101q13-8 26 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <g transform="rotate(-16 74 34)">
    <path d="M50 38c4-18 18-28 34-24 10 3 16 12 16 22-6-6-12-8-18-6 2 2 3 5 3 8z" fill="${RED}"/>
    <circle cx="101" cy="40" r="6.5" fill="#fff" stroke="${LINE}" stroke-width="2"/>
    <rect x="48" y="35" width="40" height="10" rx="5" fill="#fff" stroke="${LINE}" stroke-width="2"/>
  </g>
</svg>`;

/** Só os olhos e as mãos do ranzinza, espiando pela beirada. */
export const GRUMPY_PEEK = `<svg class="char peek" viewBox="0 0 110 64" aria-hidden="true">
  <path d="M14 64c0-30 18-48 41-48s41 18 41 48z" fill="${G}"/>
  <path d="M26 30l-4-10 9 5 3-11 6 10 6-12 4 12 7-10 2 11 8-7-1 11 9-4-4 9" fill="${G}"/>
  <path d="M30 34l17 6M80 34l-17 6" stroke="${G_D}" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="42" cy="46" rx="8" ry="6.5" fill="${EYE}"/>
  <ellipse cx="68" cy="46" rx="8" ry="6.5" fill="${EYE}"/>
  <circle class="pupil" cx="38" cy="47" r="3.4" fill="${INK}"/>
  <circle class="pupil" cx="64" cy="47" r="3.4" fill="${INK}"/>
  <path d="M33 42h18M59 42h18" stroke="${G}" stroke-width="4"/>
  <path d="M2 64c0-8 3-12 7-12s5 4 5 4 1-6 5-6 5 4 5 4 1-5 5-5 5 5 5 9v6zM70 64v-6c0-4 1-9 5-9s5 5 5 5 1-4 5-4 5 6 5 6 1-4 5-4 5 4 6 12z" fill="${G_L}" stroke="${G_D}" stroke-width="2" stroke-linejoin="round"/>
</svg>`;
