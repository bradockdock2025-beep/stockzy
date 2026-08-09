#!/usr/bin/env python3
"""
Gera uma collection Postman v2.1 completa a partir da lista real de rotas
mapeadas pelo NestJS (extraída do log de start:dev — RouterExplorer "Mapped {...}").
Não inventa endpoint nenhum: só os 188 que a aplicação realmente registrou.
"""
import json
import re

ROUTES_FILE = "/tmp/routes_clean.txt"
OUT_FILE = "postman/stockzy-ecommerce-api-full.postman_collection.json"

# Rotas que NAO precisam de Authorization (login, registro, público explícito)
NO_AUTH_PATTERNS = [
    r"^/$", r"^/health$", r"^/debug/error$", r"^/metrics$",
    r"^/products", r"^/categories($|/)", r"^/catalog", r"^/search",
    r"^/banners$", r"^/announcements$", r"^/homepage", r"^/newsletter",
    r"^/coupons/validate$", r"^/orders/guest", r"^/webhooks", r"^/payments/stripe/webhook$",
    r"^/admin/auth/login$", r"^/admin/auth/refresh$",
    r"^/customers/login", r"^/customers/register$", r"^/customers/refresh$",
    r"^/customers/verify/", r"^/customers/password-reset/",
]

def needs_admin_auth(path):
    return path.startswith("/admin/") and not any(re.match(p, path) for p in NO_AUTH_PATTERNS)

def needs_customer_auth(path):
    return path.startswith("/customers/") and not any(re.match(p, path) for p in NO_AUTH_PATTERNS)

def needs_no_auth(path):
    return any(re.match(p, path) for p in NO_AUTH_PATTERNS)

def folder_for(path):
    parts = [p for p in path.split("/") if p]
    if not parts:
        return "root"
    if parts[0] == "admin" and len(parts) > 1:
        return f"admin-{parts[1]}"
    return parts[0]

def build_url(path):
    parts = [p for p in path.split("/") if p]
    path_vars = [p[1:] for p in parts if p.startswith(":")]
    url_parts = [f"{{{{{p[1:]}}}}}" if p.startswith(":") else p for p in parts]
    url = {
        "raw": "{{baseUrl}}/" + "/".join(url_parts),
        "host": ["{{baseUrl}}"],
        "path": url_parts,
    }
    if path_vars:
        url["variable"] = [{"key": v, "value": ""} for v in path_vars]
    return url

def build_item(method, path):
    name = f"{method} {path}"
    headers = []
    if needs_admin_auth(path):
        headers.append({"key": "Authorization", "value": "Bearer {{adminToken}}", "type": "text"})
    elif needs_customer_auth(path):
        headers.append({"key": "Authorization", "value": "Bearer {{customerToken}}", "type": "text"})

    item = {
        "name": name,
        "request": {
            "method": method,
            "header": list(headers),
            "url": build_url(path),
        },
    }

    if method in ("POST", "PATCH", "PUT"):
        headers.append({"key": "Content-Type", "value": "application/json", "type": "text"})
        item["request"]["header"] = headers
        item["request"]["body"] = {
            "mode": "raw",
            "raw": "{}",
            "options": {"raw": {"language": "json"}},
        }

    return item

def main():
    with open(ROUTES_FILE) as f:
        lines = [l.strip() for l in f if l.strip()]

    folders = {}
    for line in lines:
        method, path = line.split(" ", 1)
        folder = folder_for(path)
        folders.setdefault(folder, []).append(build_item(method, path))

    folder_items = []
    for folder_name in sorted(folders.keys()):
        items = sorted(folders[folder_name], key=lambda i: i["name"])
        folder_items.append({"name": folder_name, "item": items})

    collection = {
        "info": {
            "name": "stockzy-ecommerce-api (completo)",
            "description": "Gerado automaticamente a partir das rotas reais registradas pelo NestJS (npm run start:dev, RouterExplorer). 188 endpoints.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "variable": [
            {"key": "baseUrl", "value": "http://localhost:3000"},
            {"key": "adminToken", "value": ""},
            {"key": "customerToken", "value": ""},
        ],
        "item": folder_items,
    }

    with open(OUT_FILE, "w") as f:
        json.dump(collection, f, indent=2, ensure_ascii=False)

    total = sum(len(f["item"]) for f in folder_items)
    print(f"Pastas: {len(folder_items)} | Endpoints: {total}")
    print(f"Arquivo: {OUT_FILE}")

if __name__ == "__main__":
    main()
