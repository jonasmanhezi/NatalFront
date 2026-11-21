# Pastebin Caseiro

Compartilhe trechos e pequenos arquivos de código entre PC, notebook e celular pela rede de casa.
Um arquivo só, sem instalar nada além do Python 3.8+.

## Rodar

```bash
python pastebin.py
```

Ele mostra o endereço para abrir nos outros aparelhos, por exemplo `http://192.168.0.15:8000`.

Com PIN (recomendado):

| Sistema | Comando |
|---|---|
| Windows (PowerShell) | `$env:PIN="1234"; python pastebin.py` |
| Windows (cmd) | `set PIN=1234 && python pastebin.py` |
| Linux / Mac | `PIN=1234 python3 pastebin.py` |

Outras variáveis: `PORT` (padrão 8000) e `DATA_DIR` (padrão `./dados`).

## Usar

- **Ctrl+V** em qualquer lugar da página: cria um trecho novo.
- **Arraste arquivos** para a página, ou use "Enviar arquivos" (até 2 MB cada).
- **Copiar tudo**: copia o conteúdo, mesmo sem HTTPS.
- **Editar**: salva com **Ctrl+S**; **Esc** cancela.
- Clique no nome para renomear.
- A lista atualiza sozinha a cada 3 s nos outros aparelhos.

## Se não abrir nos outros aparelhos

- **Firewall do Windows:** na primeira execução, aceite o aviso para "Redes privadas".
  Se já recusou, libere a porta 8000 em *Firewall do Windows Defender → Regras de entrada*.
- Confirme que todos os aparelhos estão **no mesmo Wi-Fi**.
- Notebook do trabalho com VPN ligada pode não enxergar a rede de casa.
- Fixe o IP do PC no roteador (reserva de DHCP) para o endereço não mudar.

As cores de sintaxe vêm de um CDN. Sem internet, tudo funciona, só sem cor.
