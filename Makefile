SHELL := /bin/bash
# O container roda com o mesmo uid/gid do host para escrever em ./data sem sudo.
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

.PHONY: setup up down logs bridge bridge-deps

setup:
	@node scripts/setup-env.mjs
	@mkdir -p data

up: setup bridge-deps
	docker compose up -d --build
	@echo "App em http://127.0.0.1:3000 — iniciando o ajudante (Ctrl+C para parar)"
	node bridge/index.mjs

bridge: bridge-deps
	node bridge/index.mjs

# Única dependência do ajudante: playwright-core, para abrir Indeed e Glassdoor no Chrome instalado.
bridge-deps:
	@test -d bridge/node_modules/playwright-core || npm --prefix bridge ci --no-audit --no-fund

down:
	docker compose down

logs:
	docker compose logs -f
