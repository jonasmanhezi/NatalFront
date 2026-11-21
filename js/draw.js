// Sorteio em círculo único: embaralha (Fisher–Yates) e cada pessoa tira a próxima.
// Garante que ninguém tira a si mesmo e que, com 3 ou mais pessoas, ninguém forma par fechado.
// O backend deve fazer o mesmo do lado do servidor (veja docs/API.md).

function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

/** @param {string[]} ids  @returns {Record<string,string>} quem dá -> quem recebe */
export function drawPairs(ids) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  const out = {};
  a.forEach((id, i) => { out[id] = a[(i + 1) % a.length]; });
  return out;
}
