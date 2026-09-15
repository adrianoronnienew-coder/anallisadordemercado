# Análise visual completa sobre o gráfico

## Resultado
- Substituir o efeito solitário de varredura por marcações úteis diretamente sobre a tela compartilhada: tendência, suporte, resistência, ponto de entrada, direção e alertas.
- Exibir cada etapa do processamento para deixar claro se a imagem foi capturada, enviada, analisada ou bloqueada por erro.
- Adicionar seleção de expiração de 1, 2, 3 ou 5 minutos e usar esse tempo tanto na decisão da IA quanto no contador e na avaliação do resultado.
- Manter sinais seletivos: CALL/PUT só aparecem após confirmação; durante a espera, o candidato fica visível sem ser tratado como entrada.
- Tocar sons distintos para candidato, CALL, PUT, WIN e LOSS, com desbloqueio no primeiro clique e teste manual.

## Interface
- Sobrepor ao vídeo linhas horizontais de suporte/resistência, linha de tendência, seta grande de CALL/PUT e etiquetas legíveis.
- Criar uma faixa de status da análise com horário da última leitura, próxima captura, latência e expiração escolhida.
- Reorganizar a lateral para destacar direção, confiança, entrada, expiração e contagem regressiva.
- Preservar o painel detalhado de velas e confluências abaixo do gráfico.

## Técnica
- Ampliar a resposta estruturada da IA com posições normalizadas das marcações visuais e dados de entrada/expiração.
- Validar e limitar todas as coordenadas antes de desenhá-las sobre o vídeo.
- Corrigir o fluxo para evitar análise infinita sem retorno visível: cada chamada terá estado explícito e erros do serviço aparecerão na tela.
- Sincronizar a trava e a avaliação da ordem com a expiração selecionada, em vez de fixar tudo em 60 segundos.

## Verificação
- Validar compilação e erros em execução.
- Testar em tela ampla e móvel se linhas, setas, etiquetas e painéis não se sobrepõem.
- Executar uma análise real com imagem de gráfico e confirmar o novo formato retornado pela IA.
- Testar sons e o contador para cada expiração disponível.
