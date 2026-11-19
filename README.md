# Roleta Interativa — Biomedicina UCPel (Pelotas/RS)

Aplicação web em **Next.js (App Router)** pronta para **deploy na Vercel** com integração ao **Supabase (PostgreSQL)**, estilizada com base na identidade visual da **Universidade Católica de Pelotas (UCPel)** e do curso de **Biomedicina** (Nota 5 MEC).

## Funcionalidades

- **Roleta dinâmica ligada ao banco**: os itens são carregados do Supabase e sorteados no servidor pela função PostgreSQL atômica `spin_roulette`.
- **Remoção automática do item ganho**: ao girar e ganhar um item, ele é marcado como indisponível no banco (`is_available = false`) e **some da roleta** imediatamente.
- **Cadastro e validação oficial de CPF**: exige **Nome completo** e **CPF** válido (com verificação dos dígitos verificadores no cliente e no banco) antes de girar, salvando ambos no Supabase.
- **Privacidade (LGPD)**: o CPF completo fica protegido no servidor/banco; na tabela pública de ganhadores o CPF aparece mascarado (`***.456.789-**`).
- **Painel da Coordenação (`/admin`)**: protegido por senha (`ADMIN_PASSWORD`), permite adicionar itens (inclusive em lotes de 1 a 20 unidades), restaurar prêmios na roleta, pausar o sorteio, alternar a regra de giro único por CPF e exportar a lista completa de participantes em CSV.
- **Modo Demonstração Local automático**: enquanto você ainda não configurar o Supabase, o projeto funciona localmente com um arquivo temporário (`.local-demo-db.json`) já populado com brindes temáticos de Biomedicina UCPel para teste imediato.

---

## 1. Rodar localmente (sem Supabase ainda)

```bash
npm install
npm run dev
```

Acesse:
- Roleta: [http://localhost:3000](http://localhost:3000)
- Painel da Coordenação: [http://localhost:3000/admin](http://localhost:3000/admin) (defina `ADMIN_PASSWORD` no arquivo `.env.local`)

---

## 2. Configurar o Banco no Supabase

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No menu esquerdo do Supabase, abra **SQL Editor** → **New query**.
3. Copie todo o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e clique em **Run**.
   - Isso criará as tabelas `roulette_settings`, `participants`, `prizes` e `spins`, habilitará RLS, criará a função `spin_roulette` e inserirá 8 itens iniciais temáticos de Biomedicina UCPel.
4. Vá em **Project Settings → API** no Supabase e copie:
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon public** key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role** secret key (`SUPABASE_SERVICE_ROLE_KEY`)
5. Crie um arquivo `.env.local` na raiz do projeto (baseado em [`.env.example`](./.env.example)):

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
ADMIN_PASSWORD=escolha-uma-senha-forte
```

Reinicie `npm run dev` e o cabeçalho mostrará **"Conectado ao Supabase"**.

---

## 3. Subir no Git e fazer Deploy na Vercel

1. Crie um repositório vazio no GitHub (ou GitLab).
2. Conecte este diretório e envie o código:

```bash
git add .
git commit -m "feat: roleta biomedicina ucpel com nextjs e supabase"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

3. Acesse [vercel.com](https://vercel.com), clique em **Add New… → Project** e importe o repositório.
4. Em **Environment Variables**, cadastre as 4 variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
5. Clique em **Deploy**.
