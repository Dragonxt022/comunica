import User from './User.ts';
import Secretaria from './Secretaria.ts';
import Evento from './Evento.ts';
import Solicitacao from './Solicitacao.ts';
import SolicitacaoComentario from './SolicitacaoComentario.ts';
import Release from './Release.ts';
import Arquivo from './Arquivo.ts';
import Auditoria from './Auditoria.ts';
import Configuracao from './Configuracao.ts';
import EventoResponsavel from './EventoResponsavel.ts';
import PushSubscription from './PushSubscription.ts';

Evento.belongsToMany(User, { through: EventoResponsavel, as: 'responsaveis', foreignKey: 'evento_id', otherKey: 'user_id' });
User.belongsToMany(Evento, { through: EventoResponsavel, as: 'responsaveis_em_eventos', foreignKey: 'user_id', otherKey: 'evento_id' });

export {
  User,
  Secretaria,
  Evento,
  Solicitacao,
  SolicitacaoComentario,
  Release,
  Arquivo,
  Auditoria,
  Configuracao,
  EventoResponsavel,
  PushSubscription,
};
