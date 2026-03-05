CREATE TABLE IF NOT EXISTS "users" (
	"id" text NOT NULL PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamptz NOT NULL,
	"updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text NOT NULL PRIMARY KEY,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamptz NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamptz NOT NULL,
	"updatedAt" timestamptz NOT NULL,
	FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text NOT NULL PRIMARY KEY,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamptz,
	"refreshTokenExpiresAt" timestamptz,
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" timestamptz NOT NULL,
	"updatedAt" timestamptz NOT NULL,
	FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "verifications" (
	"id" text NOT NULL PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamptz NOT NULL,
	"createdAt" timestamptz NOT NULL,
	"updatedAt" timestamptz NOT NULL
);