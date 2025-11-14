## Objetivo
- Corrigir erros de compilação e lint em `Home.tsx` e `Painel.tsx`.
- Implementar e usar nomes/códigos padronizados (ATNP/ATNC, CIEP/CIEC, CINP/CINC, CIPP/CIPC, COXP/COXC) com 4 dígitos e hífen.
- Garantir que a voz anuncie a senha e o guichê completamente antes de seguir para a próxima.
- Ajustar o fluxo de Check-in: proprietário? → se não; fez web check-in? → se sim; é prioritário por lei? → Express prioritário senão Express comum.

## Problemas Detectados
- `Home.tsx`: texto solto “check-in” quebrando sintaxe (src/pages/Home.tsx:25).
- `Home.tsx`: chamadas a `getNomeTicket()` e `getCodigoTicket()` sem definição (src/pages/Home.tsx:279, 280, 438, 443).
- `Painel.tsx`: `beep` usado antes de declarado (src/pages/Painel.tsx:191, 232).
- Hints de variáveis não usadas em `Painel.tsx` após mudança de lógica.

## Correções Propostas
### Home.tsx
1. Remover a linha solta “check-in” no início do componente (src/pages/Home.tsx:25).
2. Adicionar funções utilitárias dentro do componente:
   - `getNomeTicket()` e `getCodigoTicket()` baseadas em:
     - Check-in Express/Normal/Proprietário + prioridade → nomes e códigos conforme a sua tabela; código `CIEP/CIEC`, `CINP/CINC`, `CIPP/CIPC` com `-0000`.
     - Atendimento → `ATNP/ATNC-0000`.
     - Check-out → `COXP/COXC-0000`.
     - Fallback legado quando não houver contexto.
3. Atualizar impressão para usar `getNomeTicket()` e `getCodigoTicket()` já está feito; manter.

### Painel.tsx
1. Mover a função `beep()` para cima, antes de `executarAnuncioSenha` e `executarAnuncioGrupo`, ou declarar como `function` e posicioná-la acima, removendo o erro "used before its declaration".
2. Em `executarAnuncioSenha` e `executarAnuncioGrupo`:
   - Usar `getCodigoComposto(senha)` (já adicionado) para formar o código com 4 dígitos e hífen.
   - Falar: "Senha <CÓDIGO>, dirigir-se ao guichê X. Repito: Senha <CÓDIGO>, guichê X." e tocar `beep()` antes de `speechSynthesis.speak(...)`.
   - Remover variáveis não usadas (`tipoNorm`, `prefixoMap`).
3. Garantir que as listas do painel exibam os novos códigos (`getCodigoComposto`) em vez de prefixo + 3 dígitos.

### Fluxo de Check-in
- `src/components/FluxoPerguntas.tsx`: já ajustado para o caminho solicitado (proprietário? → web check-in? → prioridade). Manter perguntas e remoções da etapa E-FNRH.
- Registrar tags em `observacoes` na criação de senhas do Check-in: `checkin:<express|normal|proprietario>; prioridade:<prioritario|comum>` para que o Painel consiga compor o código corretamente.

## Verificação
- Rodar o frontend (`vite`) e backend (Express) já em execução.
- Testar manualmente:
  - Atendimento e Check-out perguntam prioridade e geram `ATNP/ATNC` e `COXP/COXC` com 4 dígitos.
  - Fluxo Check-in produz `CIEP/CIEC`, `CINP/CINC`, `CIPP/CIPC` conforme respostas.
  - Painel fala e repete a senha + guichê, e exibe códigos com hífen.
- Garantir que não existam mais erros de lint/TS.

## Alterações Pontuais (com referências)
- Remoção de texto solto: `src/pages/Home.tsx:25`.
- Adição de utilitários: `getNomeTicket`, `getCodigoTicket` em `src/pages/Home.tsx` (após `getPrefixoComposto`).
- Reordenação da função `beep`: `src/pages/Painel.tsx` (acima de `executarAnuncioSenha` ~ linhas 150–200).
- Limpeza de variáveis não usadas em `Painel.tsx` (linhas ~155–166).

Confirma aplicar as correções descritas para eliminar os erros e padronizar os códigos/anúncios?