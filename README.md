# basic-backup-bot

Bot de backup e restore para Discord. Salva cargos, canais, categorias e permissões num SQLite local e recria tudo do zero quando precisar.

## o que faz

- salva toda a estrutura do servidor (cargos, canais, categorias, permissões)
- restore destrutivo — deleta o que tem e recria pelo backup
- nomes nos backups, sem ficar decorando ID
- lock de restore (não deixa rodar dois ao mesmo tempo)
- retry automático em rate limit 429
- delay entre operações pra não tomar ban da API
- log em tempo real no próprio Discord durante o restore

## requisitos

- Node.js 18+
- bot com permissão de Administrador no servidor
- token do bot e seu ID de usuário

## instalação

```bash
git clone https://github.com/seu-usuario/basic-backup-bot.git
cd basic-backup-bot
npm install
```

crie o `.env` na raiz:

```
TOKEN=seu_token_aqui
OWNER_ID=seu_id_aqui
```

depois é só rodar:

```bash
node index.js
```

## comandos

| comando | descrição |
|---|---|
| `!backup <nome>` | cria um backup com o nome que você quiser |
| `!restore <nome>` | restaura pelo nome |
| `!listbackups` | lista todos os backups com data de criação |

## aviso

o restore **deleta tudo** que tem no servidor antes de recriar. teste primeiro em servidor de teste, não direto no principal.

## estrutura

```
basic-backup-bot/
├── backups/
├── database.sqlite
├── index.js
├── package.json
└── .env
```
