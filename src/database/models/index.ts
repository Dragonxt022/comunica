import User from './User.ts';
import Secretaria from './Secretaria.ts';
import Municipio from './Municipio.ts';
import Evento from './Evento.ts';
import Solicitacao from './Solicitacao.ts';
import SolicitacaoComentario from './SolicitacaoComentario.ts';
import SolicitacaoImagem from './SolicitacaoImagem.ts';
import Release from './Release.ts';
import Arquivo from './Arquivo.ts';
import Auditoria from './Auditoria.ts';
import Configuracao from './Configuracao.ts';
import EventoResponsavel from './EventoResponsavel.ts';
import PushSubscription from './PushSubscription.ts';
import Notificacao from './Notificacao.ts';
import FormularioTemplate from './FormularioTemplate.ts';
import Inscricao from './Inscricao.ts';
import PlanoAcao from './PlanoAcao.ts';
import AcaoPlanejamento from './AcaoPlanejamento.ts';
import IndicadorMeta from './IndicadorMeta.ts';
import ChatConversa from './ChatConversa.ts';
import ChatMensagem from './ChatMensagem.ts';
import ChatParticipante from './ChatParticipante.ts';
import ChatUserKey from './ChatUserKey.ts';
import ChatCategoria from './ChatCategoria.ts';
import IaPerfil from './IaPerfil.ts';
import OliviaMensagem from './OliviaMensagem.ts';
import ArtePaleta from './ArtePaleta.ts';
import ArteEstilo from './ArteEstilo.ts';
import ArteAtivo from './ArteAtivo.ts';
import ArteTemplate from './ArteTemplate.ts';
import ArteTemplateVariante from './ArteTemplateVariante.ts';
import ArteGeracao from './ArteGeracao.ts';
import ArteGeracaoArquivo from './ArteGeracaoArquivo.ts';

// ── Existing associations ──────────────────────────────────────────────────

Secretaria.belongsTo(Municipio, { foreignKey: 'municipio_id', as: 'municipio' });
Municipio.hasMany(Secretaria, { foreignKey: 'municipio_id', as: 'secretarias' });

User.belongsTo(Municipio, { foreignKey: 'municipio_id', as: 'municipio' });
Municipio.hasMany(User, { foreignKey: 'municipio_id', as: 'usuarios' });

Evento.belongsToMany(User, { through: EventoResponsavel, as: 'responsaveis', foreignKey: 'evento_id', otherKey: 'user_id' });
User.belongsToMany(Evento, { through: EventoResponsavel, as: 'responsaveis_em_eventos', foreignKey: 'user_id', otherKey: 'evento_id' });

Evento.hasMany(Inscricao, { foreignKey: 'evento_id', as: 'inscricoes' });

Evento.belongsTo(PlanoAcao, { foreignKey: 'plano_id', as: 'plano' });
PlanoAcao.hasMany(Evento, { foreignKey: 'plano_id', as: 'eventos' });

// ── Chat associations ──────────────────────────────────────────────────────

ChatConversa.hasMany(ChatParticipante, { foreignKey: 'conversa_id', as: 'participantes' });
ChatParticipante.belongsTo(ChatConversa, { foreignKey: 'conversa_id', as: 'conversa' });

ChatConversa.hasMany(ChatMensagem, { foreignKey: 'conversa_id', as: 'mensagens' });
ChatMensagem.belongsTo(ChatConversa, { foreignKey: 'conversa_id', as: 'conversa' });

ChatParticipante.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasMany(ChatParticipante, { foreignKey: 'user_id', as: 'chat_participacoes' });

ChatMensagem.belongsTo(User, { foreignKey: 'user_id', as: 'remetente' });

ChatUserKey.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasOne(ChatUserKey, { foreignKey: 'user_id', as: 'chat_key' });

ChatCategoria.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasMany(ChatCategoria, { foreignKey: 'user_id', as: 'chat_categorias' });

// ── Arte (gerador de artes institucionais) ──────────────────────────────────

ArteTemplate.hasMany(ArteTemplateVariante, { foreignKey: 'template_id', as: 'variantes' });
ArteTemplateVariante.belongsTo(ArteTemplate, { foreignKey: 'template_id', as: 'template' });

ArteTemplate.belongsTo(ArtePaleta, { foreignKey: 'paleta_id', as: 'paleta' });
ArteGeracao.belongsTo(ArteTemplate, { foreignKey: 'template_id', as: 'template' });

ArteGeracao.hasMany(ArteGeracaoArquivo, { foreignKey: 'geracao_id', as: 'arquivos' });
ArteGeracaoArquivo.belongsTo(ArteGeracao, { foreignKey: 'geracao_id', as: 'geracao' });

ArteGeracao.belongsTo(Solicitacao, { foreignKey: 'solicitacao_id', as: 'solicitacao' });
ArteGeracao.belongsTo(User, { foreignKey: 'usuario_id', as: 'autor' });

export {
  User,
  Secretaria,
  Municipio,
  Evento,
  Solicitacao,
  SolicitacaoComentario,
  SolicitacaoImagem,
  Release,
  Arquivo,
  Auditoria,
  Configuracao,
  EventoResponsavel,
  PushSubscription,
  Notificacao,
  FormularioTemplate,
  Inscricao,
  PlanoAcao,
  AcaoPlanejamento,
  IndicadorMeta,
  ChatConversa,
  ChatMensagem,
  ChatParticipante,
  ChatUserKey,
  ChatCategoria,
  IaPerfil,
  OliviaMensagem,
  ArtePaleta,
  ArteEstilo,
  ArteAtivo,
  ArteTemplate,
  ArteTemplateVariante,
  ArteGeracao,
  ArteGeracaoArquivo,
};
