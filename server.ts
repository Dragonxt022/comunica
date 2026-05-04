import express from 'express';
import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import sequelize from './src/config/database.ts';
import { User, Secretaria, Auditoria } from './src/database/models/index.ts';
import bcrypt from 'bcryptjs';
import authRoutes from './src/modules/auth/routes.ts';
import eventosRoutes from './src/modules/eventos/routes.ts';
import solicitacoesRoutes from './src/modules/solicitacoes/routes.ts';
import * as ImprensaController from './src/modules/imprensa/controller.ts';
import { isAuthenticated } from './src/middlewares/auth.middleware.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000');

// Trust Proxy (Essential for sessions behind Cloud Run / Iframe proxy)
app.set('trust proxy', 1);

// Session Setup
const SequelizeStore = connectSessionSequelize(session.Store);
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
});

// Middlewares
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Secure: ${req.secure} - Protocol: ${req.protocol}`);
  next();
});
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'self'", "https://ais-dev-wltizb6zqqbkcceo477run-9268626090.us-west2.run.app", "https://ais-pre-wltizb6zqqbkcceo477run-9268626090.us-west2.run.app", "https://*.google.com", "https://*.googleusercontent.com"],
    },
  },
  xFrameOptions: false,
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-comunica',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  name: 'comunica.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

sessionStore.sync();

// Template Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Global Variables Middleware
app.use((req, res, next) => {
  res.locals.user = (req as any).session.user || null;
  res.locals.path = req.path;
  next();
});

// Seed Function
async function seed() {
  await sequelize.sync({ force: false }); // Change to true if you want to reset db
  
  const secretariaCount = await Secretaria.count();
  if (secretariaCount === 0) {
    const secAdmin = await Secretaria.create({
      nome: 'Comunicação (SECOM)',
      slug: 'secom',
      cor: '#ef4444',
      ativo: true,
    });

    const hash = await bcrypt.hash('admin123', 12);
    await User.create({
      nome: 'Administrador Master',
      email: 'admin@comunica.gov.br',
      senha_hash: hash,
      role: 'admin',
      ativo: true,
      secretaria_id: secAdmin.id,
    });
    
    console.log('Seed: Initial data created (Admin: admin@comunica.gov.br / admin123)');
  }
}

// Start Server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    await seed();
    
    // Public Routes
    app.use('/', authRoutes);
    app.get('/imprensa/agenda', ImprensaController.agendaPublica);
    
    // Health Check
    app.get('/health', (req, res) => res.send('OK'));
    
    // Session Debug
    app.get('/session-debug', (req, res) => {
      res.json({
        hasSession: !!(req as any).session,
        sessionID: req.sessionID,
        userData: (req as any).session.user || null,
        cookie: req.session.cookie,
        headers: req.headers,
        secure: req.secure,
        protocol: req.protocol,
        ip: req.ip
      });
    });
    
    // Protected Routes
    app.get('/', isAuthenticated, (req, res) => {
      res.render('index', { title: 'Dashboard' });
    });

    // Modules
    app.use('/solicitacoes', isAuthenticated, solicitacoesRoutes);
    app.use('/eventos', isAuthenticated, eventosRoutes);

    // Audit helper available in req
    app.use((req, res, next) => {
      (req as any).audit = async (acao: string, entidade: string, entidade_id?: number) => {
        const user = (req as any).session.user;
        await Auditoria.create({
          user_id: user ? user.id : null,
          acao,
          entidade,
          entidade_id,
          ip: req.ip,
          user_agent: req.get('user-agent'),
        });
      };
      next();
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer();
