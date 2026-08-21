npm := env_var_or_default('NPM', 'npm')
api_base := env_var_or_default('API_BASE', 'http://localhost:8787')

default: help

help:
    @just --list --unsorted

setup:
    {{npm}} ci

bundles:
    {{npm}} run build

dev:
    {{npm}} start

test-api quick='':
    node scripts/api-suite.js {{quick}} {{api_base}}

url-check:
    node scripts/check-urls.ts

check:
    {{npm}} run typecheck
    {{npm}} run format:check
