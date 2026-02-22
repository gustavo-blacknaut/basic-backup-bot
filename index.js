import 'dotenv/config'
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  Events,
  PermissionsBitField
} from 'discord.js'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import Database from 'better-sqlite3'

process.on('uncaughtException', err => console.error('Uncaught:', err))
process.on('unhandledRejection', err => console.error('Unhandled:', err))

const { TOKEN, OWNER_ID } = process.env
if (!TOKEN || !OWNER_ID) {
  console.error('TOKEN ou OWNER_ID ausente no .env')
  process.exit(1)
}

if (!fs.existsSync('./backups')) fs.mkdirSync('./backups')

const db = new Database('./database.sqlite')

db.prepare(`
  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL,
    data TEXT NOT NULL
  )
`).run()

try {
  db.prepare(`ALTER TABLE backups ADD COLUMN name TEXT NOT NULL DEFAULT ''`).run()
} catch (_) {}

const insertBackup = db.prepare(`
  INSERT INTO backups (guildId, name, createdAt, data) VALUES (?, ?, ?, ?)
`)

const getBackupByName = db.prepare(`
  SELECT * FROM backups WHERE name = ?
`)

const getBackup = db.prepare(`
  SELECT * FROM backups WHERE id = ?
`)

const listBackups = db.prepare(`
  SELECT id, name, createdAt FROM backups ORDER BY createdAt DESC
`)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
})

let restoreLock = false

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function safe(fn, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (e?.status === 429 || e?.code === 429) {
        const wait = (e?.retry_after ?? 2) * 1000
        await sleep(wait)
      } else {
        if (i === retries - 1) throw e
        await sleep(800)
      }
    }
  }
}

function checkPerm(guild) {
  const me = guild.members.me
  if (!me) return false
  return me.permissions.has(PermissionsBitField.Flags.Administrator)
}

async function downloadImage(url, filePath) {
  const res = await axios.get(url, { responseType: 'arraybuffer' })
  fs.writeFileSync(filePath, res.data)
}

async function createBackup(guild, name) {
  await guild.roles.fetch()
  await guild.channels.fetch()

  const timestamp = Date.now()

  const data = {
    server: {
      name: guild.name
    },
    roles: guild.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => a.position - b.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: r.permissions.bitfield.toString(),
        mentionable: r.mentionable,
        position: r.position
      })),
    channels: guild.channels.cache
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parent: c.parentId,
        topic: 'topic' in c ? c.topic : null,
        nsfw: 'nsfw' in c ? c.nsfw : false,
        rateLimitPerUser: 'rateLimitPerUser' in c ? c.rateLimitPerUser : 0,
        bitrate: 'bitrate' in c ? c.bitrate : null,
        userLimit: 'userLimit' in c ? c.userLimit : null,
        position: c.rawPosition,
        permissionOverwrites: c.permissionOverwrites?.cache.map(o => ({
          id: o.id,
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString(),
          type: o.type
        })) ?? []
      }))
  }

  const info = insertBackup.run(guild.id, name, timestamp, JSON.stringify(data))
  const backupId = info.lastInsertRowid
  const folder = `./backups/${backupId}`

  fs.mkdirSync(folder)

  const iconURL = guild.iconURL({ extension: 'png', size: 512 })
  if (iconURL) {
    await downloadImage(iconURL, path.join(folder, 'icon.png'))
  }

  return backupId
}

async function restoreBackup(guild, backup, backupId, progressMessage) {
  if (restoreLock) throw new Error('restore em andamento')
  restoreLock = true

  const update = async t => {
    console.log(t)
    if (progressMessage?.editable) {
      await progressMessage.edit(`\`\`\`\n${t}\n\`\`\``).catch(() => {})
    }
  }

  try {
    await update('iniciando restore...')

    await guild.roles.fetch()
    await guild.channels.fetch()

    await safe(() => guild.setName(backup.server.name))

    const iconPath = `./backups/${backupId}/icon.png`
    if (fs.existsSync(iconPath)) {
      const iconBuffer = fs.readFileSync(iconPath)
      await safe(() => guild.setIcon(iconBuffer))
    }

    await update('deletando canais...')
    for (const ch of [...guild.channels.cache.values()]) {
      await safe(() => ch.delete().catch(() => {}))
      await sleep(300)
    }

    await update('deletando cargos...')
    const rolesOrdered = [...guild.roles.cache.values()]
      .filter(r => r.id !== guild.id && r.editable)
      .sort((a, b) => b.position - a.position)

    for (const role of rolesOrdered) {
      await safe(() => role.delete().catch(() => {}))
      await sleep(300)
    }

    await update('criando cargos...')
    const roleMap = {}

    for (const r of backup.roles) {
      const created = await safe(() =>
        guild.roles.create({
          name: r.name,
          colors: [r.color],
          hoist: r.hoist,
          permissions: new PermissionsBitField(BigInt(r.permissions)),
          mentionable: r.mentionable
        })
      ).catch(() => null)

      if (created) roleMap[r.id] = created
      await sleep(300)
    }

    for (const r of backup.roles) {
      const role = roleMap[r.id]
      if (role) await role.setPosition(r.position).catch(() => {})
      await sleep(100)
    }

    await update('criando categorias...')
    const categoryMap = {}

    for (const ch of backup.channels.filter(c => c.type === ChannelType.GuildCategory)) {
      const created = await safe(() =>
        guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: ch.permissionOverwrites.map(o => ({
            id: roleMap[o.id]?.id ?? o.id,
            allow: BigInt(o.allow),
            deny: BigInt(o.deny),
            type: o.type
          }))
        })
      ).catch(() => null)

      if (created) categoryMap[ch.id] = created
      await sleep(300)
    }

    await update('criando canais...')
    const validTypes = [
      ChannelType.GuildText,
      ChannelType.GuildVoice,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildStageVoice,
      ChannelType.GuildForum,
      ChannelType.GuildMedia
    ]

    for (const ch of backup.channels.filter(c => validTypes.includes(c.type))) {
      const options = {
        name: ch.name,
        type: ch.type,
        nsfw: ch.nsfw,
        parent: ch.parent ? categoryMap[ch.parent]?.id ?? null : null,
        permissionOverwrites: ch.permissionOverwrites.map(o => ({
          id: roleMap[o.id]?.id ?? o.id,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny),
          type: o.type
        }))
      }

      if (ch.topic) options.topic = ch.topic
      if (ch.rateLimitPerUser) options.rateLimitPerUser = ch.rateLimitPerUser
      if (ch.bitrate) options.bitrate = ch.bitrate
      if (ch.userLimit) options.userLimit = ch.userLimit

      await safe(() => guild.channels.create(options)).catch(() => {})
      await sleep(300)
    }

    await update('restore concluido')
  } finally {
    restoreLock = false
  }
}

client.once(Events.ClientReady, () => {
  console.log(`bot online: ${client.user.tag}`)
})

client.on(Events.MessageCreate, async msg => {
  if (!msg.guild) return
  if (msg.author.id !== OWNER_ID) return
  if (!checkPerm(msg.guild)) return

  try {
    if (msg.content.startsWith('!backup')) {
      const name = msg.content.slice('!backup'.length).trim()
      if (!name) return msg.reply('uso: `!backup <nome>`')

      const existe = getBackupByName.get(name)
      if (existe) return msg.reply(`já existe um backup com o nome **${name}**`)

      await msg.reply(`criando backup **${name}**...`)
      const id = await createBackup(msg.guild, name)
      return msg.reply(`backup **${name}** criado (id: ${id})`)
    }

    if (msg.content.startsWith('!restore')) {
      const name = msg.content.slice('!restore'.length).trim()
      if (!name) return msg.reply('uso: `!restore <nome>`')

      const row = getBackupByName.get(name)
      if (!row) return msg.reply(`backup **${name}** nao encontrado`)

      const progress = await msg.reply(`restaurando **${name}**...`)
      await restoreBackup(msg.guild, JSON.parse(row.data), row.id, progress)
    }

    if (msg.content === '!listbackups') {
      const rows = listBackups.all()
      if (!rows.length) return msg.reply('nenhum backup encontrado')

      const lines = rows.map(r => {
        const date = new Date(r.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        return `**${r.name}** — ${date} (id: ${r.id})`
      })

      return msg.reply(`**Backups:**\n${lines.join('\n')}`)
    }
  } catch (e) {
    console.error(e.message)
    msg.reply(`erro: ${e.message}`).catch(() => {})
  }
})

client.login(TOKEN)
