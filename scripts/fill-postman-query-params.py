#!/usr/bin/env python3
"""
Habilita e preenche com valores reais/plausíveis os query params de todo GET da
collection completa (postman/stockzy-ecommerce-api-full.postman_collection.json).
O gerador (generate-postman-collection-v2.py) extrai os params certos dos DTOs, mas
deixa todos com `disabled: true` e valores tipo-stub ("string", "<enum>", UUID
zerado) — isso significa que, ao clicar Send no Postman, NENHUM desses params é
realmente enviado.

Regra aplicada:
  - cursor: sempre "" (vazio) — um UUID fake quebraria a paginação por cursor do
    Prisma (exige que o cursor aponte pra uma linha que existe de verdade).
  - enums (<product_status>, <order_status>, etc.) e roles/scopes: substituídos
    pelo valor real do enum (extraído de prisma/schema.prisma).
  - IDs que apontam pra um recurso que TEM linha real no banco (customer, category,
    product): usa o ID real.
  - IDs que apontam pra um recurso 100% vazio no banco (orders, users/admin,
    promotions, shipments) ou pra um valor cujo pareamento com dado real não existe
    (actorId/actorEmail dos audit_logs, que estão null nas 784 linhas atuais):
    fica DESABILITADO com uma description explicando o motivo — não finge que
    existe um pedido/usuário/promoção real quando não existe.
  - texto livre / booleans / datas / paginação: preenchidos com um valor plausível
    e habilitados (não afirmam a existência de um registro específico, então não
    há risco de "inventar dado").

Uso: python3 scripts/fill-postman-query-params.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / "postman" / "stockzy-ecommerce-api-full.postman_collection.json"

PRODUCT_ID = "a6f78187-8b1e-441e-8175-fd44774ad8fc"
CATEGORY_ROOT_SNEAKERS = "8bc65a50-607c-4707-83c5-995ce8e5f289"
CUSTOMER_ID = "5ab66f66-539c-48d2-8856-17b7e176e715"
CUSTOMER_EMAIL = "teste.1786299873@stockzy-test.com"

# enums reais (prisma/schema.prisma)
ENUM_REPLACE = {
    "<product_status>": "draft",   # todos os 126 produtos do drop atual estão draft — usar "active" retornaria 0
    "<order_status>": "pending",
    "<payment_status>": "pending",
    "<shipment_status>": "pending",
    "<user_role>": "admin",
    "<facet_scope>": "product",
}

NO_DATA = "Nenhum registro real existe ainda neste recurso — não preenchi com um ID inventado."
NO_MATCH_AUDIT = "Todos os audit_logs atuais têm este campo nulo (script de seed rodou sem ator autenticado) — não há valor real pra filtrar ainda."

DISABLE_WITH_NOTE = {
    "actorId": NO_MATCH_AUDIT,
    "actorEmail": NO_MATCH_AUDIT,
    "orderId": NO_DATA,           # orders = 0 linhas
    "code": NO_DATA,              # promotions = 0 linhas
    "trackingNumber": NO_DATA,    # shipments = 0 linhas
    "token": NO_DATA,             # token de guest order — não há order pra referenciar
}

# valor fixo (habilitado) por chave — aplicado sempre que a chave não estiver em
# DISABLE_WITH_NOTE nem seja tratada por regra especial (cursor/status)
VALUE_MAP = {
    "action": "create",
    "active": "true",
    "activeOnly": "true",
    "belowRetail": "true",
    "categoryId": CATEGORY_ROOT_SNEAKERS,
    "context": "homepage",
    "country": "PT",
    "customerId": CUSTOMER_ID,
    "days": "30",
    "email": CUSTOMER_EMAIL,
    "entity": "product",
    "entityId": PRODUCT_ID,
    "featured": "true",
    "from": "2026-01-01T00:00:00.000Z",
    "to": "2026-08-23T23:59:59.000Z",
    "hasDiscount": "true",
    "inStock": "true",
    "ip": "127.0.0.1",
    "isActive": "true",
    "limit": "12",
    "locale": "pt",
    "maxPrice": "500",
    "minDiscount": "0",
    "minPrice": "0",
    "page": "1",
    "parentId": CATEGORY_ROOT_SNEAKERS,
    "sessionId": "sess-demo-001",
    "section": "featured",
    "search": "jordan",
}

# chaves cujo valor JÁ está bom (realista) — só precisam ser habilitadas, não trocadas
KEEP_VALUE_JUST_ENABLE = {"q", "sort", "facets", "type", "window", "minDiscount"}


def fix_query(query_list, stats):
    for q in query_list:
        key = q.get("key")
        value = q.get("value")

        if key == "cursor":
            q["value"] = ""
            q["disabled"] = False
            stats["fixed"] += 1
            continue

        if value in ENUM_REPLACE:
            q["value"] = ENUM_REPLACE[value]
            q["disabled"] = False
            stats["fixed"] += 1
            continue

        if key in DISABLE_WITH_NOTE:
            q["value"] = ""
            q["disabled"] = True
            q["description"] = DISABLE_WITH_NOTE[key]
            stats["disabled_noted"] += 1
            continue

        if key in VALUE_MAP:
            q["value"] = VALUE_MAP[key]
            q["disabled"] = False
            stats["fixed"] += 1
            continue

        if key in KEEP_VALUE_JUST_ENABLE:
            q["disabled"] = False
            stats["enabled_only"] += 1
            continue

        stats["unhandled"].append((key, value))


def walk(items, stats):
    for it in items:
        if "item" in it:
            walk(it["item"], stats)
            continue
        req = it.get("request", {})
        if req.get("method") != "GET":
            continue
        url = req.get("url", {})
        query = url.get("query")
        if query:
            fix_query(query, stats)


def main():
    data = json.loads(FILE.read_text())
    stats = {"fixed": 0, "disabled_noted": 0, "enabled_only": 0, "unhandled": []}
    walk(data.get("item", []), stats)

    if stats["unhandled"]:
        print("ATENÇÃO — chaves não tratadas (revisar manualmente):")
        for k, v in stats["unhandled"]:
            print("  ", k, "=", v)

    FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Params corrigidos e habilitados com valor real: {stats['fixed']}")
    print(f"Params só habilitados (valor já era bom): {stats['enabled_only']}")
    print(f"Params deixados desabilitados com nota (sem dado real): {stats['disabled_noted']}")
    print(f"Arquivo salvo: {FILE}")


if __name__ == "__main__":
    main()
