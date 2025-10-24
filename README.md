# Sistema de Chamadas

## Descrição

O Sistema de Chamadas é uma aplicação web desenvolvida para gerenciar filas de atendimento, permitindo o controle eficiente de senhas, chamadas, relatórios e administração de usuários. Ideal para recepções, clínicas, hotéis e ambientes que necessitam organizar o fluxo de atendimento.

---

## Funcionalidades

- **Gestão de Senhas:** Geração, chamada, retorno e finalização de senhas.
- **Painel de Chamadas:** Visualização em tempo real das senhas chamadas e aguardando.
- **Administração:** Gerenciamento de atendentes, guichês e configurações do sistema.
- **Relatórios:** Exportação e visualização de dados de atendimento.
- **Autenticação:** Login seguro para administradores e atendentes.
- **Reset e Atualização de Senha:** Recuperação e alteração de senha de usuário.
- **Responsividade:** Interface adaptada para desktop e dispositivos móveis.
- **Notificações:** Alertas visuais e sonoros para novas chamadas.

---

## Tecnologias Utilizadas

- **Frontend:** [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **UI:** [shadcn-ui](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- **Gerenciamento de Estado:** [React Query](https://tanstack.com/query/latest)
- **Backend:** [Supabase](https://supabase.com/) (Banco de dados e autenticação)
- **Outros:** Radix UI, Lucide Icons, ESLint, PostCSS

---

## Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/13Junio-Innovating/costao-chamador-recepcao.git
   cd costao-chamador-recepcao
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure o ambiente:**
   - Renomeie `.env.example` para `.env` e preencha as variáveis conforme sua configuração do Supabase.

4. **Execute o projeto:**
   ```bash
   npm run dev
   ```
   O sistema estará disponível em `http://localhost:5173`.

---

## Estrutura de Pastas

```
├── public/                # Arquivos públicos (favicon, imagens, etc.)
├── src/                   # Código-fonte principal
│   ├── components/        # Componentes reutilizáveis
│   ├── hooks/             # Hooks customizados
│   ├── pages/             # Páginas do sistema (Admin, Painel, Relatórios, etc.)
│   ├── integrations/      # Integração com Supabase
│   ├── lib/               # Funções utilitárias
├── supabase/              # Configurações e migrações do banco de dados
├── README.md              # Documentação do projeto
├── package.json           # Dependências e scripts
└── ...                    # Outros arquivos de configuração
```

---

## Rotas da Aplicação

| Rota                | Descrição                                 |
|---------------------|-------------------------------------------|
| `/`                 | Página inicial                            |
| `/login`            | Login de usuário                          |
| `/register`         | Cadastro de novo usuário                  |
| `/admin`            | Painel administrativo                     |
| `/atendente`        | Área do atendente                         |
| `/painel`           | Painel de chamadas                        |
| `/relatorios`       | Relatórios de atendimento                 |
| `/reset-password`   | Recuperação de senha                      |
| `/update-password`  | Atualização de senha                      |
| `*`                 | Página de erro 404                        |

---

## Endpoints Supabase (Exemplo)

> Os endpoints abaixo são exemplos de uso do Supabase via client JS. As queries são feitas diretamente pelo SDK, mas seguem a estrutura abaixo:

### Senhas
- **Buscar senhas:**
  ```js
  supabase.from('senhas').select('*')
  ```
- **Criar senha:**
  ```js
  supabase.from('senhas').insert({ tipo, numero, status })
  ```
- **Atualizar senha:**
  ```js
  supabase.from('senhas').update({ status: 'chamando' }).eq('id', senhaId)
  ```

### Usuários
- **Registrar usuário:**
  ```js
  supabase.auth.signUp({ email, password })
  ```
- **Login:**
  ```js
  supabase.auth.signInWithPassword({ email, password })
  ```
- **Reset de senha:**
  ```js
  supabase.auth.resetPasswordForEmail(email)
  ```

### Relatórios
- **Buscar dados para relatório:**
  ```js
  supabase.from('senhas').select('*').eq('status', 'atendida')
  ```

---

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Importe as migrações SQL do diretório `supabase/migrations/`.
3. Configure as variáveis de ambiente no arquivo `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

---

## Como Contribuir

1. Faça um fork do projeto.
2. Crie uma branch para sua feature ou correção:
   ```bash
   git checkout -b minha-feature
   ```
3. Commit suas alterações:
   ```bash
   git commit -m "Descrição da alteração"
   ```
4. Envie para o repositório remoto:
   ```bash
   git push origin minha-feature
   ```
5. Abra um Pull Request.

---

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## Contato

Dúvidas, sugestões ou problemas? Entre em contato pelo [GitHub Issues](https://github.com/13Junio-Innovating/costao-chamador-recepcao/issues) ou envie um e-mail para o mantenedor do projeto.
