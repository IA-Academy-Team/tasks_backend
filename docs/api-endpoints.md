# API Endpoint Guide

Documento generado automáticamente desde `openapi.generated.json`.

| Método | Ruta | Módulo | Requiere Auth | Resumen |
|---|---|---|---|---|
| GET | `/analytics/alerts/overdue` | Analytics | Sí | Alertas activas de atraso |
| GET | `/analytics/dashboard/admin` | Analytics | Sí | Dashboard de productividad admin |
| GET | `/analytics/dashboard/employee` | Analytics | Sí | Dashboard operativo del empleado autenticado |
| GET | `/analytics/reports/compliance` | Analytics | Sí | Reporte de cumplimiento de tareas |
| GET | `/areas` | Areas | Sí | Listar áreas |
| POST | `/areas` | Areas | Sí | Crear área |
| DELETE | `/areas/{areaId}` | Areas | Sí | Eliminar/archivar área |
| GET | `/areas/{areaId}` | Areas | Sí | Obtener área por id |
| PATCH | `/areas/{areaId}` | Areas | Sí | Actualizar área |
| GET | `/auth/access/admin` | Auth | Sí | Validar acceso admin |
| GET | `/auth/access/employee` | Auth | Sí | Validar acceso employee/admin |
| GET | `/auth/access/me` | Auth | Sí | Políticas de recursos permitidos para el usuario actual |
| GET | `/auth/handler/{path}` | Auth | No | Proxy Better Auth (GET) |
| POST | `/auth/handler/{path}` | Auth | No | Proxy Better Auth (POST) |
| GET | `/auth/session` | Auth | No | Sesión autenticada actual |
| GET | `/auth/status` | Auth | No | Estado del módulo auth |
| GET | `/docs` | System | No | Swagger UI |
| GET | `/employees` | Employees | Sí | Listar empleados |
| POST | `/employees` | Employees | Sí | Crear empleado |
| GET | `/employees/{employeeId}` | Employees | Sí | Obtener empleado por id |
| PATCH | `/employees/{employeeId}` | Employees | Sí | Actualizar empleado |
| GET | `/employees/{employeeId}/area-assignments` | Employees | Sí | Listar asignaciones de área del empleado |
| POST | `/employees/{employeeId}/area-assignments` | Employees | Sí | Asignar empleado a área |
| GET | `/employees/{employeeId}/project-memberships` | Employees | Sí | Listar membresías de proyecto del empleado |
| PATCH | `/employees/{employeeId}/status` | Employees | Sí | Actualizar estado activo/inactivo de empleado |
| GET | `/health` | System | No | Health check |
| GET | `/me` | Users | Sí | Perfil del usuario autenticado |
| PATCH | `/me` | Users | Sí | Actualizar perfil del usuario autenticado |
| GET | `/openapi.json` | System | No | Documento OpenAPI en JSON |
| GET | `/projects` | Projects | Sí | Listar proyectos |
| POST | `/projects` | Projects | Sí | Crear proyecto |
| DELETE | `/projects/{projectId}` | Projects | Sí | Eliminar/archivar proyecto |
| GET | `/projects/{projectId}` | Projects | Sí | Obtener proyecto por id |
| PATCH | `/projects/{projectId}` | Projects | Sí | Actualizar proyecto |
| GET | `/projects/{projectId}/memberships` | Projects | Sí | Listar membresías de proyecto |
| POST | `/projects/{projectId}/memberships` | Projects | Sí | Asignar empleado al proyecto |
| PATCH | `/projects/{projectId}/memberships/{membershipId}/reassign` | Projects | Sí | Reasignar membresía a otro empleado |
| PATCH | `/projects/{projectId}/memberships/{membershipId}/unassign` | Projects | Sí | Finalizar membresía activa |
| PATCH | `/projects/{projectId}/status` | Projects | Sí | Actualizar estado de proyecto |
| GET | `/tasks` | Tasks | Sí | Listar tareas |
| POST | `/tasks` | Tasks | Sí | Crear tarea |
| DELETE | `/tasks/{taskId}` | Tasks | Sí | Eliminar lógicamente tarea |
| GET | `/tasks/{taskId}` | Tasks | Sí | Obtener tarea por id |
| PATCH | `/tasks/{taskId}` | Tasks | Sí | Actualizar tarea |
| GET | `/tasks/{taskId}/history` | Tasks | Sí | Historial de transiciones de tarea |
| PATCH | `/tasks/{taskId}/status` | Tasks | Sí | Transicionar estado de tarea |
