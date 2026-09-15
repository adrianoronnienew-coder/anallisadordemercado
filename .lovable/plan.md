# Corrigir análise visual, sinais e alertas

## Resultado esperado
- Exibir, junto à tela compartilhada, a leitura das velas que sustenta cada decisão: tendência, médias, momentum, volatilidade, padrão, zonas e score.
- Mostrar claramente um sinal em observação antes da confirmação, sem registrá-lo como WAIT comum.
- Permitir a confirmação entre análises consecutivas mesmo quando a resposta da IA demora mais de 10 segundos.
- Tocar alertas confiáveis para CALL, PUT, WIN e LOSS, com um botão de teste de som.

## Implementação
- Ampliar a resposta da análise para incluir um diagnóstico técnico estruturado e validado.
- Criar um painel visual de confluências e contexto da vela atual, atualizado a cada análise.
- Trocar a confirmação baseada em janela curta por confirmação consecutiva com validade compatível com o tempo real das análises.
- Manter um único contexto de áudio, desbloqueado pela ação do usuário ao iniciar a análise, e indicar na tela se o som está pronto.
- Preservar o filtro de qualidade: a correção libera sinais bloqueados por atraso, sem transformar WAIT em entrada aleatória.

## Verificação
- Validar compilação e erros em execução.
- Testar o botão de som e os estados visuais no navegador.
- Fazer uma chamada real de análise com uma imagem de gráfico e confirmar o novo formato da resposta.
