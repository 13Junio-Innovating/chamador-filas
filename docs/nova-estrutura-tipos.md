# Nova Estrutura de Tipos de Senha

## Análise do Fluxograma

Baseado no fluxograma fornecido, identificamos os seguintes tipos de usuários e suas respectivas prioridades:

### Tipos de Check-in
1. **Proprietário** - Usuários que são proprietários
   - Proprietário Prioritário
   - Proprietário Comum

2. **Express** - Usuários que fazem check-in via web ou são prioritários por lei
   - Express Prioritário (idosos, gestantes, etc.)
   - Express Comum

3. **Normal** - Usuários que fazem check-in presencial
   - Normal Prioritário (idosos, gestantes, etc.)
   - Normal Comum

## Nova Estrutura de Banco de Dados

### Campos Propostos
- `tipo_checkin`: 'proprietario' | 'express' | 'normal'
- `prioridade`: 'prioritario' | 'comum'

### Tipos Compostos Resultantes
1. `proprietario_prioritario`
2. `proprietario_comum`
3. `express_prioritario`
4. `express_comum`
5. `normal_prioritario`
6. `normal_comum`

## Ordem de Atendimento (Prioridade)
1. Proprietário Prioritário
2. Proprietário Comum
3. Express Prioritário
4. Express Comum
5. Normal Prioritário
6. Normal Comum

## Prefixos Sugeridos
- **P** - Proprietário (P001, P002...)
- **E** - Express (E001, E002...)
- **N** - Normal (N001, N002...)

## Implementação
- Manter compatibilidade com sistema atual
- Migração gradual dos tipos existentes
- Atualização das interfaces e validações