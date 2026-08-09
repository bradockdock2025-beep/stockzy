#!/usr/bin/env python3
"""
Gera uma collection Postman v2.1 completa, com corpo de exemplo real (não só `{}`)
pra cada POST/PATCH/PUT, extraído dos DTOs (`@Body() dto: XxxDto`) via parsing dos
arquivos .dto.ts do próprio projeto. Não inventa endpoint — só os que existem de
verdade nos controllers.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "modules"
OUT_FILE = ROOT / "postman" / "stockzy-ecommerce-api-full.postman_collection.json"

HTTP_METHODS = ["Get", "Post", "Patch", "Put", "Delete"]

# ---------- parsing de DTO ----------

def split_top_level(text, seps=";"):
    """Divide o texto em 'membros' de classe, cortando em ; que estao no nivel 0 de
    parenteses/colchetes/chaves (pra nao cortar dentro de @Foo({...}) ou @Bar([...]))."""
    depth = 0
    current = []
    out = []
    for ch in text:
        current.append(ch)
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch in seps and depth == 0:
            out.append("".join(current))
            current = []
    if "".join(current).strip():
        out.append("".join(current))
    return out


def extract_class_body(text, class_name):
    m = re.search(r"class\s+" + re.escape(class_name) + r"\b[^{]*\{", text)
    if not m:
        return None
    start = m.end()
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    return text[start : i - 1]


def find_class_text(class_name, dto_index):
    """Acha o arquivo .dto.ts que contem `class {class_name}` e devolve (texto_arquivo)."""
    for path, text in dto_index.items():
        if re.search(r"\bclass\s+" + re.escape(class_name) + r"\b", text):
            return text
    return None


def find_partial_type_base(class_name, dto_index):
    """`class UpdateXDto extends PartialType(CreateXDto) {}` não tem campo próprio pro
    parser achar — resolve o nome da classe-base (CreateXDto) pra reusar os campos dela."""
    text = find_class_text(class_name, dto_index)
    if not text:
        return None
    m = re.search(
        r"class\s+" + re.escape(class_name) + r"\b[^{]*extends\s+(?:OmitType\(|PickType\()?PartialType\(\s*(\w+)",
        text,
    )
    return m.group(1) if m else None


PRIMITIVE_EXAMPLES = {
    "string": "string",
    "number": 0,
    "boolean": False,
}

FIELD_NAME_HINTS = [
    # Campos específicos do catálogo desta API — valores reais já validados nesta sessão
    # (marca/facetas/busca), pra dar exemplo de filtro combinável de verdade, não genérico.
    (re.compile(r"^brand$"), "nike"),
    (re.compile(r"^facets$"), "color:black;gender:men"),
    (re.compile(r"^q$"), "air jordan"),
    (re.compile(r"email", re.I), "user@example.com"),
    (re.compile(r"password", re.I), "Senha123!"),
    (re.compile(r"slug", re.I), "example-slug"),
    (re.compile(r"^name$|Name$", re.I), "Example Name"),
    (re.compile(r"^code$|Code$", re.I), "ABC"),
    (re.compile(r"url|Url", re.I), "https://example.com"),
    (re.compile(r"phone", re.I), "+351912345678"),
    (re.compile(r"description", re.I), "Example description."),
    (re.compile(r"token", re.I), "example-token"),
    (re.compile(r"locale", re.I), "pt"),
    (re.compile(r"country", re.I), "PT"),
    (re.compile(r"currency", re.I), "EUR"),
    (re.compile(r"^sku$", re.I), "SKU-EXAMPLE-001"),
]

FIELD_NUMBER_HINTS = [
    (re.compile(r"price", re.I), 99.99),
    (re.compile(r"quantity|stock|limit", re.I), 1),
    (re.compile(r"^page$", re.I), 1),
    (re.compile(r"sortOrder|position|order$", re.I), 1),
]

UUID_PLACEHOLDER = "00000000-0000-0000-0000-000000000000"


def string_example(field_name):
    for pattern, value in FIELD_NAME_HINTS:
        if pattern.search(field_name):
            return value
    return "string"


def number_example(field_name):
    for pattern, value in FIELD_NUMBER_HINTS:
        if pattern.search(field_name):
            return value
    return 0


def parse_dto_fields(class_name, dto_index, depth=0, seen=None):
    if seen is None:
        seen = set()
    if depth > 2 or class_name in seen:
        return {}
    seen = seen | {class_name}

    text = find_class_text(class_name, dto_index)
    if not text:
        return {}
    body = extract_class_body(text, class_name)
    if body is None:
        return {}

    # `class UpdateXDto extends PartialType(CreateXDto) { ...campos próprios adicionais }`
    # herda os campos da base (mapped-types), o parser estático não vê isso sozinho.
    result = {}
    base = find_partial_type_base(class_name, dto_index)
    if base and base not in seen:
        result.update(parse_dto_fields(base, dto_index, depth, seen))

    if not body.strip():
        return result

    for member in split_top_level(body):
        lines = [l.strip() for l in member.strip().split("\n") if l.strip()]
        if not lines:
            continue
        decl_line = lines[-1]
        decorator_lines = lines[:-1]
        decorators_text = " ".join(decorator_lines)

        m = re.match(r"^(\w+)(\?)?\s*:\s*([^=;]+?)(?:=.*)?;?\s*$", decl_line)
        if not m:
            continue
        field_name, optional, ts_type = m.group(1), m.group(2), m.group(3).strip()

        is_array = ts_type.endswith("[]") or "@IsArray" in decorators_text
        base_type = ts_type[:-2].strip() if ts_type.endswith("[]") else ts_type

        is_uuid = "@IsUUID" in decorators_text
        enum_match = re.search(r"@IsEnum\((\w+)\)", decorators_text)
        is_in_match = re.search(r"@IsIn\(\s*\[([^\]]*)\]\s*\)", decorators_text)
        nested_match = re.search(r"@Type\(\(\)\s*=>\s*(\w+)\)", decorators_text)
        # @Type(() => Number/String/Boolean/Date) é class-transformer convertendo tipo
        # primitivo (comum em @Query()), não uma DTO aninhada — não tenta resolver como classe.
        if nested_match and nested_match.group(1) in ("Number", "String", "Boolean", "Date"):
            nested_match = None
        is_date = "@IsDateString" in decorators_text or "@IsDate" in decorators_text
        is_bool_string = "@IsBooleanString" in decorators_text

        if nested_match:
            nested_class = nested_match.group(1)
            value = parse_dto_fields(nested_class, dto_index, depth + 1, seen)
        elif enum_match:
            value = f"<{enum_match.group(1)}>"
        elif is_in_match:
            first = re.search(r"['\"]([^'\"]+)['\"]", is_in_match.group(1))
            value = first.group(1) if first else "string"
        elif is_uuid:
            value = UUID_PLACEHOLDER
        elif is_date:
            value = "2026-01-01T00:00:00.000Z"
        elif is_bool_string:
            value = "true"
        elif base_type in ("string",):
            value = string_example(field_name)
        elif base_type in ("number",):
            value = number_example(field_name)
        elif base_type in ("boolean",):
            value = False
        elif base_type in ("any", "unknown", "Record<string, unknown>", "object") or "Record<" in base_type:
            value = {}
        else:
            # tipo desconhecido/nao-primitivo sem @Type -> tenta resolver como outro DTO
            resolved = parse_dto_fields(base_type, dto_index, depth + 1, seen)
            value = resolved if resolved else {}

        result[field_name] = [value] if is_array else value

    return result


# ---------- parsing de controller ----------

def find_matching_brace(text, open_idx):
    depth = 0
    i = open_idx
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text)


def split_by_class(text):
    """Um arquivo .controller.ts pode ter mais de uma classe @Controller (ex.:
    recommendations.controller.ts). Devolve uma lista de (base_path, is_public, corpo_da_classe)."""
    segments = []
    controller_positions = [
        (m.start(), m.group(1) or "") for m in re.finditer(r"@Controller\(\s*(?:['\"]([^'\"]*)['\"])?\s*\)", text)
    ]
    class_positions = [m.start() for m in re.finditer(r"export\s+class\s+\w+", text)]

    for class_pos in class_positions:
        candidates = [cp for cp in controller_positions if cp[0] < class_pos and class_pos - cp[0] < 400]
        if not candidates:
            continue
        ctrl_pos, base_path = max(candidates, key=lambda c: c[0])
        window = text[ctrl_pos:class_pos]
        is_public = "@Public()" in window
        brace_open = text.find("{", class_pos)
        brace_close = find_matching_brace(text, brace_open)
        segments.append((base_path, is_public, text[brace_open:brace_close]))
    return segments


def parse_controller(path, full_text):
    routes = []
    for base_path, class_public, text in split_by_class(full_text):
        routes.extend(parse_class_routes(base_path, class_public, text))
    return routes


def parse_class_routes(base_path, class_public, text):
    routes = []
    # localizar métodos: procura decorador HTTP seguido (com outros decoradores no meio) por `nome(`
    method_pattern = re.compile(
        r"@(Get|Post|Patch|Put|Delete)\(\s*(?:['\"]([^'\"]*)['\"])?\s*\)"
    )
    for m in method_pattern.finditer(text):
        http_method = m.group(1).upper()
        route_path = m.group(2) or ""

        # olha pra trás um pouco pra ver se tem @Public()/@Roles() logo antes deste método
        window_start = max(0, m.start() - 200)
        preceding = text[window_start : m.start()]
        method_public = "@Public()" in preceding
        is_public = class_public or method_public

        # olha pra frente até o `{` de abertura do método pra pegar a assinatura completa
        sig_start = m.end()
        brace_idx = text.find("{", sig_start)
        paren_start = text.find("(", sig_start)
        # a assinatura pode ter decorators de parametro com () tambem; pega até o primeiro '{' que
        # vem depois do ultimo ')' de fechamento do parametro-list em profundidade 0
        depth = 0
        i = sig_start
        signature_end = None
        started_params = False
        while i < len(text):
            ch = text[i]
            if ch == "(":
                depth += 1
                started_params = True
            elif ch == ")":
                depth -= 1
                if started_params and depth == 0:
                    signature_end = i + 1
                    break
            i += 1
        signature = text[sig_start:signature_end] if signature_end else ""

        body_dto = None
        query_dto = None
        body_m = re.search(r"@Body\([^)]*\)\s*\w+\s*\??:\s*(\w+)", signature)
        if body_m:
            body_dto = body_m.group(1)
        query_m = re.search(r"@Query\(\)\s*\w+\s*\??:\s*(\w+)", signature)
        if query_m:
            query_dto = query_m.group(1)

        # @Query('nome') var: Type — parâmetro nomeado individual, não um DTO agregado
        # (ex.: orders.guest.controller.ts: @Query('country') country: string)
        named_query_params = [
            (m2.group(1), m2.group(2))
            for m2 in re.finditer(r"@Query\(\s*['\"](\w+)['\"]\s*\)\s*\w+\s*\??:\s*(\w+)", signature)
        ]

        full_path = "/".join(p.strip("/") for p in [base_path, route_path] if p)
        full_path = "/" + full_path if full_path else "/"

        routes.append(
            {
                "method": http_method,
                "path": full_path,
                "body_dto": body_dto,
                "query_dto": query_dto,
                "named_query_params": named_query_params,
                "is_public": is_public or class_public,
            }
        )
    return routes


def dto_to_query_examples(class_name, dto_index):
    """DTO de @Query() -> lista [(key, valor_exemplo_str), ...], achatada (sem objeto/array
    aninhado — não faz sentido em query string, só teria em @Query() por engano)."""
    if not class_name:
        return []
    fields = parse_dto_fields(class_name, dto_index)
    out = []
    for key, value in fields.items():
        if isinstance(value, list):
            value = value[0] if value else ""
        if isinstance(value, dict):
            continue
        if isinstance(value, bool):
            value = "true" if value else "false"
        out.append((key, str(value)))
    return out


def build_url(path, query_params=None, enabled_query=None):
    parts = [p for p in path.split("/") if p]
    path_vars = [p[1:] for p in parts if p.startswith(":")]
    url_parts = [f"{{{{{p[1:]}}}}}" if p.startswith(":") else p for p in parts]
    enabled_query = enabled_query or {}

    raw = "{{baseUrl}}/" + "/".join(url_parts) if url_parts else "{{baseUrl}}"
    if enabled_query:
        raw += "?" + "&".join(f"{k}={v}" for k, v in enabled_query.items())

    url = {
        "raw": raw,
        "host": ["{{baseUrl}}"],
        "path": url_parts,
    }
    if path_vars:
        url["variable"] = [{"key": v, "value": ""} for v in path_vars]

    query = []
    if query_params:
        for key, value in query_params:
            if key in enabled_query:
                query.append({"key": key, "value": enabled_query[key]})
            else:
                query.append({"key": key, "value": value, "disabled": True})
    url["query"] = query
    return url


NO_AUTH_PATTERNS = [
    r"^/$", r"^/health$", r"^/debug/error$", r"^/metrics$",
    r"^/products", r"^/categories($|/)", r"^/catalog", r"^/search",
    r"^/banners$", r"^/announcements$", r"^/homepage", r"^/newsletter",
    r"^/coupons/validate$", r"^/orders/guest", r"^/webhooks", r"^/payments/stripe/webhook$",
    r"^/admin/auth/login$", r"^/admin/auth/refresh$", r"^/admin/reports",
    r"^/customers/login", r"^/customers/register$", r"^/customers/refresh$",
    r"^/customers/verify/", r"^/customers/password-reset/",
]


def needs_admin_auth(path):
    return path.startswith("/admin/") and not any(re.match(p, path) for p in NO_AUTH_PATTERNS)


def needs_customer_auth(path):
    return path.startswith("/customers/") and not any(re.match(p, path) for p in NO_AUTH_PATTERNS)


def folder_for(path):
    parts = [p for p in path.split("/") if p]
    if not parts:
        return "root"
    if parts[0] == "admin" and len(parts) > 1:
        return f"admin-{parts[1]}"
    return parts[0]


def build_item(route, dto_index, name_suffix="", enabled_query=None):
    method, path = route["method"], route["path"]
    headers = []
    if needs_admin_auth(path):
        headers.append({"key": "Authorization", "value": "Bearer {{adminToken}}", "type": "text"})
    elif needs_customer_auth(path):
        headers.append({"key": "Authorization", "value": "Bearer {{customerToken}}", "type": "text"})

    query_params = []
    if method == "GET":
        query_params = dto_to_query_examples(route.get("query_dto"), dto_index)
        for name, ts_type in route.get("named_query_params", []):
            if ts_type == "number":
                query_params.append((name, str(number_example(name))))
            elif ts_type == "boolean":
                query_params.append((name, "false"))
            else:
                query_params.append((name, str(string_example(name))))

    item = {
        "name": f"{method} {path}{name_suffix}",
        "request": {
            "method": method,
            "header": list(headers),
            "url": build_url(path, query_params, enabled_query),
        },
    }

    if method in ("POST", "PATCH", "PUT"):
        headers.append({"key": "Content-Type", "value": "application/json", "type": "text"})
        item["request"]["header"] = headers
        body_obj = {}
        if route["body_dto"]:
            body_obj = parse_dto_fields(route["body_dto"], dto_index)
        item["request"]["body"] = {
            "mode": "raw",
            "raw": json.dumps(body_obj, indent=2, ensure_ascii=False),
            "options": {"raw": {"language": "json"}},
        }

    return item


# Combinações de filtro concretas, já testadas de verdade nesta sessão (curl + resultado
# conferido) — pra você já ter requests prontos pra clicar "Send", não só o endpoint pelado.
FILTER_EXAMPLES = {
    ("GET", "/products"): [
        ("- por marca", {"brand": "jordan"}),
        ("- por marca+cor combinados", {"brand": "nike", "facets": "color:black"}),
        ("- por gênero", {"facets": "gender:kids"}),
    ],
    ("GET", "/catalog/filters"): [
        ("- por marca (testa auto-exclusão)", {"brand": "jordan"}),
        ("- marca+cor combinados", {"brand": "nike", "facets": "color:black"}),
        ("- gênero já fixo (some da resposta)", {"facets": "gender:men"}),
        ("- gênero kids (mostra Age Group)", {"facets": "gender:kids"}),
    ],
    ("GET", "/catalog/banner"): [
        ("- banner de gênero", {"facets": "gender:men"}),
    ],
    ("GET", "/search"): [
        ("- texto livre", {"q": "air jordan"}),
        ("- texto + marca", {"q": "sneaker", "brand": "nike"}),
    ],
}


def main():
    dto_index = {}
    for p in SRC.glob("**/dto/*.dto.ts"):
        dto_index[str(p)] = p.read_text(encoding="utf-8")

    all_routes = []
    controller_texts = {}
    for p in (ROOT / "src").glob("**/*.controller.ts"):
        text = p.read_text(encoding="utf-8")
        controller_texts[str(p)] = text
        all_routes.extend(parse_controller(p, text))

    # alguns DTOs (ex.: ValidateCouponDto) são declarados dentro do próprio arquivo do
    # controller, não em dto/*.dto.ts — indexa os controllers também pra achá-los.
    dto_index.update(controller_texts)

    # dedupe (método+path)
    seen = set()
    unique_routes = []
    for r in all_routes:
        key = (r["method"], r["path"])
        if key in seen:
            continue
        seen.add(key)
        unique_routes.append(r)

    folders = {}
    for route in sorted(unique_routes, key=lambda r: (r["path"], r["method"])):
        folder = folder_for(route["path"])
        folders.setdefault(folder, []).append(build_item(route, dto_index))

        key = (route["method"], route["path"])
        for suffix, enabled_query in FILTER_EXAMPLES.get(key, []):
            folders[folder].append(build_item(route, dto_index, name_suffix=f" {suffix}", enabled_query=enabled_query))

    folder_items = [{"name": name, "item": items} for name, items in sorted(folders.items())]

    collection = {
        "info": {
            "name": "stockzy-ecommerce-api (completo, com exemplos)",
            "description": "Gerado automaticamente a partir dos controllers/DTOs reais do projeto — corpo de exemplo extraído de cada @Body() DTO. Não é dado real, são placeholders pra você editar.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "variable": [
            {"key": "baseUrl", "value": "http://localhost:3000", "type": "string"},
            {"key": "adminToken", "value": "", "type": "string"},
            {"key": "customerToken", "value": "", "type": "string"},
        ],
        "item": folder_items,
    }

    OUT_FILE.parent.mkdir(exist_ok=True)
    OUT_FILE.write_text(json.dumps(collection, indent=2, ensure_ascii=False), encoding="utf-8")

    total = sum(len(f["item"]) for f in folder_items)
    print(f"Pastas: {len(folder_items)} | Endpoints: {total}")
    print(f"Arquivo: {OUT_FILE}")


if __name__ == "__main__":
    main()
