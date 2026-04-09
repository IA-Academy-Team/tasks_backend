# TaskApp Backend

## Descripción
TaskApp Backend es la API que soporta la gestión operativa de tareas, proyectos, áreas y empleados para dos perfiles de uso:

- `Administrador`: configura la operación, asigna trabajo y monitorea cumplimiento.
- `Empleado`: ejecuta tareas, actualiza estados y reporta tiempos reales.

El sistema resuelve problemas de coordinación, seguimiento y trazabilidad en equipos operativos, centralizando reglas de negocio, permisos por rol y métricas de productividad.

## Funcionalidades principales
- Autenticación con Better Auth (sesión, control por rol y recuperación de contraseña por correo).
- Gestión de áreas (crear, editar, listar, eliminar).
- Gestión de empleados (CRUD, asignación/desasignación de área y relaciones de proyecto).
- Gestión de proyectos (CRUD, activación/cierre, membresías y reasignación de tareas).
- Gestión de tareas:
  - Tareas de proyecto.
  - Tareas sueltas (standalone).
  - Transición de estado con validaciones de flujo.
  - Registro de tiempo real y evidencia al finalizar.
  - Historial de transiciones.
- Notificaciones internas y marcado de lectura.
- Dashboards y reportes:
  - Dashboard administrativo.
  - Dashboard de empleado.
  - Reporte de cumplimiento.
  - Alertas de vencimiento/retraso.
- Documentación OpenAPI + Swagger UI.

## Casos de uso
- **Administrador**:
  - Crear estructura organizacional (áreas, empleados, proyectos).
  - Asignar tareas y reasignar carga entre empleados.
  - Revisar tareas pendientes/vencidas y cumplimiento global.
  - Eliminar entidades legacy (empleado/proyecto/área/tarea) según política del sistema.
- **Empleado**:
  - Ver tareas asignadas (de proyecto y sueltas).
  - Cambiar estado operativo de tareas dentro de reglas permitidas.
  - Finalizar tareas reportando minutos reales y evidencia opcional.
  - Consultar tablero personal de productividad.

## Tecnologías utilizadas
- **Runtime**: Node.js + TypeScript (ESM).
- **Servidor**: Express 5.
- **ORM/DB**: Prisma + PostgreSQL.
- **Auth**: Better Auth + bcrypt.
- **Validación**: Zod.
- **Realtime**: Socket.IO.
- **Correo**: Nodemailer (SMTP).
- **Calidad**: ESLint + TypeScript type-check + Vitest.
- **Documentación**: OpenAPI generado + Swagger UI.

## Instalación y ejecución
### 1) Prerrequisitos
- Node.js 20+
- npm 10+
- PostgreSQL disponible local o remoto

### 2) Configurar entorno
```bash
cd backend
cp .env.example .env
```

Ajusta en `.env` al menos:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `BETTER_AUTH_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

### 3) Instalar dependencias
```bash
npm install
```

### 4) Sincronizar esquema y cargar datos base
```bash
npx prisma generate
npx prisma db push --accept-data-loss
npm run db:seed
```

### 5) Levantar en desarrollo
```bash
npm run dev
```

API disponible por defecto en:
- `http://localhost:3004/api`
- Health check: `http://localhost:3004/health`
- Swagger UI: `http://localhost:3004/api/docs`

### Scripts útiles
- `npm run dev`: desarrollo con recarga.
- `npm run build`: compilación productiva.
- `npm run start`: ejecutar build.
- `npm run type-check`: verificación de tipos.
- `npm run lint`: lint del proyecto.
- `npm run test`: prueba de endpoints (Vitest).
- `npm run test:endpoints:live`: escenario E2E live de endpoints.
- `npm run swagger:generate`: regenerar OpenAPI.

## Estructura del proyecto
```text
backend/
├─ prisma/
│  ├─ schema.prisma
│  ├─ seeds.ts
│  └─ db.sql
├─ src/
│  ├─ app/                 # bootstrap, middlewares y rutas raíz
│  ├─ modules/             # dominios: auth, tasks, projects, analytics, etc.
│  └─ shared/              # config, http errors, scripts, docs, tests, utils
└─ docs/                   # documentación auxiliar
```

## Arquitectura
- Arquitectura modular por dominio (`modules/*`).
- Cada módulo separa:
  - `*.router.ts` (transporte HTTP),
  - `*.schemas.ts` (validación),
  - `*.service.ts` (reglas de negocio).
- Middleware transversal para:
  - CORS,
  - headers de seguridad,
  - rate-limit,
  - manejo de errores,
  - request-id.
- Integración de auth y realtime:
  - Better Auth para sesión/roles.
  - Socket.IO para notificaciones en tiempo real.

## API / Endpoints clave
Base: `/api`

### Salud y docs
- `GET /health`
- `GET /api/docs`
- `GET /api/openapi.json`

### Auth y perfil
- `GET /api/auth/status`
- `GET /api/auth/session`
- `GET /api/auth/access/me`
- `GET /api/auth/access/admin`
- `GET /api/auth/access/employee`
- `GET /api/me`
- `PATCH /api/me`
- `POST /api/auth/handler/*` (sign-in, sign-out, reset password, etc. gestionado por Better Auth)

### Áreas (admin)
- `GET /api/areas`
- `GET /api/areas/:areaId`
- `POST /api/areas`
- `PATCH /api/areas/:areaId`
- `PATCH /api/areas/:areaId/status`
- `DELETE /api/areas/:areaId`

### Empleados (admin)
- `GET /api/employees`
- `GET /api/employees/:employeeId`
- `POST /api/employees`
- `PATCH /api/employees/:employeeId`
- `DELETE /api/employees/:employeeId`
- `GET /api/employees/:employeeId/area-assignments`
- `POST /api/employees/:employeeId/area-assignments`
- `PATCH /api/employees/:employeeId/area-assignments/unassign`
- `GET /api/employees/:employeeId/project-memberships`

### Proyectos
- `GET /api/projects`
- `GET /api/projects/:projectId`
- `GET /api/projects/:projectId/memberships`
- `POST /api/projects` (admin)
- `PATCH /api/projects/:projectId` (admin)
- `PATCH /api/projects/:projectId/status` (admin)
- `DELETE /api/projects/:projectId` (admin)
- `POST /api/projects/:projectId/memberships` (admin)
- `PATCH /api/projects/:projectId/memberships/:membershipId/unassign` (admin)
- `PATCH /api/projects/:projectId/memberships/:membershipId/reassign` (admin)
- `PATCH /api/projects/:projectId/tasks/reassign` (admin)

### Tareas
- `GET /api/tasks`
- `GET /api/tasks/standalone`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/:taskId/history`
- `POST /api/tasks` (admin)
- `POST /api/tasks/standalone` (admin y empleado con reglas por rol)
- `PATCH /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/status`
- `DELETE /api/tasks/:taskId` (admin)

### Analytics
- `GET /api/analytics/dashboard/employee` (employee)
- `GET /api/analytics/dashboard/admin` (admin)
- `GET /api/analytics/reports/compliance` (admin)
- `GET /api/analytics/alerts/overdue` (admin)

### Notificaciones
- `GET /api/notifications`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:notificationId/read`

## Flujo de la aplicación
1. El frontend autentica al usuario vía Better Auth (`/api/auth/handler/*`) usando cookies.
2. El backend valida sesión/rol y expone recursos según permisos.
3. El administrador crea estructura operativa (áreas, empleados, proyectos) y asigna tareas.
4. El empleado ejecuta tareas y reporta avance/tiempo real.
5. Analytics consolida métricas para dashboards y reportes.
6. Eventos relevantes generan notificaciones para consumo en tiempo real.

## Consideraciones técnicas
- El backend aplica filtros de visibilidad por rol para evitar exposición de recursos no permitidos.
- El endpoint de tareas usa reglas de transición de estado para mantener consistencia operativa.
- La recuperación de contraseña usa SMTP y Better Auth.
- Las validaciones de entrada se hacen con Zod en cada módulo.
- CORS se resuelve desde variables de entorno para entorno local y productivo.

## Estado del proyecto
**MVP avanzado / preproducción**  
El sistema tiene cobertura funcional end-to-end para gestión operativa, con pruebas live de endpoints y documentación OpenAPI generada.

## Próximos pasos
- Expandir pruebas automatizadas unitarias e integración por módulo.
- Añadir versionado formal de API y changelog.
- Incorporar observabilidad (métricas, tracing y alertas).
- Fortalecer políticas de backup y hardening para producción.
