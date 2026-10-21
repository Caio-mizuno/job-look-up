SHELL := /bin/bash
# O container roda com o mesmo uid/gid do host para escrever em ./data sem sudo.
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

.PHONY: setup up down logs

setup:
	@node scripts/setup-env.mjs
	@mkdir -p data

up: setup
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f
