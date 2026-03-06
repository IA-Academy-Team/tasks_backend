-- Database: traskapp
select * from status;
select * from role;
select * from company;
select * from type_recipient;
select * from type_expense;
select * from type_payment;
select * from type_account;
select * from bank;
select * from type_document;
select * from policy;
select * from holyday;
select * from country;
select * from business;
select * from city;
select * from cost_center;
select * from user;
select * from provider;
select * from recipient;
select * from advance;
select * from legalization;
select * from concept;
select * from document;
select * from rut;
select * from document_provider;
select * from notification;
select * from audit;

-- DDL: Crear base de datos y tablas

-- DROP DATABASE IF EXISTS traskapp_dev;
CREATE DATABASE IF NOT EXISTS traskapp_dev;
\c traskapp_dev;
\dt;

-- ==============================
-- Tablas sin dependencias
-- ==============================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT uq_roles_name UNIQUE (name)
);

CREATE TABLE employee_statuses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT uq_employee_statuses_code UNIQUE (code)
);

CREATE TABLE project_statuses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT uq_project_statuses_code UNIQUE (code)
);

CREATE TABLE task_statuses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT uq_task_statuses_code UNIQUE (code)
);

CREATE TABLE task_priorities (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT uq_task_priorities_code UNIQUE (code)
);

-- ==============================
-- Tablas con dependencias
-- ==============================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(320) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    phone_number VARCHAR(30),
    role_id INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles (id)
        ON DELETE RESTRICT
);

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    provider_id VARCHAR(80) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_accounts_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_accounts_provider_account UNIQUE (provider_id, provider_account_id)
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_sessions_token UNIQUE (token)
);

CREATE TABLE verifications (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(320) NOT NULL,
    value VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_verifications_identifier_value UNIQUE (identifier, value)
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    employee_status_id INT NOT NULL DEFAULT 1,
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employees_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_employees_status
        FOREIGN KEY (employee_status_id) REFERENCES employee_statuses (id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_employees_user_id UNIQUE (user_id)
);

CREATE TABLE areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_areas_name UNIQUE (name)
);

CREATE TABLE employee_area_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL,
    area_id INT NOT NULL,
    assigned_by_user_id INT NOT NULL,
    ended_by_user_id INT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_area_assignments_employee
        FOREIGN KEY (employee_id) REFERENCES employees (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_employee_area_assignments_area
        FOREIGN KEY (area_id) REFERENCES areas (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_employee_area_assignments_assigned_by
        FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_employee_area_assignments_ended_by
        FOREIGN KEY (ended_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_employee_area_assignments_ended_pair CHECK (
        (ended_at IS NULL AND ended_by_user_id IS NULL)
        OR (ended_at IS NOT NULL AND ended_by_user_id IS NOT NULL AND ended_at > assigned_at)
    )
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    area_id INT NOT NULL,
    project_status_id INT NOT NULL DEFAULT 1,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_area
        FOREIGN KEY (area_id) REFERENCES areas (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_projects_status
        FOREIGN KEY (project_status_id) REFERENCES project_statuses (id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_projects_area_name UNIQUE (area_id, name)
);

CREATE TABLE project_memberships (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    employee_id INT NOT NULL,
    assigned_by_user_id INT NOT NULL,
    ended_by_user_id INT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_memberships_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_memberships_employee
        FOREIGN KEY (employee_id) REFERENCES employees (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_memberships_assigned_by
        FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_memberships_ended_by
        FOREIGN KEY (ended_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_project_memberships_ended_pair CHECK (
        (unassigned_at IS NULL AND ended_by_user_id IS NULL)
        OR (unassigned_at IS NOT NULL AND ended_by_user_id IS NOT NULL AND unassigned_at > assigned_at)
    )
);

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    assignee_membership_id INT,
    task_status_id INT NOT NULL DEFAULT 1,
    task_priority_id INT NOT NULL DEFAULT 2,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    planned_start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    estimated_minutes INTEGER,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_assignee_membership
        FOREIGN KEY (assignee_membership_id) REFERENCES project_memberships (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_status
        FOREIGN KEY (task_status_id) REFERENCES task_statuses (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_priority
        FOREIGN KEY (task_priority_id) REFERENCES task_priorities (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_tasks_dates CHECK (
        due_date >= planned_start_date
    ),
    CONSTRAINT chk_tasks_estimated_minutes CHECK (
        estimated_minutes IS NULL OR estimated_minutes > 0
    )
);

CREATE TABLE task_status_transitions (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL,
    from_status_id INT,
    to_status_id INT NOT NULL,
    changed_by_user_id INT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT fk_task_status_transitions_task
        FOREIGN KEY (task_id) REFERENCES tasks (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_task_status_transitions_from_status
        FOREIGN KEY (from_status_id) REFERENCES task_statuses (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_task_status_transitions_to_status
        FOREIGN KEY (to_status_id) REFERENCES task_statuses (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_task_status_transitions_changed_by
        FOREIGN KEY (changed_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_task_status_transitions_distinct CHECK (
        from_status_id IS NULL OR from_status_id <> to_status_id
    )
);

CREATE TABLE task_work_sessions (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL,
    project_membership_id INT NOT NULL,
    started_by_user_id INT NOT NULL,
    ended_by_user_id INT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_work_sessions_task
        FOREIGN KEY (task_id) REFERENCES tasks (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_task_work_sessions_project_membership
        FOREIGN KEY (project_membership_id) REFERENCES project_memberships (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_task_work_sessions_started_by
        FOREIGN KEY (started_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_task_work_sessions_ended_by
        FOREIGN KEY (ended_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_task_work_sessions_ended_pair CHECK (
        (ended_at IS NULL AND ended_by_user_id IS NULL)
        OR (ended_at IS NOT NULL AND ended_by_user_id IS NOT NULL AND ended_at > started_at)
    )
);

CREATE INDEX idx_users_role_id
    ON users (role_id);

CREATE INDEX idx_users_is_active
    ON users (is_active);

CREATE INDEX idx_accounts_user_id
    ON accounts (user_id);

CREATE INDEX idx_sessions_user_expires_at
    ON sessions (user_id, expires_at);

CREATE INDEX idx_sessions_expires_at
    ON sessions (expires_at);

CREATE INDEX idx_verifications_identifier
    ON verifications (identifier);

CREATE INDEX idx_verifications_expires_at
    ON verifications (expires_at);

CREATE INDEX idx_employees_employee_status_id
    ON employees (employee_status_id);

CREATE INDEX idx_areas_is_active
    ON areas (is_active);

CREATE INDEX idx_employee_area_assignments_employee_ended_at
    ON employee_area_assignments (employee_id, ended_at);

CREATE INDEX idx_employee_area_assignments_area_ended_at
    ON employee_area_assignments (area_id, ended_at);

CREATE UNIQUE INDEX uq_employee_area_assignments_active_employee
    ON employee_area_assignments (employee_id)
    WHERE ended_at IS NULL;

CREATE INDEX idx_projects_area_status_id
    ON projects (area_id, project_status_id);

CREATE INDEX idx_project_memberships_project_unassigned_at
    ON project_memberships (project_id, unassigned_at);

CREATE INDEX idx_project_memberships_employee_unassigned_at
    ON project_memberships (employee_id, unassigned_at);

CREATE UNIQUE INDEX uq_project_memberships_active_member
    ON project_memberships (project_id, employee_id)
    WHERE unassigned_at IS NULL;

CREATE INDEX idx_tasks_project_status_id
    ON tasks (project_id, task_status_id);

CREATE INDEX idx_tasks_assignee_status_id
    ON tasks (assignee_membership_id, task_status_id);

CREATE INDEX idx_tasks_task_priority_id
    ON tasks (task_priority_id);

CREATE INDEX idx_tasks_due_date
    ON tasks (due_date);

CREATE INDEX idx_tasks_deleted_at
    ON tasks (deleted_at);

CREATE INDEX idx_task_status_transitions_task_changed_at
    ON task_status_transitions (task_id, changed_at);

CREATE INDEX idx_task_status_transitions_from_status_id
    ON task_status_transitions (from_status_id);

CREATE INDEX idx_task_status_transitions_to_status_id
    ON task_status_transitions (to_status_id);

CREATE INDEX idx_task_work_sessions_task_started_at
    ON task_work_sessions (task_id, started_at);

CREATE INDEX idx_task_work_sessions_membership_started_at
    ON task_work_sessions (project_membership_id, started_at);

CREATE UNIQUE INDEX uq_task_work_sessions_open_task
    ON task_work_sessions (task_id)
    WHERE ended_at IS NULL;

CREATE OR REPLACE VIEW task_execution_summary AS
WITH session_totals AS (
    SELECT
        tws.task_id,
        MIN(tws.started_at) AS first_started_at,
        MAX(tws.ended_at) AS last_ended_at,
        SUM(EXTRACT(EPOCH FROM (COALESCE(tws.ended_at, CURRENT_TIMESTAMP) - tws.started_at))) / 60.0
            AS actual_minutes
    FROM task_work_sessions tws
    GROUP BY tws.task_id
)
SELECT
    t.id AS task_id,
    t.project_id,
    p.area_id,
    pm.employee_id AS assignee_employee_id,
    t.title,
    ts.code AS status,
    tp.code AS priority,
    t.planned_start_date,
    t.due_date,
    t.estimated_minutes,
    st.first_started_at,
    st.last_ended_at,
    COALESCE(ROUND(st.actual_minutes::NUMERIC, 2), 0) AS actual_minutes,
    CASE
        WHEN t.estimated_minutes IS NULL THEN 'UNASSESSED'
        WHEN COALESCE(st.actual_minutes, 0) > t.estimated_minutes THEN 'LATE'
        WHEN ts.code = 'DONE' THEN 'ON_TIME'
        ELSE 'UNASSESSED'
    END AS compliance_status,
    CASE
        WHEN t.estimated_minutes IS NULL THEN NULL
        ELSE ROUND((COALESCE(st.actual_minutes, 0) - t.estimated_minutes)::NUMERIC, 2)
    END AS variance_minutes
FROM tasks t
JOIN projects p
    ON p.id = t.project_id
JOIN task_statuses ts
    ON ts.id = t.task_status_id
JOIN task_priorities tp
    ON tp.id = t.task_priority_id
LEFT JOIN project_memberships pm
    ON pm.id = t.assignee_membership_id
LEFT JOIN session_totals st
    ON st.task_id = t.id
WHERE t.deleted_at IS NULL;

INSERT INTO roles (id, name, description)
VALUES
    (1, 'admin', 'Administrador del sistema'),
    (2, 'employee', 'Empleado operativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO employee_statuses (id, code, name, description)
VALUES
    (1, 'ACTIVE', 'Activo', 'Empleado habilitado para operar'),
    (2, 'INACTIVE', 'Inactivo', 'Empleado deshabilitado para operar')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_statuses (id, code, name, description)
VALUES
    (1, 'ACTIVE', 'Activo', 'Proyecto operativo'),
    (2, 'CLOSED', 'Cerrado', 'Proyecto finalizado'),
    (3, 'CANCELLED', 'Cancelado', 'Proyecto cancelado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_statuses (id, code, name, description)
VALUES
    (1, 'ASSIGNED', 'Asignada', 'Tarea asignada pendiente de iniciar'),
    (2, 'IN_PROGRESS', 'En proceso', 'Tarea en ejecucion'),
    (3, 'DONE', 'Terminada', 'Tarea completada')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_priorities (id, code, name, description)
VALUES
    (1, 'LOW', 'Baja', 'Prioridad baja'),
    (2, 'MEDIUM', 'Media', 'Prioridad media'),
    (3, 'HIGH', 'Alta', 'Prioridad alta')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE((SELECT MAX(id) FROM roles), 1), TRUE);
SELECT setval(pg_get_serial_sequence('employee_statuses', 'id'), COALESCE((SELECT MAX(id) FROM employee_statuses), 1), TRUE);
SELECT setval(pg_get_serial_sequence('project_statuses', 'id'), COALESCE((SELECT MAX(id) FROM project_statuses), 1), TRUE);
SELECT setval(pg_get_serial_sequence('task_statuses', 'id'), COALESCE((SELECT MAX(id) FROM task_statuses), 1), TRUE);
SELECT setval(pg_get_serial_sequence('task_priorities', 'id'), COALESCE((SELECT MAX(id) FROM task_priorities), 1), TRUE);
