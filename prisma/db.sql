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
    name VARCHAR(12) NOT NULL,
);

CREATE TYPE auth_provider_type AS ENUM ('PASSWORD', 'OAUTH');
CREATE TYPE employee_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE project_status AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');
CREATE TYPE task_status AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'DONE');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(120) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE auth_identities (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    provider_type auth_provider_type NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_identities_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_auth_identities_provider_subject UNIQUE (provider_name, provider_subject),
    CONSTRAINT uq_auth_identities_user_provider UNIQUE (user_id, provider_name),
    CONSTRAINT chk_auth_identities_password_requirement CHECK (
        (provider_type = 'PASSWORD' AND password_hash IS NOT NULL)
        OR (provider_type = 'OAUTH' AND password_hash IS NULL)
    )
);

CREATE TABLE auth_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_auth_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT chk_auth_sessions_revoked_at CHECK (
        revoked_at IS NULL OR revoked_at >= created_at
    )
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    status employee_status NOT NULL DEFAULT 'ACTIVE',
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employees_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_employees_user_id UNIQUE (user_id),
    CONSTRAINT chk_employees_status_dates CHECK (
        (status = 'ACTIVE' AND deactivated_at IS NULL)
        OR (status = 'INACTIVE' AND deactivated_at IS NOT NULL)
    )
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
    name VARCHAR(160) NOT NULL,
    description TEXT,
    status project_status NOT NULL DEFAULT 'ACTIVE',
    start_date DATE,
    end_date DATE,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_area
        FOREIGN KEY (area_id) REFERENCES areas (id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_projects_area_name UNIQUE (area_id, name),
    CONSTRAINT chk_projects_dates CHECK (
        start_date IS NULL OR end_date IS NULL OR end_date >= start_date
    ),
    CONSTRAINT chk_projects_status_closed_at CHECK (
        (status = 'ACTIVE' AND closed_at IS NULL)
        OR (status IN ('CLOSED', 'CANCELLED') AND closed_at IS NOT NULL)
    )
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
    title VARCHAR(160) NOT NULL,
    description TEXT,
    priority task_priority NOT NULL DEFAULT 'MEDIUM',
    status task_status NOT NULL DEFAULT 'ASSIGNED',
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
    CONSTRAINT fk_tasks_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_tasks_dates CHECK (
        due_date >= planned_start_date
    ),
    CONSTRAINT chk_tasks_estimated_minutes CHECK (
        estimated_minutes IS NULL OR estimated_minutes > 0
    ),
    CONSTRAINT chk_tasks_status_requires_assignment CHECK (
        status = 'ASSIGNED'
        OR (assignee_membership_id IS NOT NULL AND estimated_minutes IS NOT NULL)
    )
);

CREATE TABLE task_status_transitions (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL,
    from_status task_status,
    to_status task_status NOT NULL,
    changed_by_user_id INT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT fk_task_status_transitions_task
        FOREIGN KEY (task_id) REFERENCES tasks (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_task_status_transitions_changed_by
        FOREIGN KEY (changed_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_task_status_transitions_distinct CHECK (
        from_status IS NULL OR from_status <> to_status
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

CREATE INDEX idx_users_role
    ON users (role);

CREATE INDEX idx_auth_identities_user_id
    ON auth_identities (user_id);

CREATE INDEX idx_auth_sessions_user_expires_at
    ON auth_sessions (user_id, expires_at);

CREATE INDEX idx_auth_sessions_expires_at
    ON auth_sessions (expires_at);

CREATE INDEX idx_employees_status
    ON employees (status);

CREATE INDEX idx_areas_is_active
    ON areas (is_active);

CREATE INDEX idx_employee_area_assignments_employee_ended_at
    ON employee_area_assignments (employee_id, ended_at);

CREATE INDEX idx_employee_area_assignments_area_ended_at
    ON employee_area_assignments (area_id, ended_at);

CREATE UNIQUE INDEX uq_employee_area_assignments_active_employee
    ON employee_area_assignments (employee_id)
    WHERE ended_at IS NULL;

CREATE INDEX idx_projects_area_status
    ON projects (area_id, status);

CREATE INDEX idx_project_memberships_project_unassigned_at
    ON project_memberships (project_id, unassigned_at);

CREATE INDEX idx_project_memberships_employee_unassigned_at
    ON project_memberships (employee_id, unassigned_at);

CREATE UNIQUE INDEX uq_project_memberships_active_member
    ON project_memberships (project_id, employee_id)
    WHERE unassigned_at IS NULL;

CREATE INDEX idx_tasks_project_status
    ON tasks (project_id, status);

CREATE INDEX idx_tasks_assignee_status
    ON tasks (assignee_membership_id, status);

CREATE INDEX idx_tasks_due_date
    ON tasks (due_date);

CREATE INDEX idx_tasks_deleted_at
    ON tasks (deleted_at);

CREATE INDEX idx_task_status_transitions_task_changed_at
    ON task_status_transitions (task_id, changed_at);

CREATE INDEX idx_task_work_sessions_task_started_at
    ON task_work_sessions (task_id, started_at);

CREATE INDEX idx_task_work_sessions_membership_started_at
    ON task_work_sessions (project_membership_id, started_at);

CREATE UNIQUE INDEX uq_task_work_sessions_open_task
    ON task_work_sessions (task_id)
    WHERE ended_at IS NULL;
