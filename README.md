# Basic Backup Bot

Bot de backup e restore para servidores do Discord.

Projeto focado em estabilidade.  
Feito para aguentar restore pesado sem cair por rate-limit.

---

## Features

- Backup completo de:
  - Cargos
  - Canais
  - Categorias
  - Permissões
- Restore destrutivo (recria estrutura inteira)
- Sistema de lock (impede dois restores ao mesmo tempo)
- Retry automático em erro 429
- Delay inteligente anti rate-limit
- Anti crash global
- Log estruturado em `.txt`
- Log em tempo real no Discord
- Banco de dados SQLite local

---

## Requisitos

- Node.js 18+
- Bot com permissão de **Administrador**
- Token do bot
- ID do usuário que poderá usar os comandos

---

## Instalação

Clone o repositório:

```bash
git clone https://github.com/seu-usuario/basic-backup-bot.git
cd basic-backup-bot
```

Instale as dependências:

```bash
npm install
```

---

## Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
TOKEN=SEU_TOKEN_AQUI
OWNER_ID=SEU_ID_AQUI
```

- `TOKEN` → Token do bot do Discord  
- `OWNER_ID` → ID da conta autorizada a usar os comandos  

---

## Executando

```bash
node index.js
```

Se estiver tudo certo, o console mostrará que o bot está logado.

---

## Comandos

Criar backup:

```
!backup
```

Restaurar backup:

```
!restore <id>
```

O ID é informado quando o backup é criado.

---

## Logs

Os logs ficam em:

```
/logs/bot.log
```

Tudo que o bot faz é registrado com timestamp.

---

## Estrutura do projeto

```
basic-backup-bot/
│
├── backups/
├── logs/
├── database.sqlite
├── index.js
├── package.json
└── .env
```

---

## Aviso Importante

O restore:

- Deleta canais atuais
- Deleta cargos atuais
- Recria a estrutura salva

Use com cuidado.  
Teste primeiro em um servidor secundário.

---

## Licença

Uso livre para estudos e projetos pessoais.
