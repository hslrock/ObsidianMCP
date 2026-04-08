# Obsidian MCP - Community Edition (HSL)

Obsidian vault와 상호작용하는 [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) 서버입니다. Claude Code, Cursor 등 MCP를 지원하는 클라이언트에서 Obsidian 노트·태그·링크·템플릿·폴더 등을 조회·생성·수정할 수 있습니다.

이 프로젝트는 사람의 개입 없이 **AI만으로 만들어졌으며**, **Python**과 **TypeScript** 두 가지 구현을 제공합니다.

## 빠른 설치 (TypeScript / npm)

```bash
npm install -g obsidian-mcp-hsl-ce
```

### Claude Code에서 추가

```bash
claude mcp add-json obsidian '{"type":"stdio","command":"obsidian-mcp-hsl-ce","args":["~/Documents/Obsidian/MyVault"]}'
```

### 설치 없이 사용 (npx)

글로벌 설치 없이 `npx`로 필요할 때마다 자동으로 가져와서 실행할 수도 있습니다:

```bash
claude mcp add-json obsidian '{"type":"stdio","command":"npx","args":["-y","obsidian-mcp-hsl-ce","~/Documents/Obsidian/MyVault"]}'
```

### Cursor / 기타 MCP 클라이언트

MCP 설정 파일(JSON)에 추가:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "obsidian-mcp-hsl-ce",
      "args": ["~/Documents/Obsidian/MyVault"]
    }
  }
}
```

> `args`의 경로를 본인의 Obsidian vault 경로로 변경하세요.

---

## 프로젝트 구조

```
ObsidianMCP/
├── obsidian-mcp-py/    # Python 구현
│   ├── main.py
│   ├── run_server.py
│   ├── settings.py
│   ├── pyproject.toml
│   ├── obsidian/
│   ├── CURSOR_SETUP.md
│   └── CLAUDE_SETUP.md
├── obsidian-mcp-ts/    # TypeScript 구현
│   ├── src/
│   │   ├── main.ts
│   │   ├── settings.ts
│   │   └── obsidian/
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## Python 버전

### 요구 사항

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (권장) 또는 pip

### 설치 및 실행

```bash
cd obsidian-mcp-py

# 의존성 설치
uv sync

# 환경 변수 설정
echo 'OBSIDIAN_VAULT_PATH=/path/to/your/vault' > .env

# MCP 서버 실행 (stdio 모드)
uv run python main.py

# HTTP 서버로 실행 (선택)
uv run python run_server.py --http
```

### MCP 클라이언트 설정 (Cursor)

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "/path/to/obsidian-mcp-py/.venv/bin/python",
      "args": ["/path/to/obsidian-mcp-py/main.py"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

자세한 설정은 [CURSOR_SETUP.md](./obsidian-mcp-py/CURSOR_SETUP.md) 및 [CLAUDE_SETUP.md](./obsidian-mcp-py/CLAUDE_SETUP.md)를 참고하세요.

---

## TypeScript 버전 (npm: `obsidian-mcp-hsl-ce`) - Community Edition

### 설치

```bash
# 글로벌 설치 (권장)
npm install -g obsidian-mcp-hsl-ce

# 또는 설치 없이 npx로 실행
npx -y obsidian-mcp-hsl-ce ~/Documents/Obsidian/MyVault

# 또는 소스에서 직접
cd obsidian-mcp-ts
npm install && npm run build
```

### MCP 클라이언트 설정 (Claude Code / Cursor)

글로벌 설치 후 vault 경로만 인자로 넘기면 됩니다:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "obsidian-mcp-hsl-ce",
      "args": ["~/Documents/Obsidian/MyVault"]
    }
  }
}
```

환경 변수 방식도 여전히 지원합니다:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "obsidian-mcp-hsl-ce",
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

Vault 경로 우선순위: **CLI 인자** > **환경 변수** > **기본 경로 탐색**

---

## 제공 도구 (40개)

두 버전 모두 동일한 도구를 제공합니다.

| 도메인 | 도구 |
|--------|------|
| 노트 | `read_obsidian_note`, `create_obsidian_note`, `update_obsidian_note`, `list_obsidian_notes`, `search_obsidian_notes` |
| 태그 | `get_note_tags`, `search_by_tag`, `add_tag_to_note`, `remove_tag_from_note`, `list_all_tags` |
| 링크 | `get_note_links`, `get_backlinks`, `create_link_between_notes`, `find_orphaned_notes`, `find_broken_links` |
| 템플릿 | `list_templates`, `create_note_from_template`, `save_template`, `get_template` |
| 일일 노트 | `create_daily_note`, `get_daily_note`, `list_daily_notes` |
| 통계 | `get_vault_statistics`, `get_note_statistics`, `find_most_linked_notes`, `get_note_graph_data` |
| 폴더 | `create_folder`, `move_note`, `list_folders`, `get_folder_statistics`, `delete_folder` |
| 검색 | `search_by_regex`, `search_by_date_range`, `fuzzy_search_note` |
| 임베드/블록 | `get_note_blocks`, `update_block`, `embed_note`, `get_note_embeds`, `remove_embed` |
| 서버 | `get_server_info` |

## 라이선스

프로젝트에 명시된 라이선스를 따릅니다.
