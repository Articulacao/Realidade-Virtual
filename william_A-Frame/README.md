# Caça ao Tesouro do Pirata — Projeto VR

Jogo VR estático construído com A-Frame. Uma cena simples com cinco baús escondidos pela ilha.

Pré-requisitos
- Navegador moderno com WebGL (Chrome, Edge, Firefox)
- Node.js (opcional, para usar `npx`)

Como rodar (modo rápido)
```bash
# Servidor estático simples (porta 8080)
npx http-server . -p 8080

# Ou servidor com reload (dev)
npx live-server --port=8080 .
```

Abra `http://localhost:8080` no navegador.

Preview online: https://piratevr.netlify.app/

Observações
- O projeto usa A-Frame via CDN. Para produção, considere hospedar a lib localmente ou adicionar SRI/crossorigin.
- Coloque modelos, texturas e sons na pasta `assets/` e referencie-os no bloco `<a-assets>` em `index.html`.
- Se o áudio não iniciar automaticamente, interaja (toque/clique) para ativar o `AudioContext`.
 - O botão de início (`ZARPAR`) tentará entrar em modo VR (visão estereoscópica / split-screen) após o gesto do usuário — útil para Google Cardboard.
 - Suporte a teletransporte por olhar: fixe o cursor (gaze) sobre o chão ou marcadores para teletransportar o `#rig` até a posição.
 - Pontos de teletransporte: o projeto inclui marcadores visuais (`teleport-marker`) espalhados pela cena. Fixe o olhar sobre um marcador por ~1.5s (gaze) para teletransportar sem tocar.
 - Teletransporte por gaze também funciona ao fixar o cursor sobre o chão. Use o botão `ZARPAR` para iniciar e depois fixe o olhar nos marcadores.

Como contribuir
- Adicione assets em `assets/` e atualize `index.html` para pré-carregá-los.
- Abra issues com melhorias de acessibilidade e performance.

Licença: MIT