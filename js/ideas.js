// Ideias de presente que não precisam de servidor: saem dos tamanhos e do que a pessoa gosta.

const KW = [
  [/caf[eé]/i, "Kit de cafés especiais ou uma prensa francesa"],
  [/livro|leitura|\bler\b/i, "Um livro do gênero favorito ou vale-livraria"],
  [/cozinh|receita|churras|confeit/i, "Avental bonito, tábua de madeira ou temperos especiais"],
  [/m[uú]sica|guitarra|viol[aã]o|vinil|show/i, "Disco de vinil, caixinha de som ou palhetas personalizadas"],
  [/futebol|\btime\b|corinthians|palmeiras|s[aã]o paulo|santos|flamengo|vasco|gr[eê]mio|cruzeiro/i, "Camisa, caneca ou cachecol do time do coração"],
  [/planta|jardim|horta|suculenta/i, "Vaso com uma suculenta ou kit de jardinagem"],
  [/viag|praia|acampa/i, "Necessaire de viagem, toalha de praia ou organizador de mala"],
  [/game|jog|videogame|ps5|xbox|nintendo|switch/i, "Gift card de jogos ou um controle novo"],
  [/maquiag|skin|cabelo|beleza|unha/i, "Kit de skincare ou acessórios de cabelo"],
  [/vinho|cerveja|drink|whisky|gin/i, "Um bom vinho ou kit de cervejas artesanais"],
  [/chocolate|doce|brigadeiro/i, "Caixa de chocolates finos"],
  [/cachorr|gato|\bpet\b/i, "Um mimo para o pet e uma caneca com a foto dele"],
  [/s[eé]rie|filme|cinema|netflix/i, "Balde de pipoca, manta ou vale-cinema"],
  [/academia|corrida|treino|esporte|pedal|bike/i, "Garrafa térmica, toalha de treino ou meias de corrida"],
  [/croch[eê]|tric[oô]|costur|artesan/i, "Novelos bonitos ou um kit de agulhas"],
  [/foto|c[aâ]mera/i, "Porta-retratos digital ou álbum para as fotos do ano"],
];

const s = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
// "36/38" -> "36 ou 38"
const or = (v) => { const p = s(v, 16).split("/").map((x) => x.trim()).filter(Boolean); return p.length > 1 ? `${p.slice(0, -1).join(", ")} ou ${p[p.length - 1]}` : p.join(""); };

/** @returns {[string,string][]} pares [ideia, motivo] */
export function staticIdeas(p) {
  const out = [];
  if (p.shirt) out.push(["Camiseta, camisa ou moletom", `Tamanho ${or(p.shirt)}`]);
  if (p.pants) out.push(["Calça, bermuda ou pijama", `Tamanho ${or(p.pants)}`]);
  if (p.shoe) out.push(["Chinelo, pantufa ou tênis", `Número ${or(p.shoe)}`]);
  const likes = s(p.likes, 300), avoid = s(p.avoid, 160);
  for (const [re, idea] of KW) {
    if (out.length >= 6) break;
    if (re.test(likes) && !re.test(avoid)) out.push([idea, "Combina com o que gosta"]);
  }
  if (out.length < 4) out.push(["Pantufa ou meias de Natal", p.shoe ? `Número ${or(p.shoe)}` : "Sempre funciona"]);
  return out.slice(0, 6);
}
