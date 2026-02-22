# Discord Backup Bot

Bot simples para criar e restaurar backups completos de um servidor.

Ele salva:

- Nome do servidor
- Ícone
- Cargos
- Categorias
- Canais
- Permissões dos canais

Os dados ficam armazenados em um arquivo SQLite local.

---

## Instalação

Clone o projeto e instale as dependências:

```bash
npm install
```

Crie um arquivo `.env` na raiz:

```env
TOKEN=SEU_TOKEN_AQUI
OWNER_ID=SEU_ID_AQUI
```

Depois é só rodar:

```bash
node index.js
```

---

## Comandos

Criar backup:

```bash
!backup
```

Listar backups:

```bash
!backups
```

Restaurar backup:

```bash
!restore <id>
```

---

## Atenção

O restore apaga todos os canais e cargos atuais antes de recriar tudo.

Use com cuidado.
