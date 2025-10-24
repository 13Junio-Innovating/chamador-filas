# Documentação da Migração - Costão Chamador Recepção

## Estado Atual do Projeto (v1.0-supabase)

### Estrutura do Projeto

```
costao-chamador-recepcao/
├── .env                          # Variáveis de ambiente (Supabase)
├── .gitignore
├── README.md
├── package.json                  # Dependências do projeto
├── vite.config.ts               # Configuração do Vite
├── tailwind.config.ts           # Configuração do Tailwind CSS
├── components.json              # Configuração do shadcn/ui
├── vercel.json                  # Configuração para deploy no Vercel
├── public/                      # Assets estáticos
│   └── favicon*.webp           # Ícones da aplicação
├── src/
│   ├── App.tsx                 # Componente principal
│   ├── main.tsx                # Entry point da aplicação
│   ├── components/             # Componentes reutilizáveis
│   │   ├── Layout.tsx          # Layout principal
│   │   ├── SenhaCard.tsx       # Card de exibição de senhas
│   │   └── ui/                 # Componentes UI (shadcn/ui)
│   ├── pages/                  # Páginas da aplicação
│   │   ├── Home.tsx            # Página inicial (geração de senhas)
│   │   ├── Admin.tsx           # Painel administrativo
│   │   ├── Atendente.tsx       # Interface do atendente
│   │   ├── Painel.tsx          # Painel de exibição de senhas
│   │   ├── Login.tsx           # Página de login
│   │   ├── Register.tsx        # Página de registro
│   │   ├── Relatorios.tsx      # Relatórios
│   │   └── outros...
│   ├── integrations/
│   │   └── supabase/           # Integração com Supabase
│   │       ├── client.ts       # Cliente Supabase
│   │       └── types.ts        # Tipos TypeScript do banco
│   ├── hooks/                  # Custom hooks
│   └── lib/                    # Utilitários
└── supabase/                   # Configuração Supabase local
    ├── config.toml
    └── migrations/             # Migrações do banco
        ├── 20251005152504_*.sql
        ├── 20251005152529_*.sql
        └── 20251005170000_add_hospede_type.sql
```

### Tecnologias Atuais

#### Frontend
- **React 18.3.1** - Framework principal
- **TypeScript** - Linguagem de programação
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS
- **shadcn/ui** - Biblioteca de componentes UI
- **React Router DOM** - Roteamento
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de schemas
- **TanStack Query** - Gerenciamento de estado servidor
- **Recharts** - Gráficos e relatórios

#### Backend/Database
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Row Level Security (RLS)

#### Integração Atual com Supabase
```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
```

### Funcionalidades Principais

1. **Geração de Senhas**
   - Diferentes tipos: normal, prioritário, hóspede
   - Fluxo específico para hóspedes com check-in express
   - Numeração sequencial por tipo

2. **Painel de Atendimento**
   - Chamada de senhas
   - Controle de filas
   - Interface para atendentes

3. **Painel de Exibição**
   - Exibição em tempo real das senhas chamadas
   - Interface para TVs/monitores

4. **Administração**
   - Gerenciamento de usuários
   - Configurações do sistema
   - Relatórios de atendimento

5. **Autenticação**
   - Login/logout
   - Registro de usuários
   - Reset de senha
   - Controle de acesso por perfil

### Estrutura do Banco de Dados (Supabase)

#### Tabelas Principais
- `senhas` - Armazena as senhas geradas
- `usuarios` - Usuários do sistema
- `configuracoes` - Configurações gerais
- `atendimentos` - Histórico de atendimentos

#### Enums
- `senha_tipo` - Tipos de senha (normal, prioritario, hospede)
- `senha_status` - Status da senha (aguardando, chamada, atendida)

### Variáveis de Ambiente Atuais
```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
VITE_SUPABASE_PROJECT_ID=[project-id]
```

### Dependências Principais
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.75.0",
    "@tanstack/react-query": "^5.83.0",
    "react": "^18.3.1",
    "react-router-dom": "^6.30.1",
    "react-hook-form": "^7.61.1",
    "zod": "^3.25.76"
  }
}
```

## Plano de Migração

### Objetivo
Migrar de Supabase (BaaS) para servidor dedicado com PostgreSQL, mantendo todas as funcionalidades atuais e adicionando:
- Sistema de backup automático
- Logging e monitoramento avançado
- Maior controle sobre a infraestrutura
- Melhor performance para alto tráfego

### Próximos Passos
1. ✅ Criar backup/tag do estado atual (v1.0-supabase)
2. ✅ Criar branch para migração (migration-postgresql)
3. ✅ Documentar estrutura atual
4. 🔄 Preparar ambiente para desenvolvimento do backend
5. 📋 Desenvolver backend Node.js/Express
6. 📋 Migrar autenticação para JWT
7. 📋 Configurar PostgreSQL dedicado
8. 📋 Implementar sistema de backup
9. 📋 Configurar logging e monitoramento
10. 📋 Testes e deploy

### Arquivos que Precisarão ser Modificados
- `src/integrations/supabase/` → `src/api/` (nova estrutura)
- Todas as páginas que usam Supabase client
- Configuração de autenticação
- Variáveis de ambiente
- Scripts de build e deploy

---
*Documento criado em: $(Get-Date)*
*Branch: migration-postgresql*
*Tag de backup: v1.0-supabase*