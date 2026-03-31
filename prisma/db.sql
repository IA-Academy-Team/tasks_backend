-- Database: taskapp
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

-- DROP DATABASE taskapp_dev;
CREATE DATABASE taskapp_dev;
\c taskapp_dev;
\dt;

-- ==============================
-- Tablas sin dependencias
-- ==============================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE employee_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE project_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE task_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE task_priorities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE notification_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_notification_types_code UNIQUE (code)
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

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    resource_type VARCHAR(50),
    resource_id INT,
    metadata JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_notifications_type
        FOREIGN KEY (notification_type_id) REFERENCES notification_types (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_notifications_read_pair CHECK (
        (is_read = FALSE AND read_at IS NULL)
        OR (is_read = TRUE AND read_at IS NOT NULL)
    )
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
    area_id INT,
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
    project_id INT,
    assignee_membership_id INT,
    assignee_employee_id INT,
    task_status_id INT NOT NULL DEFAULT 1,
    task_priority_id INT NOT NULL DEFAULT 2,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    planned_start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    estimated_minutes INTEGER, 
    reported_actual_minutes INTEGER,
    completion_evidence TEXT,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_tasks_assignee_membership
        FOREIGN KEY (assignee_membership_id) REFERENCES project_memberships (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_assignee_employee
        FOREIGN KEY (assignee_employee_id) REFERENCES employees (id)
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
    ),
    CONSTRAINT chk_tasks_reported_actual_minutes CHECK (
        reported_actual_minutes IS NULL OR reported_actual_minutes > 0
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

CREATE INDEX idx_notifications_user_read_created
    ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX idx_notifications_user_read_at
    ON notifications (user_id, read_at);

CREATE INDEX idx_notifications_type_id
    ON notifications (notification_type_id);

CREATE INDEX idx_notifications_resource
    ON notifications (resource_type, resource_id);

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

CREATE INDEX idx_tasks_assignee_employee_id
    ON tasks (assignee_employee_id);

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

INSERT INTO roles (id, name)
VALUES
    (1, 'admin'),
    (2, 'employee')
ON CONFLICT (id) DO NOTHING;

INSERT INTO employee_statuses (id, name)
VALUES
    (1,'Activo'),
    (2, 'Inactivo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_statuses (id, name)
VALUES
    (1, 'Activo'),
    (2, 'Cerrado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_statuses (id, name)
VALUES
    (1, 'Asignada'),
    (2, 'En proceso'),
    (3, 'Terminada')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_priorities (id, name)
VALUES
    (1, 'Baja'),
    (2, 'Media'),
    (3, 'Alta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO notification_types (id, code, name)
VALUES
    (1, 'area_assignment', 'Asignacion de area'),
    (2, 'project_assignment', 'Asignacion de proyecto'),
    (3, 'task_assignment', 'Asignacion de tarea')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
    name,
    email,
    email_verified,
    image,
    phone_number,
    role_id,
    is_active
)
VALUES
    (
        'Admin Principal',
        'admin@taskapp.local',
        TRUE,
        'https://example.com/avatar/admin-principal.png',
        '+573001000001',
        1,
        TRUE
    ),
    (
        'Sofia QA',
        'sofia.qa@taskapp.local',
        TRUE,
        'https://example.com/avatar/sofia.png',
        '+573001000004',
        2,
        TRUE
    )
ON CONFLICT (email) DO UPDATE
SET
    name = EXCLUDED.name,
    email_verified = EXCLUDED.email_verified,
    image = EXCLUDED.image,
    phone_number = EXCLUDED.phone_number,
    role_id = EXCLUDED.role_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO employees (
    user_id,
    employee_status_id,
    deactivated_at
)
SELECT
    u.id,
    1 AS employee_status_id,
    NULL AS deactivated_at
FROM users u
WHERE u.email IN (
    'sofia.qa@taskapp.local'
)
ON CONFLICT (user_id) DO UPDATE
SET
    employee_status_id = EXCLUDED.employee_status_id,
    deactivated_at = EXCLUDED.deactivated_at,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO accounts (
    user_id,
    provider_id,
    provider_account_id,
    scope,
    password
)
SELECT
    u.id,
    account_seed.provider_id,
    CASE
        WHEN account_seed.provider_id = 'credential' THEN u.id::TEXT
        ELSE account_seed.provider_account_id
    END AS provider_account_id,
    account_seed.scope,
    account_seed.password
FROM users u
JOIN (
    VALUES
        (
            'admin@taskapp.local',
            'credential',
            '',
            'app',
            '$2b$10$xbnUVyxCRo3b.8cTZTOw6.YjWCEk1cEFNBSP2WHvnwbDM0Q5giCH.'
        ),
        (
            'sofia.qa@taskapp.local',
            'credential',
            '',
            'app',
            '$2b$10$lRn4OXVVr2OCbHHwEwpg/uBeBarmic.bgNOto.SlbYPuYGvDE4Zeq'
        )
) AS account_seed(email, provider_id, provider_account_id, scope, password)
    ON account_seed.email = u.email
ON CONFLICT (provider_id, provider_account_id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    scope = EXCLUDED.scope,
    password = EXCLUDED.password,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sessions (
    user_id,
    token,
    expires_at,
    ip_address,
    user_agent
)
SELECT
    u.id,
    session_seed.token,
    CURRENT_TIMESTAMP + session_seed.expires_in,
    '127.0.0.1',
    session_seed.user_agent
FROM users u
JOIN (
    VALUES
        ('admin@taskapp.local', 'sess-admin-principal', INTERVAL '30 days', 'Seeder Admin Agent'),
        ('sofia.qa@taskapp.local', 'sess-sofia-qa', INTERVAL '7 days', 'Seeder QA Client')
) AS session_seed(email, token, expires_in, user_agent)
    ON session_seed.email = u.email
ON CONFLICT (token) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    expires_at = EXCLUDED.expires_at,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO verifications (
    identifier,
    value,
    expires_at
)
VALUES
    (
        'admin@taskapp.local',
        'verify-admin-email',
        CURRENT_TIMESTAMP + INTERVAL '2 days'
    ),
    (
        'admin@taskapp.local',
        'verify-admin-email',
        CURRENT_TIMESTAMP + INTERVAL '2 days'
    )
ON CONFLICT (identifier, value) DO UPDATE
SET
    expires_at = EXCLUDED.expires_at,
    updated_at = CURRENT_TIMESTAMP;

SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE((SELECT MAX(id) FROM roles), 1), TRUE);
SELECT setval(pg_get_serial_sequence('employee_statuses', 'id'), COALESCE((SELECT MAX(id) FROM employee_statuses), 1), TRUE);
SELECT setval(pg_get_serial_sequence('project_statuses', 'id'), COALESCE((SELECT MAX(id) FROM project_statuses), 1), TRUE);
SELECT setval(pg_get_serial_sequence('task_statuses', 'id'), COALESCE((SELECT MAX(id) FROM task_statuses), 1), TRUE);
SELECT setval(pg_get_serial_sequence('task_priorities', 'id'), COALESCE((SELECT MAX(id) FROM task_priorities), 1), TRUE);
SELECT setval(pg_get_serial_sequence('notification_types', 'id'), COALESCE((SELECT MAX(id) FROM notification_types), 1), TRUE);
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), TRUE);
SELECT setval(pg_get_serial_sequence('employees', 'id'), COALESCE((SELECT MAX(id) FROM employees), 1), TRUE);
SELECT setval(pg_get_serial_sequence('accounts', 'id'), COALESCE((SELECT MAX(id) FROM accounts), 1), TRUE);
SELECT setval(pg_get_serial_sequence('sessions', 'id'), COALESCE((SELECT MAX(id) FROM sessions), 1), TRUE);
SELECT setval(pg_get_serial_sequence('verifications', 'id'), COALESCE((SELECT MAX(id) FROM verifications), 1), TRUE);
