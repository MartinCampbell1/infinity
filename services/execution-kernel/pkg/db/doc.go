// Package db owns execution-kernel storage adapters.
//
// Runtime request handlers must not issue DDL. Postgres schemas live in
// services/execution-kernel/migrations and the service fails closed in
// production-like environments when a Postgres store is not configured.
package db
