#!/usr/bin/env python3
"""
Preenche as path variables ({{id}}, {{productId}}, {{variantId}}, {{slug}},
{{facetId}}) da collection completa (postman/stockzy-ecommerce-api-full.postman_collection.json)
com valores REAIS do banco de produção, um por um, por request — não é um valor de
coleção genérico, porque {{id}} é reusado por dezenas de recursos diferentes
(brand, category, product, order, etc.) e cada um precisa do seu próprio ID real.

Onde não existe NENHUM registro real ainda (tabela vazia — orders, payments,
shipments, addresses, banners, announcements, promotions, homepage tiles, social
feed images, newsletter subscriptions, admin users) ou a tabela nem existe no banco
ainda (offers, feature Make Offer não migrada), NÃO inventa um UUID — deixa vazio e
anota o motivo na description da variable, pra não passar a impressão de que foi
esquecido.

Uso: python3 scripts/fill-postman-path-vars.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / "postman" / "stockzy-ecommerce-api-full.postman_collection.json"

# --- valores reais, extraídos do banco em 2026-08-23 ---
PRODUCT_ID = "a6f78187-8b1e-441e-8175-fd44774ad8fc"          # Jordan 4 Retro Vivid Sulfur
PRODUCT_SLUG = "jordan-4-retro-vivid-sulfur"
VARIANT_ID = "20a2318e-aab3-4f84-b88c-6966bd4cfaac"           # variante única desse produto
BRAND_ID = "0b078db2-4232-4d26-91b4-5a46a3bcab78"             # Jordan
CATEGORY_ROOT_SNEAKERS = "8bc65a50-607c-4707-83c5-995ce8e5f289"
CATEGORY_LEAF_TOPS = "cef20acb-f27c-4b6f-8d4e-c23d5beb95d0"
FACET_ID_COLOR = "4b568c2f-5d22-44e7-8502-2611a334de4e"
FACET_VALUE_ID_BLACK = "0e1cbc1c-42cd-433a-aa04-4dd0a2d4a8be"  # facet_value "black" do facet color
CUSTOMER_ID = "5ab66f66-539c-48d2-8856-17b7e176e715"           # único customer existente (conta de teste)

NO_DATA = "Nenhum registro real existe ainda nesta tabela (0 linhas em 2026-08-23) — crie um via POST correspondente primeiro e cole o ID real aqui. Não preenchi com um UUID inventado."
NO_TABLE_OFFERS = "A tabela 'offers' (feature Make Offer) ainda não existe no banco real — rode a migration antes de usar este endpoint. Não preenchi com um UUID inventado."

# (method, path-com-{{var}}) -> { var_key: (value, description_se_vazio) }
MAPPING = {
    ("DELETE", "admin/announcements/{{id}}"): {"id": (None, NO_DATA)},
    ("GET", "admin/announcements/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/announcements/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/announcements/{{id}}/deactivate"): {"id": (None, NO_DATA)},
    ("DELETE", "admin/banners/{{id}}"): {"id": (None, NO_DATA)},
    ("GET", "admin/banners/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/banners/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/banners/{{id}}/deactivate"): {"id": (None, NO_DATA)},
    ("POST", "admin/banners/{{id}}/image"): {"id": (None, NO_DATA)},
    ("DELETE", "admin/brands/{{id}}"): {"id": (BRAND_ID, None)},
    ("GET", "admin/brands/{{id}}"): {"id": (BRAND_ID, None)},
    ("PATCH", "admin/brands/{{id}}"): {"id": (BRAND_ID, None)},
    ("PATCH", "admin/brands/{{id}}/deactivate"): {"id": (BRAND_ID, None)},
    ("DELETE", "admin/categories/{{id}}"): {"id": (CATEGORY_LEAF_TOPS, None)},
    ("GET", "admin/categories/{{id}}"): {"id": (CATEGORY_LEAF_TOPS, None)},
    ("PATCH", "admin/categories/{{id}}"): {"id": (CATEGORY_LEAF_TOPS, None)},
    ("PATCH", "admin/categories/{{id}}/deactivate"): {"id": (CATEGORY_LEAF_TOPS, None)},
    ("POST", "admin/categories/{{id}}/merge"): {"id": (CATEGORY_LEAF_TOPS, None)},
    ("GET", "admin/customers/{{id}}"): {"id": (CUSTOMER_ID, None)},
    ("PATCH", "admin/customers/{{id}}"): {"id": (CUSTOMER_ID, None)},
    ("PATCH", "admin/customers/{{id}}/deactivate"): {"id": (CUSTOMER_ID, None)},
    ("GET", "admin/customers/{{id}}/export"): {"id": (CUSTOMER_ID, None)},
    ("POST", "admin/facets/{{facetId}}/values"): {"facetId": (FACET_ID_COLOR, None)},
    ("DELETE", "admin/facets/{{facetId}}/values/{{id}}"): {"facetId": (FACET_ID_COLOR, None), "id": (FACET_VALUE_ID_BLACK, None)},
    ("PATCH", "admin/facets/{{facetId}}/values/{{id}}"): {"facetId": (FACET_ID_COLOR, None), "id": (FACET_VALUE_ID_BLACK, None)},
    ("DELETE", "admin/facets/{{id}}"): {"id": (FACET_ID_COLOR, None)},
    ("GET", "admin/facets/{{id}}"): {"id": (FACET_ID_COLOR, None)},
    ("PATCH", "admin/facets/{{id}}"): {"id": (FACET_ID_COLOR, None)},
    ("DELETE", "admin/homepage/social/images/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/homepage/social/images/{{id}}"): {"id": (None, NO_DATA)},
    ("DELETE", "admin/homepage/tiles/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/homepage/tiles/{{id}}"): {"id": (None, NO_DATA)},
    ("DELETE", "admin/newsletter/subscriptions/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/offers/{{id}}/accept"): {"id": (None, NO_TABLE_OFFERS)},
    ("PATCH", "admin/offers/{{id}}/reject"): {"id": (None, NO_TABLE_OFFERS)},
    ("DELETE", "admin/orders/{{id}}"): {"id": (None, NO_DATA)},
    ("GET", "admin/orders/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/orders/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/orders/{{id}}/cancel"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/orders/{{id}}/status"): {"id": (None, NO_DATA)},
    ("GET", "admin/payments/{{id}}"): {"id": (None, NO_DATA)},
    ("DELETE", "admin/products/{{id}}"): {"id": (PRODUCT_ID, None)},
    ("GET", "admin/products/{{id}}"): {"id": (PRODUCT_ID, None)},
    ("PATCH", "admin/products/{{id}}"): {"id": (PRODUCT_ID, None)},
    ("PATCH", "admin/products/{{id}}/archive"): {"id": (PRODUCT_ID, None)},
    ("POST", "admin/products/{{id}}/images"): {"id": (PRODUCT_ID, None)},
    ("GET", "admin/products/{{id}}/price-history"): {"id": (PRODUCT_ID, None)},
    ("PATCH", "admin/products/variants/{{id}}/presale"): {"id": (VARIANT_ID, None)},
    ("GET", "admin/promotions/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/promotions/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/promotions/{{id}}/deactivate"): {"id": (None, NO_DATA)},
    ("GET", "admin/reports/orders/{{id}}"): {"id": (None, NO_DATA)},
    ("GET", "admin/shipments/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/shipments/{{id}}"): {"id": (None, NO_DATA)},
    ("POST", "admin/shipments/{{id}}/events"): {"id": (None, NO_DATA)},
    ("DELETE", "admin/users/{{id}}"): {"id": (None, NO_DATA)},
    ("GET", "admin/users/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/users/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "admin/users/{{id}}/deactivate"): {"id": (None, NO_DATA)},
    ("DELETE", "cart/items/{{variantId}}"): {"variantId": (VARIANT_ID, None)},
    ("PATCH", "cart/items/{{variantId}}"): {"variantId": (VARIANT_ID, None)},
    ("GET", "categories/{{id}}"): {"id": (CATEGORY_ROOT_SNEAKERS, None)},
    ("DELETE", "customers/addresses/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "customers/addresses/{{id}}"): {"id": (None, NO_DATA)},
    ("GET", "customers/offers/{{id}}"): {"id": (None, NO_TABLE_OFFERS)},
    ("GET", "customers/orders/{{id}}"): {"id": (None, NO_DATA)},
    ("PATCH", "customers/orders/{{id}}/cancel"): {"id": (None, NO_DATA)},
    ("POST", "customers/orders/{{id}}/payment"): {"id": (None, NO_DATA)},
    ("POST", "customers/orders/{{id}}/payment/confirm"): {"id": (None, NO_DATA)},
    ("GET", "customers/orders/{{id}}/tracking"): {"id": (None, NO_DATA)},
    ("DELETE", "customers/wishlist/items/{{productId}}"): {"productId": (PRODUCT_ID, None)},
    ("POST", "customers/wishlist/items/{{productId}}/move-to-cart"): {"productId": (PRODUCT_ID, None)},
    ("GET", "orders/{{id}}/receipt"): {"id": (None, NO_DATA)},
    ("GET", "orders/guest/{{id}}"): {"id": (None, NO_DATA)},
    ("GET", "orders/offers/{{id}}"): {"id": (None, NO_TABLE_OFFERS)},
    ("GET", "products/{{id}}"): {"id": (PRODUCT_ID, None)},
    ("GET", "products/{{id}}/also-viewed"): {"id": (PRODUCT_ID, None)},
    ("POST", "products/{{id}}/view"): {"id": (PRODUCT_ID, None)},
    ("POST", "products/{{variantId}}/offers"): {"variantId": (VARIANT_ID, "ID real, mas a tabela 'offers' ainda não existe no banco — este endpoint responde 500 até a migration rodar.")},
    ("GET", "products/slug/{{slug}}"): {"slug": (PRODUCT_SLUG, None)},
}


def walk(items, stats):
    for it in items:
        if "item" in it:
            walk(it["item"], stats)
            continue
        req = it.get("request", {})
        method = req.get("method")
        url = req.get("url", {})
        path_list = url.get("path", [])
        variables = url.get("variable")
        if not variables:
            continue
        path_str = "/".join(path_list)
        key = (method, path_str)
        rule = MAPPING.get(key)
        if rule is None:
            stats["unmapped"].append(key)
            continue
        for v in variables:
            vkey = v.get("key")
            if vkey not in rule:
                stats["unmapped_var"].append((key, vkey))
                continue
            value, note = rule[vkey]
            if value is not None:
                v["value"] = value
                stats["filled"] += 1
            else:
                v["value"] = ""
                v["description"] = note
                stats["no_data"] += 1


def main():
    data = json.loads(FILE.read_text())
    stats = {"filled": 0, "no_data": 0, "unmapped": [], "unmapped_var": []}
    walk(data.get("item", []), stats)

    if stats["unmapped"] or stats["unmapped_var"]:
        print("ATENÇÃO — combinações não mapeadas (não tocadas):")
        for k in stats["unmapped"]:
            print("  path sem mapeamento:", k)
        for k, v in stats["unmapped_var"]:
            print("  variable sem mapeamento:", k, v)

    FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Preenchidos com ID real: {stats['filled']}")
    print(f"Deixados vazios com nota explicativa (sem dado real / tabela vazia): {stats['no_data']}")
    print(f"Arquivo salvo: {FILE}")


if __name__ == "__main__":
    main()
