# 🚀 Deploy do Backend - Costão Chamador Recepção

## ✅ Arquivos de Deploy Preparados

- [x] `.env.production` - Variáveis de ambiente para produção
- [x] `Dockerfile` - Containerização da aplicação
- [x] `.dockerignore` - Otimização do build Docker
- [x] `railway.json` - Configuração para Railway
- [x] `render.yaml` - Configuração para Render
- [x] `package.json` - Scripts e engines atualizados

## 🌐 Plataformas de Deploy Recomendadas

### 1. Railway (Recomendado) 🚂

**Vantagens:**
- Deploy automático via Git
- PostgreSQL integrado
- Configuração simples
- Plano gratuito generoso

**Passos:**
1. Acesse [railway.app](https://railway.app)
2. Conecte seu repositório GitHub
3. Selecione a pasta `backend/`
4. Configure as variáveis de ambiente
5. Deploy automático!

**Variáveis de Ambiente Necessárias:**
```env
NODE_ENV=production
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
JWT_REFRESH_SECRET=seu_refresh_secret_super_seguro_aqui
CORS_ORIGIN=https://seu-frontend.vercel.app
```

### 2. Render 🎨

**Vantagens:**
- Plano gratuito
- SSL automático
- Deploy via Git

**Passos:**
1. Acesse [render.com](https://render.com)
2. Conecte repositório GitHub
3. Use o arquivo `render.yaml` incluído
4. Configure variáveis de ambiente
5. Deploy!

### 3. Heroku 🟣

**Passos:**
```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Criar app (na pasta backend/)
cd backend
heroku create costao-chamador-backend

# Configurar variáveis
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=seu_secret_aqui
heroku config:set JWT_REFRESH_SECRET=seu_refresh_secret_aqui

# Deploy
git subtree push --prefix backend heroku main
```

### 4. DigitalOcean App Platform 🌊

1. Acesse DigitalOcean App Platform
2. Conecte repositório
3. Configure source como `backend/`
4. Adicione variáveis de ambiente
5. Deploy!

## 🗄️ Banco de Dados

### Railway PostgreSQL
```bash
# Railway fornece automaticamente:
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Supabase (Atual)
```env
DB_HOST=db.irzwlvdjaygewlpoyfgv.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=sua_senha_supabase
DB_SSL=true
```

### Render PostgreSQL
```bash
# Render fornece:
DATABASE_URL=postgresql://...
```

## 🔧 Configurações de Produção

### Variáveis de Ambiente Obrigatórias

```env
# Servidor
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Banco de Dados
DB_HOST=seu_host
DB_PORT=5432
DB_NAME=seu_database
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_SSL=true

# JWT (GERAR NOVOS SECRETS!)
JWT_SECRET=jwt_secret_super_seguro_32_chars_min
JWT_REFRESH_SECRET=refresh_secret_super_seguro_32_chars

# CORS (Atualizar com domínio do frontend)
CORS_ORIGIN=https://seu-frontend.vercel.app
CORS_CREDENTIALS=true

# Segurança
TRUST_PROXY=true
SECURE_COOKIES=true
LOG_LEVEL=warn
```

## 🚀 Deploy Rápido com Railway

### Opção 1: Interface Web
1. Vá para [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Selecione seu repositório
4. Configure Root Directory: `backend`
5. Adicione variáveis de ambiente
6. Deploy!

### Opção 2: CLI
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Na pasta backend
cd backend

# Inicializar projeto
railway init

# Configurar variáveis
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=seu_secret_aqui
railway variables set JWT_REFRESH_SECRET=seu_refresh_secret_aqui
railway variables set CORS_ORIGIN=https://seu-frontend.vercel.app

# Deploy
railway up
```

## 🔍 Verificações Pós-Deploy

### Health Check
```bash
curl https://seu-backend.railway.app/health
```

### Endpoints Principais
- `GET /health` - Status da aplicação
- `POST /api/auth/login` - Login
- `GET /api/passwords` - Listar senhas
- `POST /api/passwords` - Gerar senha

### Logs
```bash
# Railway
railway logs

# Heroku
heroku logs --tail

# Render
# Via dashboard web
```

## 🔒 Segurança

### Secrets para Gerar
```bash
# JWT Secret (32+ caracteres)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Refresh Secret (32+ caracteres)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Checklist de Segurança
- [ ] Secrets únicos gerados
- [ ] CORS configurado corretamente
- [ ] SSL habilitado (automático nas plataformas)
- [ ] Rate limiting ativo
- [ ] Logs configurados
- [ ] Variáveis sensíveis não commitadas

## 🔄 Atualizar Frontend

Após deploy do backend, atualize o frontend:

```env
# .env.production (frontend)
VITE_API_BASE_URL=https://seu-backend.railway.app
```

## 📊 Monitoramento

### Railway
- Dashboard com métricas automáticas
- Logs em tempo real
- Alertas de erro

### Render
- Métricas de performance
- Logs centralizados
- Health checks automáticos

---

**Status**: ✅ Pronto para deploy
**Plataforma Recomendada**: Railway
**Tempo Estimado**: 10-15 minutos