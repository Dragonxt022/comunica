import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class ChatMensagem extends Model {
  public id!: number;
  public conversa_id!: number;
  public user_id!: number;
  public tipo!: 'texto' | 'imagem' | 'audio' | 'arquivo';
  // For 'texto': base64(AES-GCM ciphertext) for DMs, base64(utf8) for groups
  public conteudo_enc!: string | null;
  // AES-GCM IV as hex — present only for DM E2E encrypted messages
  public iv_hex!: string | null;
  // For media messages
  public arquivo_url!: string | null;
  public arquivo_nome!: string | null;
  public arquivo_tamanho!: number | null;
  public arquivo_mime!: string | null;
  public excluido!: boolean;
  public createdAt!: Date;
}

ChatMensagem.init({
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  conversa_id:     { type: DataTypes.INTEGER, allowNull: false },
  user_id:         { type: DataTypes.INTEGER, allowNull: false },
  tipo:            { type: DataTypes.ENUM('texto','imagem','audio','arquivo'), allowNull: false, defaultValue: 'texto' },
  conteudo_enc:    { type: DataTypes.TEXT, allowNull: true },
  iv_hex:          { type: DataTypes.STRING(32), allowNull: true },
  arquivo_url:     { type: DataTypes.STRING(500), allowNull: true },
  arquivo_nome:    { type: DataTypes.STRING(255), allowNull: true },
  arquivo_tamanho: { type: DataTypes.INTEGER, allowNull: true },
  arquivo_mime:    { type: DataTypes.STRING(100), allowNull: true },
  excluido:        { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, tableName: 'chat_mensagens', timestamps: true, updatedAt: false });

export default ChatMensagem;
