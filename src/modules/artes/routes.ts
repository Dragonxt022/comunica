import { Router } from 'express';
import multer from 'multer';
import * as ArtesController from './controller.ts';

const router = Router();

// Upload de ativos em memória — o controller grava em public/uploads/artes/ativos.
const uploadAtivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.mimetype);
    if (!ok) return cb(new Error('Formato não permitido. Use JPEG, PNG, GIF, WebP ou SVG.'));
    cb(null, true);
  },
}).single('imagem');

// ── Início / listagem ───────────────────────────────────────────────────────
router.get('/', ArtesController.index);

// ── Modelos (administração) ─────────────────────────────────────────────────
router.get('/modelos', ArtesController.modelosList);
router.get('/modelos/novo', ArtesController.modeloNovo);
router.post('/modelos', ArtesController.modeloStore);
router.get('/modelos/:id/editar', ArtesController.modeloEditar);
router.get('/modelos/:id/thumb/:chave', ArtesController.modeloThumb);
router.post('/modelos/:id', ArtesController.modeloUpdate);
router.post('/modelos/:id/publicar', ArtesController.modeloPublicar);
router.post('/modelos/:id/arquivar', ArtesController.modeloArquivar);
router.post('/modelos/:id/excluir', ArtesController.modeloExcluir);
router.post('/modelos/:id/duplicar', ArtesController.modeloDuplicar);

// ── Biblioteca de ativos ────────────────────────────────────────────────────
router.get('/ativos', ArtesController.ativosList);
router.get('/ativos.json', ArtesController.ativosJson);
router.post('/ativos', uploadAtivo, ArtesController.ativoStore);
router.post('/ativos/:id', ArtesController.ativoUpdate);
router.post('/ativos/:id/arquivar', ArtesController.ativoArquivar);
router.post('/ativos/:id/excluir', ArtesController.ativoExcluir);

// ── Paletas e estilos ───────────────────────────────────────────────────────
router.get('/paletas', ArtesController.paletasList);
router.post('/paletas', ArtesController.paletaStore);
router.post('/estilos', ArtesController.estiloStore);

// ── Produção e geração ──────────────────────────────────────────────────────
router.get('/producao', ArtesController.producaoView);
router.post('/previa', ArtesController.previa);
router.post('/gerar', ArtesController.gerar);
router.get('/geracoes/:id', ArtesController.geracaoView);
router.get('/geracoes/:id/svg/:pagina', ArtesController.geracaoSvg);
router.post('/geracoes/:id/aprovar', ArtesController.geracaoAprovar);
router.post('/geracoes/:id/excluir', ArtesController.geracaoExcluir);

// ── Assistência textual por IA ──────────────────────────────────────────────
router.post('/ia/revisar', ArtesController.iaRevisar);
router.post('/ia/preencher', ArtesController.iaPreencher);
router.post('/ia/carrossel', ArtesController.iaCarrossel);

export default router;
