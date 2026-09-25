# Manual Passo a Passo: Instalação, Configuração e Publicação do GEOCE LabLicence

Este guia foi elaborado para orientar você do zero em todas as etapas de configuração, desde a instalação das ferramentas básicas no Windows até a conexão com o **GitHub**, **Supabase**, **Google OAuth**, **Resend** e deploy na **Vercel**.

---

## 📑 Sumário

1. [Módulo 1: Instalação do Node.js e pnpm no Windows](#módulo-1-instalação-do-nodejs-e-pnpm-no-windows)
2. [Módulo 2: Configuração do Git e Envio para o GitHub](#módulo-2-configuração-do-git-e-envio-para-o-github)
3. [Módulo 3: Configuração do Banco de Dados no Supabase](#módulo-3-configuração-do-banco-de-dados-no-supabase)
4. [Módulo 4: Configuração da Autenticação Google OAuth](#módulo-4-configuração-da-autenticação-google-oauth)
5. [Módulo 5: Configuração do Serviço de E-mail (Resend)](#módulo-5-configuração-do-serviço-de-e-mail-resend)
6. [Módulo 6: Configuração das Variáveis de Ambiente Locais](#módulo-6-configuração-das-variáveis-de-ambiente-locais)
7. [Módulo 7: Instalação de Dependências e Execução Local](#módulo-7-instalação-de-dependências-e-execução-local)
8. [Módulo 8: Publicação Gratuita na Vercel](#módulo-8-publicação-gratuita-na-vercel)
9. [Módulo 9: Resolução de Dúvidas e Problemas Comuns (FAQ)](#módulo-9-resolução-de-dúvidas-e-problemas-comuns-faq)

---

## Módulo 1: Instalação do Node.js e pnpm no Windows

O projeto utiliza o **Next.js 14**, que necessita do ambiente Node.js.

### Passo 1.1 — Instalar o Node.js LTS
1. Acesse o site oficial do Node.js: **[https://nodejs.org/](https://nodejs.org/)**.
2. Baixe a versão recomendada **LTS (Long Term Support)** (versão 20.x ou 22.x).
3. Execute o instalador baixado (`.msi`).
4. Avance pelas telas aceitando os termos padrão (mantenha a opção *"Add to PATH"* marcada).
5. Após concluir, feche e reabra o terminal (PowerShell ou CMD).

### Passo 1.2 — Instalar o gerenciador pnpm
O `pnpm` é o gerenciador de pacotes configurado para este projeto por ser muito mais rápido e econômico em disco.
1. Abra um terminal PowerShell e execute:
   ```powershell
   npm install -g pnpm
   ```
2. Para confirmar que ambos foram instalados com sucesso, digite:
   ```powershell
   node -v
   pnpm -v
   ```
   *Se os números de versão aparecerem (ex: `v22.x.x` e `12.x.x`), o ambiente está pronto.*

---

## Módulo 2: Configuração do Git e Envio para o GitHub

Vamos salvar o projeto no seu GitHub pessoal ou institucional.

### Passo 2.1 — Criar o Repositório no GitHub
1. Acesse **[https://github.com/new](https://github.com/new)**.
2. No campo **Repository name**, digite: `geoce-labManage` (ou o nome que preferir).
3. Escolha a visibilidade: **Public** ou **Private**.
4. **IMPORTANTE**: **NÃO** marque as caixas de "Add a README file", ".gitignore" ou "license", pois já criamos esses arquivos especialmente para você nesta pasta.
5. Clique no botão verde **Create repository**.
6. Copie a URL do seu repositório (ex: `https://github.com/SEU_USUARIO/geoce-labManage.git`).

### Passo 2.2 — Inicializar o Git Local e Fazer o Primeiro Envio
Abra o terminal na pasta do projeto (`c:\Users\Elias\Documents\Programacao\GEOCELabLicence`) e execute:

```powershell
# 1. Inicializar o repositório local
git init

# 2. Configurar o branch principal como main
git branch -M main

# 3. Adicionar todos os arquivos ao controle de versão
git add .

# 4. Criar o primeiro commit
git commit -m "feat: initial commit with geoce lablicence architecture, ui and configs"

# 5. Conectar com o seu repositório do GitHub (substitua pela URL que você copiou)
git remote add origin https://github.com/SEU_USUARIO/geoce-lablicence.git

# 6. Enviar os arquivos para o GitHub
git push -u origin main
```

---

## Módulo 3: Configuração do Banco de Dados no Supabase

O **Supabase** é a plataforma de backend que gerencia o PostgreSQL, WebSockets em tempo real e autenticação.

### Passo 3.1 — Criar a Conta e o Projeto
1. Acesse **[https://supabase.com/](https://supabase.com/)** e faça login ou crie uma conta gratuita (pode entrar direto com seu GitHub).
2. No painel inicial, clique em **+ New Project**.
3. Preencha os dados:
   - **Name**: `geoce-lablicence`
   - **Database Password**: Defina uma senha forte (anote-a!).
   - **Region**: Selecione **South America (São Paulo)** para menor latência no Brasil.
4. Clique em **Create new project** e aguarde 1 a 2 minutos até o banco ser provisionado.

### Passo 3.2 — Executar o Script do Banco de Dados (`schema.sql`)
1. No menu lateral esquerdo do Supabase, clique no ícone **SQL Editor** (ou pressione as teclas de atalho).
2. Clique em **+ New query**.
3. Abra o arquivo [supabase/schema.sql](./supabase/schema.sql) que já foi gerado na sua pasta. Copie todo o conteúdo desse arquivo e cole na caixa de texto do SQL Editor.
4. Clique no botão verde **Run** (ou pressione `Ctrl + Enter`).
5. A mensagem de sucesso *"Success. No rows returned"* será exibida. Pronto! Suas tabelas (`profiles`, `machines`, `reservations`), funções de Fair Sharing, views e políticas de segurança RLS foram criadas.

### Passo 3.3 — Obter as Chaves de Conexão
1. No menu lateral do Supabase, clique na engrenagem **Project Settings** (canto inferior esquerdo).
2. Clique na aba **API**.
3. Localize e copie os seguintes valores:
   - **Project URL** (ex: `https://xyzcompany.supabase.co`) $\rightarrow$ Este será o `NEXT_PUBLIC_SUPABASE_URL`.
   - **Project API keys** $\rightarrow$ `anon` / `public` (ex: `eyJhbGci...`) $\rightarrow$ Este será o `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **Project API keys** $\rightarrow$ `service_role` (clique em *Reveal*) $\rightarrow$ Este será o `SUPABASE_SERVICE_ROLE_KEY`.

---

## Módulo 4: Configuração da Autenticação Google OAuth

Para que os pesquisadores entrem no sistema com a conta Google institucional.

### Passo 4.1 — Obter a Callback URL no Supabase
1. No painel do seu projeto Supabase, vá em **Authentication** $\rightarrow$ **URL Configuration**.
2. No menu lateral, clique em **Providers** e selecione **Google**.
3. Copie a **Callback URL (for OAuth)** exibida (ex: `https://<seu-projeto>.supabase.co/auth/v1/callback`). Mantenha essa aba aberta.

### Passo 4.2 — Criar Credenciais no Google Cloud Console
1. Acesse o **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Crie um novo projeto (ex: `GEOCE LabLicence`).
3. Vá no menu de navegação $\rightarrow$ **APIs e Serviços** $\rightarrow$ **Tela de permissão OAuth (OAuth consent screen)**:
   - Escolha **Externo** (External) ou **Interno** (se tiver Google Workspace na UFC).
   - Preencha o nome do app: `GEOCE LabLicence`.
   - Coloque seu e-mail de suporte.
   - Salve e avance pelas etapas mantendo os escopos padrão (`email`, `profile`, `openid`).
4. Agora vá em **APIs e Serviços** $\rightarrow$ **Credenciais**:
   - Clique em **+ Criar Credenciais** $\rightarrow$ **ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web (Web application)**.
   - Nome: `GEOCE Web Client`.
   - Em **URIs de redirecionamento autorizados (Authorized redirect URIs)**:
     - Clique em **+ Adicionar URI** e cole a Callback URL copiada do Supabase (ex: `https://<seu-projeto>.supabase.co/auth/v1/callback`).
     - Para testes locais, em **Origens JavaScript autorizadas (Authorized JavaScript origins)**, adicione: `http://localhost:3000`.
   - Clique em **Criar**.
5. Uma janela exibirá seu **ID do Cliente (Client ID)** e a **Chave Secreta do Cliente (Client Secret)**. Copie ambos.

### Passo 4.3 — Ativar o Google no Supabase
1. Volte à aba do Supabase em **Authentication** $\rightarrow$ **Providers** $\rightarrow$ **Google**.
2. Marque a chave **Enable Google provider**.
3. Cole o **Client ID** e o **Client Secret**.
4. Clique em **Save**.

---

## Módulo 5: Configuração do Serviço de E-mail (Resend)

O **Resend** envia automaticamente e-mails de boas-vindas para o pesquisador e alertas de auditoria para o administrador.

1. Acesse **[https://resend.com/](https://resend.com/)** e faça login gratuito.
2. No menu lateral, clique em **API Keys**.
3. Clique em **+ Create API Key**:
   - Nome: `geoce-lablicence`
   - Permissão: `Full access`
4. Copie a chave gerada (iniciada por `re_...`).
> **Dica**: No plano gratuito, enquanto você não cadastra um domínio próprio da UFC (`@geoce.ufc.br`), o Resend permite enviar testes normalmente para o próprio e-mail com o qual você cadastrou sua conta no Resend utilizando o remetente padrão `onboarding@resend.dev`.

---

## Módulo 6: Configuração das Variáveis de Ambiente Locais

Na raiz da sua pasta `GEOCELabLicence`:

1. Crie uma cópia do arquivo `.env.example` e renomeie para `.env.local`:
   ```powershell
   Copy-Item .env.example .env.local
   ```
2. Abra o arquivo `.env.local` e preencha com as chaves que você coletou:

```env
# Supabase Configuration (coletado no Módulo 3)
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-anon-key-aqui"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key-aqui"

# Resend Mail Configuration (coletado no Módulo 5)
RESEND_API_KEY="re_sua_chave_resend_aqui"
ADMIN_ALERT_EMAIL="seu-email-adm@ufc.br"

# Application Settings
NEXT_PUBLIC_APP_NAME="GEOCE LabLicence"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> **Aviso de Segurança**: O arquivo `.env.local` está configurado no seu `.gitignore`, o que significa que ele **nunca** será exposto no GitHub.

---

## Módulo 7: Instalação de Dependências e Execução Local

Agora você pode testar a aplicação no seu computador!

Abra o PowerShell na pasta `GEOCELabLicence` e execute:

```powershell
# 1. Instalar as dependências do projeto
pnpm install

# 2. Iniciar o servidor de desenvolvimento
pnpm dev
```

Abra o seu navegador e acesse:
👉 **`http://localhost:3000`**

Você verá o painel do **GEOCE LabLicence**, poderá logar com o Google, visualizar as máquinas cadastradas, testar a fila em tempo real e agendar reservas respeitando o Fair Sharing!

---

## Módulo 8: Publicação Gratuita na Vercel

A Vercel publica o site na internet gratuitamente com certificado SSL e domínio HTTPS automático.

1. Acesse **[https://vercel.com/](https://vercel.com/)** e faça login com sua conta do GitHub.
2. Clique em **Add New...** $\rightarrow$ **Project**.
3. Localize o seu repositório `geoce-lablicence` na lista e clique em **Import**.
4. Na tela de configuração:
   - **Framework Preset**: Já estará como `Next.js`.
   - Expanda a seção **Environment Variables** e adicione as mesmas variáveis do seu `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `RESEND_API_KEY`
     - `ADMIN_ALERT_EMAIL`
     - `NEXT_PUBLIC_APP_NAME`
     - `NEXT_PUBLIC_APP_URL` (coloque a URL da Vercel após o deploy, ex: `https://geoce-lablicence.vercel.app`)
5. Clique em **Deploy**.
6. Em menos de 2 minutos seu sistema estará publicado na nuvem!
7. **Último Ajuste**: Copie o domínio gerado pela Vercel (ex: `https://geoce-lablicence.vercel.app`) e adicione-o no Supabase (em *Authentication* $\rightarrow$ *URL Configuration* $\rightarrow$ *Site URL* e *Redirect URLs*) e no Google Cloud Console (*Origens JavaScript autorizadas*).

---

## Módulo 9: Resolução de Dúvidas e Problemas Comuns (FAQ)

### 1. "O login social dá erro de Redirect URI mismatch"
- **Solução**: Verifique se a URL cadastrada no Google Cloud Console em *URIs de redirecionamento autorizados* é exatamente a Callback URL fornecida pelo Supabase (`https://<projeto>.supabase.co/auth/v1/callback`).

### 2. "Como definir um usuário como Administrador?"
- Por padrão, novos usuários são criados com o papel `student`. Para promover um usuário a administrador:
  1. No Supabase, abra o **Table Editor**.
  2. Selecione a tabela `profiles`.
  3. Encontre a linha do seu usuário e mude o campo `role` de `student` para `admin`.
  4. Recarregue a página do sistema: os menus de **Gestão do Laboratório** e **Métricas** ficarão acessíveis.

### 3. "Como funciona o bloqueio de cota (Fair Sharing)?"
- O sistema valida a cota em duas camadas:
  1. **No Front-end**: O formulário bloqueia durações maiores que 4h ou superiores ao saldo semanal restante.
  2. **No Banco de Dados**: A trigger `trg_validate_quota` impede qualquer tentativa de inserção que viole a regra dos últimos 7 dias, retornando uma exceção amigável.

---
Laboratório GEOCE — Universidade Federal do Ceará (UFC)
