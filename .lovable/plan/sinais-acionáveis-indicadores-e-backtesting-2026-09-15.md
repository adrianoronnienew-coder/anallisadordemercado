# Sinais acionáveis, indicadores e backtesting

## Resultado
- Manter suporte, resistência e linha de tendência congelados durante toda a expiração selecionada; só recalcular ao fim desse prazo ou quando o usuário solicitar uma nova leitura estrutural.
- Separar visualmente “OBSERVAR” de “ENTRADA AGORA”: candidato terá seta contornada e aviso discreto; sinal confirmado terá seta sólida grande, comando “COMPRE AGORA” ou “VENDA AGORA” e alerta sonoro repetido.
- Mostrar por que não houve entrada, com os critérios pendentes e a próxima condição objetiva necessária, sem inventar sinais quando não houver confirmação.
- Adicionar zoom e seleção da área do gráfico dentro do Signal Vision. O site não controlará outra aba da IQ Option; isso exigiria uma extensão separada e permissões explícitas do navegador.

## Indicadores e regras
- Ampliar a leitura para EMA 9/21/50, RSI, MACD, Estocástico, Bollinger, ATR/volatilidade, volume, ADX/força de tendência, estrutura, suporte/resistência, padrões de vela e Fibonacci.
- Somente considerar como confirmação indicadores realmente visíveis; estimativas feitas por pixels serão identificadas como estimadas.
- Ajustar a confirmação para duas leituras consecutivas coerentes, score mínimo e ausência de bloqueadores fortes, exibindo o checklist de aprovação.
- Não alegar incorporação literal dos dois e-books sem os arquivos disponíveis nesta sessão; preservar apenas as regras já verificáveis presentes no sistema.

## Backtesting
- Criar um painel de backtesting da sessão usando os sinais confirmados e seus resultados avaliados, com quantidade, WIN, LOSS, indefinidos, taxa de acerto e detalhamento por CALL/PUT e expiração.
- Permitir exportar os resultados em CSV e limpar apenas os dados do teste, separadamente do aprendizado.
- Identificar claramente que esse teste mede a sessão capturada e não substitui backtesting histórico por candles OHLC.

## Verificação
- Validar compilação e erros de execução.
- Testar zoom, seleção da área, fixidez das linhas, estados das setas e sons no navegador.
- Fazer uma chamada real de análise e confirmar que erros do serviço aparecem na tela.
