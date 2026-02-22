# Obsidian MCP

Obsidian vault와 상호작용하는 [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) 서버입니다. Cursor 등 MCP를 지원하는 클라이언트에서 Obsidian 노트·태그·링크·템플릿·폴더 등을 조회·생성·수정할 수 있습니다.

## 요구 사항

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (권장) 또는 pip

## 설치 및 실행 (uv)

이 프로젝트는 **uv** 환경을 기준으로 합니다.

### 1. uv 설치 (미설치 시)

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 또는 pip로
pip install uv
```

### 2. 프로젝트 클론 및 의존성 설치

```bash
cd ObsidianMCP
uv sync
```

`uv sync`는 가상환경(`.venv`)을 만들고 `pyproject.toml` 기준으로 의존성을 설치합니다.

### 3. 환경 변수 설정

Obsidian vault 경로를 설정합니다. 프로젝트 루트에 `.env` 파일을 만들거나, 셸에서 내보냅니다.

```bash
# .env 예시
OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault
```

```bash
# 또는 셸에서
export OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"
```

### 4. MCP 서버 실행 (로컬 테스트)

```bash
# stdio 모드 (Cursor 등에서 사용하는 방식)
uv run python main.py

# HTTP 서버로 실행 (선택)
uv run python run_server.py --http
```

## Cursor에서 사용하기

MCP 서버를 Cursor에 연결하려면 **uv**로 만든 가상환경의 Python을 사용해야 합니다.

- [CURSOR_SETUP.md](./CURSOR_SETUP.md)에서 Cursor MCP 설정 방법을 확인하세요.
- `command`에는 **프로젝트 내 `.venv`의 Python** 경로를 넣고, `args`에 `main.py` 절대 경로를 넣는 방식을 권장합니다.

## 제공 도구 개요

| 도메인 | 예시 도구 |
|--------|------------|
| 노트 | `read_obsidian_note`, `create_obsidian_note`, `update_obsidian_note`, `list_obsidian_notes`, `search_obsidian_notes` |
| 태그 | `get_note_tags`, `search_by_tag`, `add_tag_to_note`, `remove_tag_from_note`, `list_all_tags` |
| 링크 | `get_note_links`, `get_backlinks`, `create_link_between_notes`, `find_orphaned_notes`, `find_broken_links` |
| 템플릿 | `list_templates`, `create_note_from_template`, `save_template`, `get_template` |
| 일일 노트 | `create_daily_note`, `get_daily_note`, `list_daily_notes` |
| 통계/폴더 | `get_vault_statistics`, `get_note_statistics`, `list_folders`, `create_folder`, `move_note` 등 |
| 검색 | `search_by_regex`, `search_by_date_range`, `fuzzy_search_note` |
| 임베드/블록 | `get_note_blocks`, `update_block`, `embed_note`, `get_note_embeds`, `remove_embed` |

전체 목록은 Cursor에서 MCP 서버 로드 후 도구 목록을 보거나, `get_server_info` 도구로 확인할 수 있습니다.

## 프로젝트 구조

```
ObsidianMCP/
├── main.py           # MCP 진입점, 도구 등록
├── run_server.py     # stdio / HTTP 실행 스크립트
├── settings.py       # 설정 (vault 경로 등)
├── pyproject.toml    # 의존성 (uv/pip)
├── obsidian/         # Obsidian 도메인 모듈
│   ├── vault.py
│   ├── notes.py
│   ├── tags.py
│   ├── links.py
│   ├── templates.py
│   ├── daily_notes.py
│   ├── statistics.py
│   ├── folders.py
│   ├── advanced_search.py
│   └── embeds.py
├── README.md
└── CURSOR_SETUP.md   # Cursor MCP 설정 가이드
```

## 개발

```bash
# 테스트 의존성 포함 설치
uv sync --all-extras

# 테스트 실행
uv run pytest
```

## 라이선스

프로젝트에 명시된 라이선스를 따릅니다.
