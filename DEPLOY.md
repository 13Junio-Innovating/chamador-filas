# 🚀 Deploy em Produção - Costão Chamador Recepção

## ✅ Pré-requisitos Concluídos

- [x] Build de produção gerado com sucesso
- [x] Variáveis de ambiente configuradas
- [x] Aplicação testada localmente
- [x] Configuração do Vercel preparada

## 📦 Arquivos de Build

O build de produção foi gerado na pasta `dist/` com os seguintes arquivos:

```
dist/
├── assets/
│   ├── index-CsugfgYI.css (63.14 kB)
│   └── index-ZqnhBtfm.js (1.75 MB)
├── favicon*.webp (vários tamanhos)
└── index.html
```

## 🌐 Opções de Deploy

### 1. Vercel (Recomendado)

A aplicação já está configurada para deploy no Vercel:

```bash
# Instalar Vercel CLI (se não tiver)
npm i -g vercel

# Deploy
vercel

# Deploy em produção
vercel --prod
```

### 2. Netlify

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --dir=dist

# Deploy em produção
netlify deploy --prod --dir=dist
```

### 3. GitHub Pages

1. Faça push do código para GitHub
2. Vá em Settings > Pages
3. Configure source como "GitHub Actions"
4. Use o workflow de build automático

### 4. Servidor Próprio

Copie o conteúdo da pasta `dist/` para seu servidor web (Apache, Nginx, etc.)

## ⚙️ Configurações de Produção

### Variáveis de Ambiente

Arquivo `.env.production` criado com:

```env
VITE_SUPABASE_PROJECT_ID="irzwlvdjaygewlpoyfgv"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
VITE_SUPABASE_URL="https://irzwlvdjaygewlpoyfgv.supabase.co"
VITE_API_BASE_URL=https://your-backend-domain.com
```

**⚠️ IMPORTANTE:** Atualize `VITE_API_BASE_URL` com a URL do seu backend em produção.

### Backend

O backend também precisa ser deployado separadamente. Opções:

- **Railway**: `railway deploy`
- **Heroku**: `git push heroku main`
- **DigitalOcean App Platform**
- **AWS/Google Cloud/Azure**

## 🔧 Configurações do Servidor

### Nginx

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Apache (.htaccess)

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## 📊 Otimizações

O build atual tem um chunk grande (1.75 MB). Para otimizar:

1. **Code Splitting**: Implementar lazy loading
2. **Chunk Manual**: Configurar `rollupOptions.output.manualChunks`
3. **Tree Shaking**: Remover código não utilizado

## 🔍 Verificações Pós-Deploy

- [ ] Aplicação carrega corretamente
- [ ] Todas as rotas funcionam
- [ ] Conexão com Supabase OK
- [ ] Conexão com backend OK
- [ ] Responsividade em dispositivos móveis
- [ ] Performance satisfatória

## 🆘 Troubleshooting

### Erro 404 em rotas

Certifique-se de que o servidor está configurado para servir `index.html` para todas as rotas (SPA).

### Erro de CORS

Configure o backend para aceitar requests do domínio de produção.

### Variáveis de ambiente não carregam

Verifique se as variáveis começam com `VITE_` e estão no arquivo correto.

---

**Status**: ✅ Pronto para deploy
**Data**: ${new Date().toLocaleDateString('pt-BR')}