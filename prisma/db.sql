CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('ADMIN', 'EMPLOYEE');
CREATE TYPE auth_provider_type AS ENUM ('PASSWORD', 'OAUTH');
CREATE TYPE employee_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE project_status AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');
CREATE TYPE task_status AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'DONE');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_areas_name UNIQUE (name)
);

CREATE TABLE employee_area_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    area_id UUID NOT NULL,
    assigned_by_user_id UUID NOT NULL,
    ended_by_user_id UUID,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    assigned_by_user_id UUID NOT NULL,
    ended_by_user_id UUID,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    assignee_membership_id UUID,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    priority task_priority NOT NULL DEFAULT 'MEDIUM',
    status task_status NOT NULL DEFAULT 'ASSIGNED',
    planned_start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    estimated_minutes INTEGER,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    from_status task_status,
    to_status task_status NOT NULL,
    changed_by_user_id UUID NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    project_membership_id UUID NOT NULL,
    started_by_user_id UUID NOT NULL,
    ended_by_user_id UUID,
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

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_employee_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_role user_role;
BEGIN
    SELECT role
    INTO current_role
    FROM users
    WHERE id = NEW.user_id;

    IF current_role IS DISTINCT FROM 'EMPLOYEE' THEN
        RAISE EXCEPTION 'employees.user_id must reference a user with role EMPLOYEE';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_active_area_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_employee_status employee_status;
    current_area_active BOOLEAN;
BEGIN
    IF NEW.ended_at IS NULL THEN
        SELECT status
        INTO current_employee_status
        FROM employees
        WHERE id = NEW.employee_id;

        IF current_employee_status IS DISTINCT FROM 'ACTIVE' THEN
            RAISE EXCEPTION 'cannot create an active area assignment for an inactive employee';
        END IF;

        SELECT is_active
        INTO current_area_active
        FROM areas
        WHERE id = NEW.area_id;

        IF current_area_active IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'cannot assign an employee to an inactive area';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_active_project_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_employee_status employee_status;
    current_project_status project_status;
BEGIN
    IF NEW.unassigned_at IS NULL THEN
        SELECT status
        INTO current_employee_status
        FROM employees
        WHERE id = NEW.employee_id;

        IF current_employee_status IS DISTINCT FROM 'ACTIVE' THEN
            RAISE EXCEPTION 'cannot create an active project membership for an inactive employee';
        END IF;

        SELECT status
        INTO current_project_status
        FROM projects
        WHERE id = NEW.project_id;

        IF current_project_status IS DISTINCT FROM 'ACTIVE' THEN
            RAISE EXCEPTION 'cannot assign employees to a non-active project';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_valid_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    membership_project_id UUID;
    membership_unassigned_at TIMESTAMPTZ;
    membership_employee_status employee_status;
    current_project_status project_status;
BEGIN
    IF NEW.assignee_membership_id IS NOT NULL THEN
        SELECT pm.project_id, pm.unassigned_at, e.status, p.status
        INTO membership_project_id, membership_unassigned_at, membership_employee_status, current_project_status
        FROM project_memberships pm
        JOIN employees e
            ON e.id = pm.employee_id
        JOIN projects p
            ON p.id = pm.project_id
        WHERE pm.id = NEW.assignee_membership_id;

        IF membership_project_id IS NULL THEN
            RAISE EXCEPTION 'task assignee membership does not exist';
        END IF;

        IF membership_project_id <> NEW.project_id THEN
            RAISE EXCEPTION 'task assignee membership must belong to the same project as the task';
        END IF;

        IF membership_unassigned_at IS NOT NULL
           AND NEW.deleted_at IS NULL
           AND NEW.status <> 'DONE' THEN
            RAISE EXCEPTION 'task cannot reference an inactive project membership';
        END IF;

        IF membership_employee_status IS DISTINCT FROM 'ACTIVE'
           AND NEW.deleted_at IS NULL
           AND NEW.status <> 'DONE' THEN
            RAISE EXCEPTION 'task cannot be assigned to an inactive employee';
        END IF;

        IF current_project_status IS DISTINCT FROM 'ACTIVE'
           AND NEW.deleted_at IS NULL
           AND NEW.status <> 'DONE' THEN
            RAISE EXCEPTION 'task cannot be assigned inside a non-active project';
        END IF;
    END IF;

    IF NEW.status IN ('IN_PROGRESS', 'DONE')
       AND (NEW.assignee_membership_id IS NULL OR NEW.estimated_minutes IS NULL) THEN
        RAISE EXCEPTION 'tasks in progress or done require assignee_membership_id and estimated_minutes';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_valid_task_work_session()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    task_project_id UUID;
    membership_project_id UUID;
    membership_unassigned_at TIMESTAMPTZ;
    membership_employee_status employee_status;
    task_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT project_id, deleted_at
    INTO task_project_id, task_deleted_at
    FROM tasks
    WHERE id = NEW.task_id;

    SELECT pm.project_id, pm.unassigned_at, e.status
    INTO membership_project_id, membership_unassigned_at, membership_employee_status
    FROM project_memberships pm
    JOIN employees e
        ON e.id = pm.employee_id
    WHERE pm.id = NEW.project_membership_id;

    IF task_project_id IS NULL OR membership_project_id IS NULL THEN
        RAISE EXCEPTION 'task_work_sessions requires valid task and project membership';
    END IF;

    IF task_project_id <> membership_project_id THEN
        RAISE EXCEPTION 'task_work_sessions membership must belong to the same project as the task';
    END IF;

    IF task_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'cannot create work sessions for deleted tasks';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF membership_unassigned_at IS NOT NULL THEN
            RAISE EXCEPTION 'cannot start a work session with an inactive project membership';
        END IF;

        IF membership_employee_status IS DISTINCT FROM 'ACTIVE' THEN
            RAISE EXCEPTION 'cannot start a work session for an inactive employee';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_auth_identities_set_updated_at
BEFORE UPDATE ON auth_identities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_auth_sessions_set_updated_at
BEFORE UPDATE ON auth_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employees_set_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_areas_set_updated_at
BEFORE UPDATE ON areas
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employee_area_assignments_set_updated_at
BEFORE UPDATE ON employee_area_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_set_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_project_memberships_set_updated_at
BEFORE UPDATE ON project_memberships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_set_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_task_work_sessions_set_updated_at
BEFORE UPDATE ON task_work_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employees_validate_user_role
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION ensure_employee_user_role();

CREATE TRIGGER trg_employee_area_assignments_validate
BEFORE INSERT OR UPDATE ON employee_area_assignments
FOR EACH ROW
EXECUTE FUNCTION ensure_active_area_assignment();

CREATE TRIGGER trg_project_memberships_validate
BEFORE INSERT OR UPDATE ON project_memberships
FOR EACH ROW
EXECUTE FUNCTION ensure_active_project_membership();

CREATE TRIGGER trg_tasks_validate_assignment
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION ensure_valid_task_assignment();

CREATE TRIGGER trg_task_work_sessions_validate
BEFORE INSERT OR UPDATE ON task_work_sessions
FOR EACH ROW
EXECUTE FUNCTION ensure_valid_task_work_session();

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
    t.status,
    t.priority,
    t.planned_start_date,
    t.due_date,
    t.estimated_minutes,
    st.first_started_at,
    st.last_ended_at,
    COALESCE(ROUND(st.actual_minutes::NUMERIC, 2), 0) AS actual_minutes,
    CASE
        WHEN t.estimated_minutes IS NULL THEN 'UNASSESSED'
        WHEN COALESCE(st.actual_minutes, 0) > t.estimated_minutes THEN 'LATE'
        WHEN t.status = 'DONE' THEN 'ON_TIME'
        ELSE 'UNASSESSED'
    END AS compliance_status,
    CASE
        WHEN t.estimated_minutes IS NULL THEN NULL
        ELSE ROUND((COALESCE(st.actual_minutes, 0) - t.estimated_minutes)::NUMERIC, 2)
    END AS variance_minutes
FROM tasks t
JOIN projects p
    ON p.id = t.project_id
LEFT JOIN project_memberships pm
    ON pm.id = t.assignee_membership_id
LEFT JOIN session_totals st
    ON st.task_id = t.id
WHERE t.deleted_at IS NULL;
