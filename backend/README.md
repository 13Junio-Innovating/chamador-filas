# Costão Chamador - Backend API

Backend Node.js/Express para o sistema de chamador de recepção do Costão do Santinho.

## 🚀 Tecnologias

- **Node.js 18+** - Runtime JavaScript
- **Express.js** - Framework web
- **PostgreSQL** - Banco de dados
- **Socket.IO** - Comunicação em tempo real
- **JWT** - Autenticação
- **Winston** - Sistema de logs
- **PM2** - Gerenciador de processos (produção)

## 📋 Pré-requisitos

- Node.js 18.0.0 ou superior
- PostgreSQL 15 ou superior
- npm 9.0.0 ou superior

## 🔧 Instalação

1. **Clone o repositório e navegue para o backend:**
```bash
cd backend
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. **Configure o banco de dados PostgreSQL:**
```bash
# Execute as migrações
npm run migrate

# Execute os seeds (dados iniciais)
npm run seed
```

## 🏃‍♂️ Executando

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── config/          # Configurações da aplicação
│   ├── controllers/     # Controladores das rotas
│   ├── database/        # Configuração e migrações do banco
│   ├── middleware/      # Middlewares customizados
│   ├── models/          # Modelos de dados
│   ├── routes/          # Definição das rotas
│   ├── utils/           # Utilitários e helpers
│   └── server.js        # Arquivo principal do servidor
├── logs/                # Arquivos de log
├── scripts/             # Scripts de automação
├── .env.example         # Exemplo de variáveis de ambiente
└── package.json         # Dependências e scripts
```

## 🔐 Autenticação

O sistema utiliza JWT (JSON Web Tokens) para autenticação:

- **Access Token**: Válido por 24 horas
- **Refresh Token**: Válido por 7 dias
- **Middleware de autenticação**: Protege rotas privadas

## 📡 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login do usuário
- `POST /api/auth/register` - Registro de novo usuário
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Logout do usuário

### Senhas
- `GET /api/senhas` - Listar senhas
- `POST /api/senhas` - Gerar nova senha
- `PUT /api/senhas/:id/chamar` - Chamar senha
- `PUT /api/senhas/:id/atender` - Atender senha

### Usuários (Admin)
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Deletar usuário

### Relatórios
- `GET /api/reports/daily` - Relatório diário
- `GET /api/reports/monthly` - Relatório mensal
- `GET /api/reports/export` - Exportar relatórios

## 🔄 WebSocket Events

### Cliente → Servidor
- `join-room` - Entrar em uma sala
- `call-password` - Chamar senha
- `attend-password` - Atender senha

### Servidor → Cliente
- `password-called` - Senha foi chamada
- `password-attended` - Senha foi atendida
- `queue-updated` - Fila foi atualizada

## 📊 Logging e Monitoramento

### Logs
- **Aplicação**: `logs/application-YYYY-MM-DD.log`
- **Erro**: `logs/error-YYYY-MM-DD.log`
- **Acesso**: `logs/access-YYYY-MM-DD.log`

### Monitoramento
- **Health Check**: `GET /health`
- **Métricas**: `GET /metrics`

## 🗄️ Backup Automático

O sistema inclui backup automático do PostgreSQL:

- **Frequência**: Diário às 02:00
- **Retenção**: 30 dias
- **Localização**: `/var/backups/costao-chamador/`
- **Tipos**: 
  - Backup completo (pg_dump)
  - WAL archiving (incremental)

## 🚀 Deploy

### Usando PM2 (Recomendado)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start ecosystem.config.js

# Monitorar
pm2 monit

# Logs
pm2 logs
```

### Usando Docker
```bash
# Build da imagem
docker build -t costao-chamador-backend .

# Executar container
docker run -p 3001:3001 --env-file .env costao-chamador-backend
```

## 🔧 Scripts Disponíveis

- `npm run dev` - Executar em modo desenvolvimento
- `npm start` - Executar em modo produção
- `npm test` - Executar testes
- `npm run migrate` - Executar migrações do banco
- `npm run seed` - Executar seeds do banco

## 🛡️ Segurança

- **Helmet.js** - Headers de segurança
- **Rate Limiting** - Limitação de requisições
- **CORS** - Configuração de CORS
- **Validação** - Validação de entrada com express-validator
- **Sanitização** - Sanitização de dados

## 📝 Variáveis de Ambiente

Consulte o arquivo `.env.example` para ver todas as variáveis de ambiente necessárias.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte técnico, entre em contato com a equipe de desenvolvimento do Costão do Santinho.